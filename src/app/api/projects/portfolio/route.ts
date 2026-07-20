import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { getProjectSummary, ProjectSummary } from "@/lib/services/summary";

export const dynamic = "force-dynamic";

interface PortfolioItem {
  id: string;
  name: string;
  address: string | null;
  progressPct: number;
  moneyPct: number | null;
  gapPp: number | null;
  flag: "OK" | "WARN" | "DANGER" | "UNKNOWN";
  pendingReviewCount: number;
}

const FLAG_PRIORITY: Record<string, number> = {
  DANGER: 3,
  WARN: 2,
  OK: 1,
  UNKNOWN: 0,
};

export async function GET() {
  const { session, error } = await requireRole(["OWNER", "ADMIN"] as Role[]);
  if (error) return error;

  const isAdmin = session!.user.role === "ADMIN";

  const projects = await prisma.project.findMany({
    where: isAdmin
      ? {}
      : {
          members: {
            some: {
              userId: session!.user.id,
            },
          },
        },
    select: {
      id: true,
      name: true,
      address: true,
    },
    orderBy: { name: "asc" },
  });

  const items: PortfolioItem[] = [];

  for (const project of projects) {
    const summary: ProjectSummary = await getProjectSummary(project.id);

    items.push({
      id: project.id,
      name: project.name,
      address: project.address,
      progressPct: summary.progressPct,
      moneyPct: summary.moneyPct,
      gapPp: summary.gapPp,
      flag: summary.flag,
      pendingReviewCount: summary.pendingReviewCount,
    });
  }

  // Sort: DANGER > WARN > OK > UNKNOWN, then by descending |gapPp|
  items.sort((a, b) => {
    const flagDiff = FLAG_PRIORITY[b.flag] - FLAG_PRIORITY[a.flag];
    if (flagDiff !== 0) return flagDiff;

    const gapA = Math.abs(a.gapPp ?? 0);
    const gapB = Math.abs(b.gapPp ?? 0);
    return gapB - gapA;
  });

  return NextResponse.json({ projects: items });
}
