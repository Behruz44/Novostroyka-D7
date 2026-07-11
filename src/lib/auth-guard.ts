import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import type { Role } from "@prisma/client";

export async function requireRole(allowedRoles: Role[]) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ error: "Не авторизован" }, { status: 401 }),
    };
  }

  const userRole = session.user.role as Role;
  if (!allowedRoles.includes(userRole)) {
    return {
      session,
      error: NextResponse.json({ error: "Доступ запрещён" }, { status: 403 }),
    };
  }

  return { session, error: null };
}
