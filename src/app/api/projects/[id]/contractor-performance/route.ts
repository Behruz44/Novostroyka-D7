import { NextResponse } from "next/server";
import { Role, StageStatus, MarkStatus } from "@prisma/client";
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

  if (
    session!.user.role !== "ADMIN" &&
    !session!.user.projectIds.includes(projectId)
  ) {
    return NextResponse.json({ error: "Нет доступа к проекту" }, { status: 403 });
  }

  const contractors = await prisma.contractor.findMany({
    where: { projectId },
    select: { id: true, name: true, specialty: true },
    orderBy: { createdAt: "desc" },
  });

  if (contractors.length === 0) {
    return NextResponse.json({ contractors: [] });
  }

  const contractorIds = contractors.map((c) => c.id);

  // Stages assigned to any of these contractors
  const stages = await prisma.stage.findMany({
    where: { projectId, contractorId: { in: contractorIds } },
    select: {
      id: true,
      contractorId: true,
      status: true,
      plannedEnd: true,
    },
  });

  // Reuse the exact same LATE-detection logic as getProjectSummary (read-only reimplementation,
  // does not modify src/lib/services/summary.ts per task constraints)
  const reviewedMarkDates = await prisma.stageMark.findMany({
    where: {
      stage: { projectId, contractorId: { in: contractorIds } },
      status: MarkStatus.APPROVED,
    },
    select: { stageId: true, reviewedAt: true },
    orderBy: { reviewedAt: "desc" },
  });

  const latestReviewByStage = new Map<string, Date>();
  for (const m of reviewedMarkDates) {
    if (m.reviewedAt && !latestReviewByStage.has(m.stageId)) {
      latestReviewByStage.set(m.stageId, m.reviewedAt);
    }
  }

  const now = new Date();
  function isLate(s: { id: string; status: StageStatus; plannedEnd: Date | null }): boolean {
    if (!s.plannedEnd) return false;
    if (s.status === StageStatus.DONE) {
      const reviewedAt = latestReviewByStage.get(s.id);
      return !!(reviewedAt && reviewedAt > s.plannedEnd);
    }
    const daysUntilEnd = Math.ceil(
      (s.plannedEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    return daysUntilEnd < 0;
  }

  const totalPaidByContractor = await prisma.expense.groupBy({
    by: ["contractorId"],
    where: { projectId, contractorId: { in: contractorIds } },
    _sum: { amountMinor: true },
  });

  const paidMap = new Map<string, bigint>();
  for (const row of totalPaidByContractor) {
    if (row.contractorId) {
      paidMap.set(row.contractorId, row._sum.amountMinor ?? 0n);
    }
  }

  const result = contractors.map((c) => {
    const assignedStages = stages.filter((s) => s.contractorId === c.id);
    const doneStages = assignedStages.filter((s) => s.status === StageStatus.DONE).length;
    const lateStages = assignedStages.filter((s) => isLate(s)).length;

    return {
      contractorId: c.id,
      contractorName: c.name,
      specialty: c.specialty,
      assignedStages: assignedStages.length,
      doneStages,
      lateStages,
      totalPaidMinor: (paidMap.get(c.id) ?? 0n).toString(),
    };
  });

  return NextResponse.json({ contractors: result });
}
