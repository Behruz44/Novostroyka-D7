import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";
import { getProjectEvents } from "@/lib/services/summary";

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

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "30", 10);
  const safeLimit = Math.min(Math.max(limit, 1), 100);

  const actionParam = searchParams.get("action");
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const filters: { actions?: string[]; from?: Date; to?: Date } = {};

  if (actionParam) {
    filters.actions = actionParam.split(",").map((a) => a.trim()).filter(Boolean);
  }
  if (fromParam) {
    const from = new Date(fromParam);
    if (!isNaN(from.getTime())) filters.from = from;
  }
  if (toParam) {
    const to = new Date(toParam);
    if (!isNaN(to.getTime())) {
      to.setHours(23, 59, 59, 999);
      filters.to = to;
    }
  }

  const events = await getProjectEvents(projectId, safeLimit, filters);

  return NextResponse.json({ events });
}
