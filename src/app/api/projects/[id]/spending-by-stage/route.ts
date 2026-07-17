import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { session, error } = await requireRole(["OWNER", "ADMIN"] as Role[]);

  if (error) return error;

  const projectId = params.id;

  if (session!.user.role !== "ADMIN" && !session!.user.projectIds.includes(projectId)) {
    return NextResponse.json({ error: "Нет доступа к проекту" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const includeAll = searchParams.get("includeAll") === "true";

  const grouped = await prisma.expense.groupBy({
    by: ["stageId"],
    where: { projectId, stageId: { not: null } },
    _sum: { amountMinor: true },
  });

  const spentMap = new Map<string, bigint>();
  for (const g of grouped) {
    if (g.stageId) spentMap.set(g.stageId, g._sum.amountMinor ?? 0n);
  }

  const allStages = await prisma.stage.findMany({
    where: { projectId },
    select: { id: true, name: true, floor: true },
    orderBy: [{ floor: "asc" }, { name: "asc" }],
  });

  const result = allStages
    .filter((s) => includeAll || spentMap.has(s.id))
    .map((s) => ({
      stageId: s.id,
      stageName: s.name,
      floor: s.floor,
      totalSpent: (spentMap.get(s.id) ?? 0n).toString(),
    }));

  return NextResponse.json({ stages: result });
}
