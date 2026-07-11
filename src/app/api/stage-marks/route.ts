import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";
import { createStageMark, getStageMarksForUser } from "@/lib/services/stageMarks";

export const dynamic = "force-dynamic";

interface CreateBody {
  projectId?: string;
  stageId?: string;
  photoKeys?: string[];
  comment?: string;
  clientRequestId?: string;
}

export async function POST(request: Request) {
  const { session, error } = await requireRole(["FOREMAN", "ADMIN"] as Role[]);

  if (error) return error;

  let body: CreateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const { projectId, stageId, photoKeys, comment, clientRequestId } = body;

  if (!projectId || !stageId || !clientRequestId) {
    return NextResponse.json(
      { error: "Не указаны projectId, stageId или clientRequestId" },
      { status: 400 },
    );
  }

  if (!photoKeys || !Array.isArray(photoKeys)) {
    return NextResponse.json(
      { error: "photoKeys должен быть массивом" },
      { status: 400 },
    );
  }

  const result = await createStageMark({
    projectId,
    stageId,
    photoKeys,
    comment,
    clientRequestId,
    userId: session!.user.id,
    userProjectIds: session!.user.projectIds,
    userRole: session!.user.role,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data, { status: result.status });
}

export async function GET(request: Request) {
  const { session, error } = await requireRole(["FOREMAN", "ADMIN"] as Role[]);

  if (error) return error;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json(
      { error: "Не указан projectId" },
      { status: 400 },
    );
  }

  if (session!.user.role !== "ADMIN" && !session!.user.projectIds.includes(projectId)) {
    return NextResponse.json({ error: "Нет доступа к проекту" }, { status: 403 });
  }

  const marks = await getStageMarksForUser(
    session!.user.id,
    projectId,
    session!.user.role,
  );

  return NextResponse.json({ marks });
}
