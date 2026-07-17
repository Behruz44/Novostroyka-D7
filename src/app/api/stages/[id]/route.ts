import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface PatchBody {
  plannedStart?: string | null;
  plannedEnd?: string | null;
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

  const data: { plannedStart?: Date | null; plannedEnd?: Date | null } = {};

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
    select: { id: true, plannedStart: true, plannedEnd: true },
  });

  return NextResponse.json(updated);
}
