import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";
import {
  createExpense,
  getExpenses,
  parseAmountToMinorUnits,
} from "@/lib/services/expenses";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface CreateBody {
  projectId?: string;
  budgetLineId?: string;
  stageId?: string | null;
  amountMinor?: string;
  description?: string;
  expenseDate?: string;
  receiptPhotoKey?: string;
  clientRequestId?: string;
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

  const {
    projectId,
    budgetLineId,
    stageId,
    amountMinor,
    description,
    expenseDate,
    receiptPhotoKey,
    clientRequestId,
  } = body;

  if (!projectId || !budgetLineId || !clientRequestId || !expenseDate) {
    return NextResponse.json(
      { error: "Не указаны projectId, budgetLineId, clientRequestId или expenseDate" },
      { status: 400 },
    );
  }

  if (!description || description.trim().length === 0) {
    return NextResponse.json(
      { error: "Описание обязательно" },
      { status: 400 },
    );
  }

  const amountMinorBigInt = parseAmountToMinorUnits(amountMinor ?? "");
  if (amountMinorBigInt === null) {
    return NextResponse.json(
      { error: "Некорректная сумма. Используйте формат: 1250.50" },
      { status: 400 },
    );
  }

  const result = await createExpense({
    projectId,
    budgetLineId,
    stageId: stageId || null,
    amountMinor: amountMinorBigInt,
    description,
    expenseDate,
    receiptPhotoKey,
    clientRequestId,
    userId: session!.user.id,
    userProjectIds: session!.user.projectIds,
    userRole: session!.user.role,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data, { status: result.status });
}

export async function GET(request: Request) {
  const { session, error } = await requireRole(["OWNER", "ADMIN"] as Role[]);

  if (error) return error;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const budgetLineId = searchParams.get("budgetLineId");
  const category = searchParams.get("category");

  if (!projectId) {
    return NextResponse.json(
      { error: "Не указан projectId" },
      { status: 400 },
    );
  }

  if (session!.user.role !== "ADMIN" && !session!.user.projectIds.includes(projectId)) {
    return NextResponse.json({ error: "Нет доступа к проекту" }, { status: 403 });
  }

  let filterBudgetLineId: string | undefined = budgetLineId ?? undefined;

  if (category) {
    const bl = await prisma.budgetLine.findFirst({
      where: { projectId, category },
      select: { id: true },
    });
    if (!bl) {
      return NextResponse.json(
        { error: `Категория "${category}" не найдена в проекте` },
        { status: 400 },
      );
    }
    filterBudgetLineId = bl.id;
  }

  const expenses = await getExpenses(projectId, filterBudgetLineId);

  return NextResponse.json({ expenses });
}
