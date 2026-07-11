import { prisma } from "@/lib/db";
import { verifyUploadedSize } from "@/lib/storage";
import { StageStatus, MarkStatus } from "@prisma/client";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export interface CreateStageMarkInput {
  projectId: string;
  stageId: string;
  photoKeys: string[];
  comment?: string;
  clientRequestId: string;
  userId: string;
  userProjectIds: string[];
  userRole: string;
}

export interface CreateStageMarkResult {
  ok: boolean;
  status: number;
  data?: Record<string, unknown>;
  error?: string;
}

class StageRaceError extends Error {
  constructor() {
    super("Stage race condition: status was not WAIT inside transaction");
  }
}

export async function createStageMark(
  input: CreateStageMarkInput,
): Promise<CreateStageMarkResult> {
  const { projectId, stageId, photoKeys, comment, clientRequestId, userId, userProjectIds, userRole } = input;

  if (userRole !== "ADMIN" && !userProjectIds.includes(projectId)) {
    return { ok: false, status: 403, error: "Нет доступа к проекту" };
  }

  if (!photoKeys || photoKeys.length === 0) {
    return { ok: false, status: 400, error: "Необходимо загрузить хотя бы одно фото" };
  }

  const existing = await prisma.stageMark.findUnique({
    where: { clientRequestId },
    include: { stage: true },
  });

  if (existing) {
    if (existing.stage.projectId !== projectId) {
      return { ok: false, status: 409, error: "Конфликт идентификатора запроса" };
    }
    return {
      ok: true,
      status: 200,
      data: existing as unknown as Record<string, unknown>,
    };
  }

  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    select: { id: true, projectId: true, status: true, name: true, floor: true },
  });

  if (!stage) {
    return { ok: false, status: 404, error: "Этап не найден" };
  }

  if (stage.projectId !== projectId) {
    return { ok: false, status: 400, error: "Этап не принадлежит указанному проекту" };
  }

  if (stage.status !== StageStatus.WAIT) {
    return {
      ok: false,
      status: 400,
      error: `Этап уже в статусе ${stage.status}, отметка невозможна`,
    };
  }

  for (const key of photoKeys) {
    const verification = await verifyUploadedSize(key, MAX_FILE_SIZE);
    if (!verification.ok) {
      return {
        ok: false,
        status: 400,
        error: verification.error || "Ошибка проверки файла в хранилище",
      };
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.stage.updateMany({
        where: { id: stageId, status: StageStatus.WAIT },
        data: { status: StageStatus.REVIEW },
      });

      if (updateResult.count === 0) {
        throw new StageRaceError();
      }

      const stageMark = await tx.stageMark.create({
        data: {
          stageId,
          status: MarkStatus.REVIEW,
          photoKeys,
          comment: comment || null,
          createdBy: userId,
          clientRequestId,
        },
      });

      await tx.eventLog.create({
        data: {
          projectId: stage.projectId,
          userId,
          action: "MARK_CREATED",
          entity: "StageMark",
          entityId: stageMark.id,
          metadata: { stageId, photoKeys, comment: comment || null },
          clientRequestId,
        },
      });

      return stageMark;
    });

    return {
      ok: true,
      status: 201,
      data: result as unknown as Record<string, unknown>,
    };
  } catch (err) {
    if (err instanceof StageRaceError) {
      return { ok: false, status: 409, error: "Этап уже обрабатывается" };
    }
    throw err;
  }
}

