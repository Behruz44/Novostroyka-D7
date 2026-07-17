import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { session, error } = await requireRole(["OWNER", "ADMIN"] as Role[]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId обязателен" },
      { status: 400 },
    );
  }

  // Membership check
  if (session!.user.role !== "ADMIN" && !session!.user.projectIds.includes(projectId)) {
    return NextResponse.json({ error: "Нет доступа к проекту" }, { status: 403 });
  }

  const threads = await prisma.chatThread.findMany({
    where: {
      projectId,
      userId: session!.user.id,
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ threads });
}
