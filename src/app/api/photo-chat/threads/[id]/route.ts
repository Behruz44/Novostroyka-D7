import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const { session, error } = await requireRole(["OWNER", "ADMIN"] as Role[]);
  if (error) return error;

  const thread = await prisma.chatThread.findUnique({
    where: { id: params.id },
    select: { projectId: true, userId: true },
  });

  if (!thread) {
    return NextResponse.json({ error: "Диалог не найден" }, { status: 404 });
  }

  // Membership + ownership check
  if (thread.userId !== session!.user.id) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  if (session!.user.role !== "ADMIN" && !session!.user.projectIds.includes(thread.projectId)) {
    return NextResponse.json({ error: "Нет доступа к проекту" }, { status: 403 });
  }

  const messages = await prisma.chatMessage.findMany({
    where: { threadId: params.id },
    select: {
      id: true,
      role: true,
      content: true,
      photoKeys: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ messages });
}
