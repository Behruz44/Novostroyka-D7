import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { getProjectMetrics } from "@/lib/services/summary";
import { parseAmountToMinorUnits } from "@/lib/services/expenses";

export const dynamic = "force-dynamic";

interface BudgetLineInput {
  category: string;
  plannedMinor: string;
}

interface StageInput {
  name: string;
  floor: number;
  weightBp: number;
  order: number;
}

interface CreateProjectBody {
  name?: string;
  address?: string;
  totalBudgetMinor?: string;
  stages?: StageInput[];
  budgetLines?: BudgetLineInput[];
  clientRequestId?: string;
}

export async function POST(request: Request) {
  const { session, error } = await requireRole(["OWNER", "ADMIN"] as Role[]);
  if (error) return error;

  let body: CreateProjectBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const { name, address, totalBudgetMinor, stages, budgetLines, clientRequestId } = body;

  if (!name || name.trim().length === 0) {
    return NextResponse.json({ error: "Название обязательно" }, { status: 400 });
  }

  if (!totalBudgetMinor) {
    return NextResponse.json({ error: "Бюджет обязателен" }, { status: 400 });
  }

  const budgetMinor = parseAmountToMinorUnits(totalBudgetMinor);
  if (budgetMinor === null || budgetMinor <= 0n) {
    return NextResponse.json(
      { error: "Некорректная сумма бюджета. Используйте формат: 1250000.50" },
      { status: 400 },
    );
  }

  if (!stages || stages.length === 0) {
    return NextResponse.json(
      { error: "Нужен хотя бы один этап" },
      { status: 400 },
    );
  }

  if (!budgetLines || budgetLines.length === 0) {
    return NextResponse.json(
      { error: "Нужна хотя бы одна статья бюджета" },
      { status: 400 },
    );
  }

  // Validate weightBp sum = 10000 (100% in basis points)
  const weightSum = stages.reduce((sum, s) => sum + s.weightBp, 0);
  if (weightSum !== 10000) {
    return NextResponse.json(
      { error: `Сумма весов этапов должна быть 10000 (100%), сейчас ${weightSum}. ${weightSum < 10000 ? `Не хватает ${10000 - weightSum}` : `Избыток ${weightSum - 10000}`}` },
      { status: 400 },
    );
  }

  // Validate each stage
  for (const s of stages) {
    if (!s.name || s.name.trim().length === 0) {
      return NextResponse.json({ error: "Имя этапа обязательно" }, { status: 400 });
    }
    if (s.weightBp <= 0 || s.weightBp > 10000) {
      return NextResponse.json(
        { error: `Вес этапа "${s.name}" должен быть от 1 до 10000` },
        { status: 400 },
      );
    }
    if (s.floor < 0) {
      return NextResponse.json(
        { error: `Этаж не может быть отрицательным (этап "${s.name}")` },
        { status: 400 },
      );
    }
  }

  // Validate budget lines
  const seenCategories = new Set<string>();
  for (const bl of budgetLines) {
    if (!bl.category || bl.category.trim().length === 0) {
      return NextResponse.json({ error: "Категория бюджета обязательна" }, { status: 400 });
    }
    if (seenCategories.has(bl.category)) {
      return NextResponse.json(
        { error: `Дубликат категории: "${bl.category}"` },
        { status: 400 },
      );
    }
    seenCategories.add(bl.category);

    const planned = parseAmountToMinorUnits(bl.plannedMinor);
    if (planned === null || planned <= 0n) {
      return NextResponse.json(
        { error: `Некорректная сумма для категории "${bl.category}"` },
        { status: 400 },
      );
    }
  }

  // Idempotency: if clientRequestId is provided, check for existing project
  if (clientRequestId && clientRequestId.trim().length > 0) {
    const existing = await prisma.eventLog.findFirst({
      where: {
        userId: session!.user.id,
        action: "PROJECT_CREATED",
        metadata: {
          path: ["clientRequestId"],
          equals: clientRequestId.trim(),
        },
      },
      select: { entityId: true },
    });
    if (existing) {
      const existingProject = await prisma.project.findUnique({
        where: { id: existing.entityId },
        select: { id: true, name: true },
      });
      if (existingProject) {
        return NextResponse.json(
          { id: existingProject.id, name: existingProject.name, idempotent: true },
          { status: 200 },
        );
      }
    }
  }

  // Create project with stages and budget lines in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        name: name.trim(),
        address: address?.trim() || null,
        totalBudgetMinor: budgetMinor,
      },
    });

    // Add the creator as a member
    await tx.projectMember.create({
      data: {
        projectId: project.id,
        userId: session!.user.id,
        role: session!.user.role as Role,
      },
    });

    // Create stages
    for (const s of stages) {
      await tx.stage.create({
        data: {
          projectId: project.id,
          name: s.name.trim(),
          floor: s.floor,
          weightBp: s.weightBp,
          order: s.order,
        },
      });
    }

    // Create budget lines
    for (const bl of budgetLines) {
      const planned = parseAmountToMinorUnits(bl.plannedMinor)!;
      await tx.budgetLine.create({
        data: {
          projectId: project.id,
          category: bl.category.trim(),
          plannedMinor: planned,
        },
      });
    }

    // Log event
    await tx.eventLog.create({
      data: {
        projectId: project.id,
        userId: session!.user.id,
        action: "PROJECT_CREATED",
        entity: "Project",
        entityId: project.id,
        metadata: {
          name: name.trim(),
          stageCount: stages.length,
          budgetLineCount: budgetLines.length,
          ...(clientRequestId && clientRequestId.trim().length > 0
            ? { clientRequestId: clientRequestId.trim() }
            : {}),
        },
      },
    });

    return project;
  });

  return NextResponse.json({ id: result.id, name: result.name }, { status: 201 });
}

export async function GET() {
  const { session, error } = await requireRole(["OWNER", "ADMIN"] as Role[]);

  if (error) return error;

  const isAdmin = session!.user.role === "ADMIN";

  // ADMIN sees all projects; OWNER sees only their memberships
  const projects = isAdmin
    ? await prisma.project.findMany({
        select: { id: true, name: true, address: true, createdAt: true },
        orderBy: { name: "asc" },
      })
    : await prisma.project.findMany({
        where: { members: { some: { userId: session!.user.id } } },
        select: { id: true, name: true, address: true, createdAt: true },
        orderBy: { name: "asc" },
      });

  const results = await Promise.all(
    projects.map(async (p) => {
      const metrics = await getProjectMetrics(p.id);
      return {
        id: p.id,
        name: p.name,
        address: p.address,
        progressPct: metrics.progressPct,
        moneyPct: metrics.moneyPct,
        flag: metrics.flag,
      };
    }),
  );

  return NextResponse.json({ projects: results });
}
