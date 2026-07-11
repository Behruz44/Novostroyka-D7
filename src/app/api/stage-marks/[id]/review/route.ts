import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";
import { reviewStageMark } from "@/lib/services/stageMarks";

export const dynamic = "force-dynamic";

interface ReviewBody {
  action?: "approve" | "reject";
  reason?: string;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { session, error } = await requireRole(["OWNER", "ADMIN"] as Role[]);

  if (error) return error;

  let body: ReviewBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const { action, reason } = body;

  if (!action || (action !== "approve" && action !== "reject")) {
    return NextResponse.json(
      { error: "Действие должно быть 'approve' или 'reject'" },
      { status: 400 },
    );
  }

  if (action === "reject" && !reason) {
    return NextResponse.json(
      { error: "Укажите причину отклонения" },
      { status: 400 },
    );
  }

  const result = await reviewStageMark({
    stageMarkId: params.id,
    action,
    reason,
    userId: session!.user.id,
    userProjectIds: session!.user.projectIds,
    userRole: session!.user.role,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data, { status: result.status });
}
