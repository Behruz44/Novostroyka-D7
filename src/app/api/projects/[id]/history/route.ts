import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { MarkStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { session, error } = await requireRole(["OWNER", "ADMIN"] as Role[]);
  if (error) return error;

  const projectId = params.id;

  if (
    session!.user.role !== "ADMIN" &&
    !session!.user.projectIds.includes(projectId)
  ) {
    return NextResponse.json({ error: "Нет доступа к проекту" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const daysParam = parseInt(searchParams.get("days") || "30", 10);
  const days = Math.min(Math.max(daysParam || 30, 1), 90);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { totalBudgetMinor: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  const totalBudgetMinor = project.totalBudgetMinor;

  const totalAgg = await prisma.stage.aggregate({
    where: { projectId },
    _sum: { weightBp: true },
  });
  const totalWeightBp = totalAgg._sum.weightBp ?? 0;

  const stages = await prisma.stage.findMany({
    where: { projectId },
    select: { id: true, weightBp: true },
  });

  const stageIds = stages.map((s) => s.id);
  const stageWeightMap = new Map<string, number>(
    stages.map((s) => [s.id, s.weightBp]),
  );

  const approvedMarks = await prisma.stageMark.findMany({
    where: {
      stageId: { in: stageIds },
      status: MarkStatus.APPROVED,
      reviewedAt: { not: null },
    },
    select: { stageId: true, reviewedAt: true },
  });

  const expenses = await prisma.expense.findMany({
    where: { projectId },
    select: { amountMinor: true, expenseDate: true },
  });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const result: { date: string; progressPct: number; moneyPct: number | null; gapPp: number | null }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - i);
    const dayEnd = new Date(day);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const doneWeightBp = approvedMarks
      .filter((m) => m.reviewedAt && m.reviewedAt <= dayEnd)
      .reduce((sum, m) => sum + (stageWeightMap.get(m.stageId) ?? 0), 0);

    const progressPct =
      totalWeightBp === 0 ? 0 : Math.round((doneWeightBp / totalWeightBp) * 100);

    let spentMinor = 0n;
    for (const e of expenses) {
      if (e.expenseDate <= dayEnd) {
        spentMinor += e.amountMinor;
      }
    }

    const moneyPct =
      totalBudgetMinor === 0n
        ? null
        : Math.round((Number(spentMinor) / Number(totalBudgetMinor)) * 100);

    const gapPp = moneyPct !== null ? moneyPct - progressPct : null;

    result.push({
      date: day.toISOString().slice(0, 10),
      progressPct,
      moneyPct,
      gapPp,
    });
  }

  return NextResponse.json({ history: result });
}
