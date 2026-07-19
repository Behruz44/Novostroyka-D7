import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface CreateBody {
  projectId?: string;
  name?: string;
  specialty?: string;
  phone?: string;
}

export async function POST(request: Request) {
  const { session, error } = await requireRole(["OWNER", "ADMIN"] as Role[]);
  if (error) return error;

  let body: CreateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const { projectId, name, specialty, phone } = body;

  if (!projectId || !name || !specialty) {
    return NextResponse.json(
      { error: "Не указаны projectId, name или specialty" },
      { status: 400 },
    );
  }

  if (name.trim().length === 0 || specialty.trim().length === 0) {
    return NextResponse.json(
      { error: "Имя и специализация не могут быть пустыми" },
      { status: 400 },
    );
  }

  if (
    session!.user.role !== "ADMIN" &&
    !session!.user.projectIds.includes(projectId)
  ) {
    return NextResponse.json({ error: "Нет доступа к проекту" }, { status: 403 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  const contractor = await prisma.contractor.create({
    data: {
      projectId,
      name: name.trim(),
      specialty: specialty.trim(),
      phone: phone?.trim() || null,
    },
  });

  return NextResponse.json(contractor, { status: 201 });
}

export async function GET(request: Request) {
  const { session, error } = await requireRole(["OWNER", "ADMIN"] as Role[]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "Не указан projectId" }, { status: 400 });
  }

  if (
    session!.user.role !== "ADMIN" &&
    !session!.user.projectIds.includes(projectId)
  ) {
    return NextResponse.json({ error: "Нет доступа к проекту" }, { status: 403 });
  }

  const contractors = await prisma.contractor.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ contractors });
}
