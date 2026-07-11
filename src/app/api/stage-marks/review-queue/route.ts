import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";
import { getReviewQueue } from "@/lib/services/stageMarks";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { session, error } = await requireRole(["OWNER", "ADMIN"] as Role[]);

  if (error) return error;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json(
      { error: "Не указан projectId" },
      { status: 400 },
    );
  }

  if (
    session!.user.role !== "ADMIN" &&
    !session!.user.projectIds.includes(projectId)
  ) {
    return NextResponse.json({ error: "Нет доступа к проекту" }, { status: 403 });
  }

  const marks = await getReviewQueue(projectId);

  return NextResponse.json({ marks });
}