export async function getStageMarksForUser(
  userId: string,
  projectId: string,
  userRole: string,
) {
  const where = userRole === "ADMIN" ? { stage: { projectId } } : { createdBy: userId, stage: { projectId } };

  const marks = await prisma.stageMark.findMany({
    where,
    include: {
      stage: {
        select: { name: true, floor: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return marks;
}

export interface ReviewStageMarkInput {
  stageMarkId: string;
  action: "approve" | "reject";
  reason?: string;
  userId: string;
  userProjectIds: string[];
  userRole: string;
}

export interface ReviewStageMarkResult {
  ok: boolean;
  status: number;
  data?: Record<string, unknown>;
  error?: string;
}

export async function reviewStageMark(
  input: ReviewStageMarkInput,
): Promise<ReviewStageMarkResult> {
  const { stageMarkId, action, reason, userId, userProjectIds, userRole } = input;

  const mark = await prisma.stageMark.findUnique({
    where: { id: stageMarkId },
    select: { id: true, stageId: true, status: true, stage: { select: { projectId: true } } },
  });

  if (!mark) {
    return { ok: false, status: 404, error: "Отметка не найдена" };
  }

  if (userRole !== "ADMIN" && !userProjectIds.includes(mark.stage.projectId)) {
    return { ok: false, status: 403, error: "Нет доступа к проекту" };
  }

  if (mark.status !== MarkStatus.REVIEW) {
    const current = await prisma.stageMark.findUnique({
      where: { id: stageMarkId },
      include: { stage: { select: { name: true, floor: true } } },
    });
    return {
      ok: true,
      status: 200,
      data: { ...current, status: current?.status, alreadyProcessed: true } as unknown as Record<string, unknown>,
    };
  }

  const now = new Date();

  if (action === "approve") {
    const result = await prisma.$transaction(async (tx) => {
      const updateMark = await tx.stageMark.updateMany({
        where: { id: stageMarkId, status: MarkStatus.REVIEW },
        data: { status: MarkStatus.APPROVED, reviewedAt: now, reviewedBy: userId },
      });

      if (updateMark.count === 0) {
        return null;
      }

      await tx.stage.updateMany({
        where: { id: mark.stageId, status: StageStatus.REVIEW },
        data: { status: StageStatus.DONE },
      });

      await tx.eventLog.create({
        data: {
          projectId: mark.stage.projectId,
          userId,
          action: "MARK_APPROVED",
          entity: "StageMark",
          entityId: stageMarkId,
          metadata: { stageId: mark.stageId },
          clientRequestId: null,
        },
      });

      return tx.stageMark.findUnique({
        where: { id: stageMarkId },
        include: { stage: { select: { name: true, floor: true } } },
      });
    });

    if (!result) {
      const current = await prisma.stageMark.findUnique({
        where: { id: stageMarkId },
        include: { stage: { select: { name: true, floor: true } } },
      });
      return { ok: true, status: 200, data: { ...current, alreadyProcessed: true } as unknown as Record<string, unknown> };
    }

    return { ok: true, status: 200, data: result as unknown as Record<string, unknown> };
  }

  if (action === "reject") {
    const result = await prisma.$transaction(async (tx) => {
      const updateMark = await tx.stageMark.updateMany({
        where: { id: stageMarkId, status: MarkStatus.REVIEW },
        data: { status: MarkStatus.REJECTED, reviewedAt: now, reviewedBy: userId },
      });

      if (updateMark.count === 0) {
        return null;
      }

      await tx.stage.updateMany({
        where: { id: mark.stageId, status: StageStatus.REVIEW },
        data: { status: StageStatus.WAIT },
      });

      await tx.eventLog.create({
        data: {
          projectId: mark.stage.projectId,
          userId,
          action: "MARK_REJECTED",
          entity: "StageMark",
          entityId: stageMarkId,
          metadata: { stageId: mark.stageId, reason: reason || null },
          clientRequestId: null,
        },
      });

      return tx.stageMark.findUnique({
        where: { id: stageMarkId },
        include: { stage: { select: { name: true, floor: true } } },
      });
    });

    if (!result) {
      const current = await prisma.stageMark.findUnique({
        where: { id: stageMarkId },
        include: { stage: { select: { name: true, floor: true } } },
      });
      return { ok: true, status: 200, data: { ...current, alreadyProcessed: true } as unknown as Record<string, unknown> };
    }

    return { ok: true, status: 200, data: result as unknown as Record<string, unknown> };
  }

  return { ok: false, status: 400, error: "Неизвестное действие" };
}

export async function getReviewQueue(projectId: string) {
  const marks = await prisma.stageMark.findMany({
    where: { status: MarkStatus.REVIEW, stage: { projectId } },
    include: {
      stage: { select: { name: true, floor: true } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return marks;
}
