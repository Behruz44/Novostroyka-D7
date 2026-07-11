import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const { session, error } = await requireRole(["FOREMAN", "ADMIN"] as Role[]);

  if (error) return error;

  const userProjectIds = session!.user.projectIds;

  const stages = await prisma.stage.findMany({
    where: {
      projectId: { in: userProjectIds },
      status: "WAIT",
    },
    select: {
      id: true,
      name: true,
      floor: true,
      order: true,
      projectId: true,
    },
    orderBy: [{ floor: "asc" }, { order: "asc" }],
  });

  return NextResponse.json({ stages });
}
