import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { getProjectMetrics } from "@/lib/services/summary";

export const dynamic = "force-dynamic";

export async function GET() {
  const { session, error } = await requireRole(["OWNER", "ADMIN"] as Role[]);

  if (error) return error;

  const isAdmin = session!.user.role === "ADMIN";

  // ADMIN sees all projects; OWNER sees only their memberships
  const projects = isAdmin
    ? await prisma.project.findMany({
        select: { id: true, name: true, address: true, createdAt: true },
        orderBy: { name: "asc" },
      })
    : await prisma.project.findMany({
        where: { members: { some: { userId: session!.user.id } } },
        select: { id: true, name: true, address: true, createdAt: true },
        orderBy: { name: "asc" },
      });

  const results = await Promise.all(
    projects.map(async (p) => {
      const metrics = await getProjectMetrics(p.id);
      return {
        id: p.id,
        name: p.name,
        address: p.address,
        progressPct: metrics.progressPct,
        moneyPct: metrics.moneyPct,
        flag: metrics.flag,
      };
    }),
  );

  return NextResponse.json({ projects: results });
}
