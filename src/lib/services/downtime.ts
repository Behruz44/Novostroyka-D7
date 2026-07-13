import { prisma } from "@/lib/db";

export const DOWNTIME_REASONS = [
  "NO_MATERIALS",
  "WEATHER",
  "AWAITING_OWNER_DECISION",
  "AWAITING_INSPECTION",
  "OTHER",
] as const;

export type DowntimeReason = (typeof DOWNTIME_REASONS)[number];

export const REASON_LABELS: Record<DowntimeReason, string> = {
  NO_MATERIALS: "Нет материалов",
  WEATHER: "Погода",
  AWAITING_OWNER_DECISION: "Ждём решения владельца",
  AWAITING_INSPECTION: "Ждём инспекцию",
  OTHER: "Другое",
};

export interface CreateDowntimeInput {
  projectId: string;
  stageId: string | null;
  reason: DowntimeReason;
  comment: string | null;
  clientRequestId: string;
  userId: string;
  userProjectIds: string[];
  userRole: string;
}

export interface CreateDowntimeResult {
  ok: boolean;
  status: number;
  data?: Record<string, unknown>;
  error?: string;
}

export function isDowntimeReason(value: unknown): value is DowntimeReason {
  return typeof value === "string" && DOWNTIME_REASONS.includes(value as DowntimeReason);
}

export async function createDowntimeReport(
  input: CreateDowntimeInput,
): Promise<CreateDowntimeResult> {
  const { projectId, stageId, reason, comment, clientRequestId, userId, userProjectIds, userRole } =
    input;

  // Membership check — FIRST substantive check, projectId from body (not derived from stageId)
  if (userRole !== "ADMIN" && !userProjectIds.includes(projectId)) {
    return { ok: false, status: 403, error: "Нет доступа к проекту" };
  }

  // Validate reason is within enum
  if (!isDowntimeReason(reason)) {
    return { ok: false, status: 400, error: "Недопустимая причина простоя" };
  }

  // comment is required when reason === OTHER
  if (reason === "OTHER" && (!comment || !comment.trim())) {
    return { ok: false, status: 400, error: "Укажите причину простоя в комментарии" };
  }

  // If stageId provided, validate it belongs to the same projectId
  if (stageId) {
    const stage = await prisma.stage.findUnique({
      where: { id: stageId },
      select: { projectId: true },
    });

    if (!stage) {
      return { ok: false, status: 404, error: "Этап не найден" };
    }

    if (stage.projectId !== projectId) {
      return { ok: false, status: 400, error: "Этап не принадлежит указанному проекту" };
    }
  }

  // App-level idempotency: check existing EventLog with same clientRequestId + action
  // Conscious choice: no DB unique constraint on EventLog.clientRequestId because
  // downtime is not money/status-changing — full DB guarantee is overkill here.
  const existing = await prisma.eventLog.findFirst({
    where: { clientRequestId, action: "DOWNTIME_REPORTED" },
  });

  if (existing) {
    return {
      ok: true,
      status: 200,
      data: { id: existing.id, alreadyProcessed: true } as Record<string, unknown>,
    };
  }

  const event = await prisma.eventLog.create({
    data: {
      projectId,
      userId,
      action: "DOWNTIME_REPORTED",
      entity: "Downtime",
      entityId: "none",
      metadata: { stageId, reason, comment: comment || null },
      clientRequestId,
    },
  });

  return {
    ok: true,
    status: 201,
    data: { id: event.id } as Record<string, unknown>,
  };
}
