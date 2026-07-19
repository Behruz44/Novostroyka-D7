import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface PatchBody {
  plannedStart?: string | null;
  plannedEnd?: string | null;
  contractorId?: string | null;
  dependsOnStageId?: string | null;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { session, error } = await requireRole(["OWNER", "ADMIN"] as Role[]);
  if (error) return error;

  const stage = await prisma.stage.findUnique({
    where: { id: params.id },
    select: { id: true, projectId: true, plannedStart: true, plannedEnd: true, contractorId: true, dependsOnStageId: true },
  });

  if (!stage) {
    return NextResponse.json({ error: "Этап не найден" }, { status: 404 });
  }

  if (
    session!.user.role !== "ADMIN" &&
    !session!.user.projectIds.includes(stage.projectId)
  ) {
    return NextResponse.json({ error: "Нет доступа к проекту" }, { status: 403 });
  }

  return NextResponse.json({
    id: stage.id,
    plannedStart: stage.plannedStart,
    plannedEnd: stage.plannedEnd,
    contractorId: stage.contractorId,
    dependsOnStageId: stage.dependsOnStageId,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { session, error } = await requireRole(["OWNER", "ADMIN"] as Role[]);

  if (error) return error;

  const stageId = params.id;

  // Membership-check — first substantive gate after RBAC
  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    select: { projectId: true },
  });

  if (!stage) {
    return NextResponse.json({ error: "Этап не найден" }, { status: 404 });
  }

  if (
    session!.user.role !== "ADMIN" &&
    !session!.user.projectIds.includes(stage.projectId)
  ) {
    return NextResponse.json({ error: "Нет доступа к проекту" }, { status: 403 });
  }

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const data: {
    plannedStart?: Date | null;
    plannedEnd?: Date | null;
    contractorId?: string | null;
    dependsOnStageId?: string | null;
  } = {};

  if ("contractorId" in body) {
    if (body.contractorId === null || body.contractorId === "") {
      data.contractorId = null;
    } else {
      const contractor = await prisma.contractor.findUnique({
        where: { id: body.contractorId },
        select: { projectId: true },
      });

      if (!contractor) {
        return NextResponse.json({ error: "Подрядчик не найден" }, { status: 400 });
      }

      if (contractor.projectId !== stage.projectId) {
        return NextResponse.json(
          { error: "Подрядчик не принадлежит указанному проекту" },
          { status: 400 },
        );
      }

      data.contractorId = body.contractorId;
    }
  }

  if ("dependsOnStageId" in body) {
    if (body.dependsOnStageId === null || body.dependsOnStageId === "") {
      data.dependsOnStageId = null;
    } else if (typeof body.dependsOnStageId === "string") {
      // Self-dependency check
      if (body.dependsOnStageId === stageId) {
        return NextResponse.json(
          { error: "Этап не может зависеть сам от себя" },
          { status: 400 },
        );
      }

      // Same-project check
      const depStage = await prisma.stage.findUnique({
        where: { id: body.dependsOnStageId },
        select: { projectId: true },
      });

      if (!depStage) {
        return NextResponse.json(
          { error: "Этап-зависимость не найден" },
          { status: 400 },
        );
      }

      if (depStage.projectId !== stage.projectId) {
        return NextResponse.json(
          { error: "Этап-зависимость не принадлежит указанному проекту" },
          { status: 400 },
        );
      }

      // Cycle detection: traverse dependency chain up to 50 steps
      const MAX_DEPTH = 50;
      let currentId: string | null = body.dependsOnStageId;
      const visited = new Set<string>([stageId]);

      for (let i = 0; i < MAX_DEPTH; i++) {
        if (currentId === null) break;
        if (visited.has(currentId)) {
          return NextResponse.json(
            { error: "Циклическая зависимость этапов" },
            { status: 400 },
          );
        }
        visited.add(currentId);

        const depRow: { dependsOnStageId: string | null } | null = await prisma.stage.findUnique({
          where: { id: currentId },
          select: { dependsOnStageId: true },
        });

        if (!depRow) break;
        currentId = depRow.dependsOnStageId;
      }

      if (currentId !== null) {
        return NextResponse.json(
          { error: "Превышена максимальная глубина цепочки зависимостей" },
          { status: 400 },
        );
      }

      data.dependsOnStageId = body.dependsOnStageId;
    }
  }

  if ("plannedStart" in body) {
    if (body.plannedStart === null || body.plannedStart === "") {
      data.plannedStart = null;
    } else if (typeof body.plannedStart === "string") {
      const parsed = new Date(body.plannedStart);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: "Некорректная дата plannedStart" },
          { status: 400 },
        );
      }
      data.plannedStart = parsed;
    }
  }

  if ("plannedEnd" in body) {
    if (body.plannedEnd === null || body.plannedEnd === "") {
      data.plannedEnd = null;
    } else if (typeof body.plannedEnd === "string") {
      const parsed = new Date(body.plannedEnd);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: "Некорректная дата plannedEnd" },
          { status: 400 },
        );
      }
      data.plannedEnd = parsed;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Нет полей для обновления" },
      { status: 400 },
    );
  }

  if (
    data.plannedStart &&
    data.plannedEnd &&
    data.plannedStart > data.plannedEnd
  ) {
    return NextResponse.json(
      { error: "Дата начала не может быть позже даты окончания" },
      { status: 400 },
    );
  }

  const updated = await prisma.stage.update({
    where: { id: stageId },
    data,
    select: { id: true, plannedStart: true, plannedEnd: true, contractorId: true, dependsOnStageId: true },
  });

  return NextResponse.json(updated);
}
