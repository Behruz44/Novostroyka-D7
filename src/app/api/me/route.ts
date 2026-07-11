import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const { session, error } = await requireRole([
    "OWNER",
    "FOREMAN",
    "ADMIN",
  ] as Role[]);

  if (error) return error;

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: {
      id: true,
      phone: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Пользователь не найден" },
      { status: 404 },
    );
  }

  return NextResponse.json({ user });
}
