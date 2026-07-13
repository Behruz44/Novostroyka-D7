import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";
import { createDowntimeReport, isDowntimeReason } from "@/lib/services/downtime";

export const dynamic = "force-dynamic";

interface CreateDowntimeBody {
  projectId?: string;
  stageId?: string | null;
  reason?: string;
  comment?: string;
  clientRequestId?: string;
}

export async function POST(request: Request) {
  const { session, error } = await requireRole(["FOREMAN", "ADMIN"] as Role[]);

  if (error) return error;

  let body: CreateDowntimeBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const { projectId, stageId, reason, comment, clientRequestId } = body;

  if (!projectId || !clientRequestId) {
    return NextResponse.json(
      { error: "Не указаны projectId или clientRequestId" },
      { status: 400 },
    );
  }

  if (!reason || !isDowntimeReason(reason)) {
    return NextResponse.json(
      { error: "Недопустимая причина простоя" },
      { status: 400 },
    );
  }

  const result = await createDowntimeReport({
    projectId,
    stageId: stageId ?? null,
    reason,
    comment: comment ?? null,
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
