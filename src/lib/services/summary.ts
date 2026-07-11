import { prisma } from "@/lib/db";
import { StageStatus, MarkStatus } from "@prisma/client";

export interface FloorProgress {
  floor: number;
  progressPct: number;
}

export interface ProjectSummary {
  progressPct: number;
  moneyPct: number | null;
  gapPp: number | null;
  flag: "OK" | "WARN" | "DANGER" | "UNKNOWN";
  pendingReviewCount: number;
  totalBudgetMinor: string;
  spentMinor: string;
  doneWeightBp: number;
  totalWeightBp: number;
  floors: FloorProgress[];
}

export interface ProjectMetrics {
  progressPct: number;
  moneyPct: number | null;
  gapPp: number | null;
  flag: "OK" | "WARN" | "DANGER" | "UNKNOWN";
  doneWeightBp: number;
  totalWeightBp: number;
  spentMinor: bigint;
  totalBudgetMinor: bigint;
}

export async function getProjectMetrics(projectId: string): Promise<ProjectMetrics> {
  // 1. Stage weights — doneWeightBp via Prisma aggregate (Int, not BigInt)
  const doneAgg = await prisma.stage.aggregate({
    where: { projectId, status: StageStatus.DONE },
    _sum: { weightBp: true },
  });
  const totalAgg = await prisma.stage.aggregate({
    where: { projectId },
    _sum: { weightBp: true },
  });

  const doneWeightBp = doneAgg._sum.weightBp ?? 0;
  const totalWeightBp = totalAgg._sum.weightBp ?? 0;

  const progressPct =
    totalWeightBp === 0 ? 0 : Math.round((doneWeightBp / totalWeightBp) * 100);

  // 2. Money — spentMinor via Prisma aggregate (BigInt throughout)
  const spentAgg = await prisma.expense.aggregate({
    where: { projectId },
    _sum: { amountMinor: true },
  });
  const spentMinor = spentAgg._sum.amountMinor ?? 0n;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { totalBudgetMinor: true },
  });

  const totalBudgetMinor = project?.totalBudgetMinor ?? 0n;

  // THE ONLY place where Number() is used on money — final division for percentage
  // All summation above was BigInt via Prisma aggregate. Result is for display only.
  const moneyPct =
    totalBudgetMinor === 0n
      ? null
      : Math.round((Number(spentMinor) / Number(totalBudgetMinor)) * 100);

  const gapPp = moneyPct !== null ? moneyPct - progressPct : null;

  // Flag thresholds: strictly > 8 WARN, strictly > 15 DANGER (per HARD LAWS)
  const flag: ProjectMetrics["flag"] =
    gapPp === null ? "UNKNOWN" : gapPp > 15 ? "DANGER" : gapPp > 8 ? "WARN" : "OK";

  return { progressPct, moneyPct, gapPp, flag, doneWeightBp, totalWeightBp, spentMinor, totalBudgetMinor };
}

export async function getProjectSummary(projectId: string): Promise<ProjectSummary> {
  const { progressPct, moneyPct, gapPp, flag, doneWeightBp, totalWeightBp, spentMinor, totalBudgetMinor } = await getProjectMetrics(projectId);

  // 3. Pending review count
  const pendingReviewCount = await prisma.stageMark.count({
    where: { status: MarkStatus.REVIEW, stage: { projectId } },
  });

  // 4. Per-floor progress
  const floorsData = await prisma.stage.findMany({
    where: { projectId },
    select: { floor: true, weightBp: true, status: true },
  });

  const floorMap = new Map<number, { done: number; total: number }>();
  for (const s of floorsData) {
    const entry = floorMap.get(s.floor) ?? { done: 0, total: 0 };
    entry.total += s.weightBp;
    if (s.status === StageStatus.DONE) entry.done += s.weightBp;
    floorMap.set(s.floor, entry);
  }

  const floors: FloorProgress[] = Array.from(floorMap.entries())
    .map(([floor, { done, total }]) => ({
      floor,
      progressPct: total === 0 ? 0 : Math.round((done / total) * 100),
    }))
    .sort((a, b) => a.floor - b.floor);

  return {
    progressPct,
    moneyPct,
    gapPp,
    flag,
    pendingReviewCount,
    totalBudgetMinor: totalBudgetMinor.toString(),
    spentMinor: spentMinor.toString(),
    doneWeightBp,
    totalWeightBp,
    floors,
  };
}

const ACTION_LABELS: Record<string, string> = {
  MARK_CREATED: "Прораб отметил этап",
  MARK_APPROVED: "Этап принят",
  MARK_REJECTED: "Этап отклонён",
  EXPENSE_CREATED: "Добавлен расход",
};

export interface ProjectEvent {
  id: string;
  action: string;
  actionLabel: string;
  entity: string;
  entityId: string;
  userName: string;
  createdAt: string;
}

export async function getProjectEvents(
  projectId: string,
  limit: number,
): Promise<ProjectEvent[]> {
  const logs = await prisma.eventLog.findMany({
    where: { projectId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    actionLabel: ACTION_LABELS[log.action] ?? log.action,
    entity: log.entity,
    entityId: log.entityId,
    userName: log.user.name,
    createdAt: log.createdAt.toISOString(),
  }));
}
