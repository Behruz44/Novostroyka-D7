import { prisma } from "@/lib/db";
import { verifyUploadedSize } from "@/lib/storage";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export interface CreateExpenseInput {
  projectId: string;
  budgetLineId: string;
  stageId?: string | null;
  amountMinor: bigint;
  description: string;
  expenseDate: string;
  receiptPhotoKey?: string;
  clientRequestId: string;
  userId: string;
  userProjectIds: string[];
  userRole: string;
}

export interface CreateExpenseResult {
  ok: boolean;
  status: number;
  data?: Record<string, unknown>;
  error?: string;
}

export function parseAmountToMinorUnits(input: string): bigint | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const negative = trimmed.startsWith("-");
  if (negative) return null;

  const dotIndex = trimmed.indexOf(".");
  const commaIndex = trimmed.indexOf(",");

  let rublesPart: string;
  let kopecksPart: string;

  if (dotIndex !== -1 && commaIndex !== -1) {
    return null;
  } else if (dotIndex !== -1) {
    rublesPart = trimmed.substring(0, dotIndex);
    kopecksPart = trimmed.substring(dotIndex + 1);
  } else if (commaIndex !== -1) {
    rublesPart = trimmed.substring(0, commaIndex);
    kopecksPart = trimmed.substring(commaIndex + 1);
  } else {
    rublesPart = trimmed;
    kopecksPart = "";
  }

  if (rublesPart === "" && kopecksPart === "") return null;

  if (kopecksPart.length > 2) return null;

  kopecksPart = kopecksPart.padEnd(2, "0");

  if (rublesPart === "") rublesPart = "0";

  if (!/^\d+$/.test(rublesPart) || !/^\d+$/.test(kopecksPart)) {
    return null;
  }

  const rubles = BigInt(rublesPart);
  const kopecks = BigInt(kopecksPart);

  return rubles * 100n + kopecks;
}

export async function createExpense(
  input: CreateExpenseInput,
): Promise<CreateExpenseResult> {
  const {
    projectId,
    budgetLineId,
    stageId,
    amountMinor,
    description,
    expenseDate,
    receiptPhotoKey,
    clientRequestId,
    userId,
    userProjectIds,
    userRole,
  } = input;

  if (userRole !== "ADMIN" && !userProjectIds.includes(projectId)) {
    return { ok: false, status: 403, error: "Нет доступа к проекту" };
  }

  if (amountMinor <= 0n) {
    return { ok: false, status: 400, error: "Сумма должна быть больше нуля" };
  }

  if (!description || description.trim().length === 0) {
    return { ok: false, status: 400, error: "Описание обязательно" };
  }

  if (!expenseDate) {
    return { ok: false, status: 400, error: "Дата расхода обязательна" };
  }

  const existing = await prisma.expense.findUnique({
    where: { clientRequestId },
  });

  if (existing) {
    if (existing.projectId !== projectId) {
      return { ok: false, status: 409, error: "Конфликт идентификатора запроса" };
    }
    return {
      ok: true,
      status: 200,
      data: {
        ...existing,
        amountMinor: existing.amountMinor.toString(),
      } as unknown as Record<string, unknown>,
    };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, totalBudgetMinor: true },
  });

  if (!project) {
    return { ok: false, status: 404, error: "Проект не найден" };
  }

  const budgetLine = await prisma.budgetLine.findUnique({
    where: { id: budgetLineId },
    select: { id: true, projectId: true, category: true },
  });

  if (!budgetLine) {
    return { ok: false, status: 400, error: "Статья бюджета не найдена" };
  }

  if (budgetLine.projectId !== projectId) {
    return {
      ok: false,
      status: 400,
      error: "Статья бюджета не принадлежит указанному проекту",
    };
  }

  if (stageId) {
    const stage = await prisma.stage.findUnique({
      where: { id: stageId },
      select: { projectId: true },
    });

    if (!stage) {
      return { ok: false, status: 400, error: "Этап не найден" };
    }

    if (stage.projectId !== projectId) {
      return {
        ok: false,
        status: 400,
        error: "Этап не принадлежит указанному проекту",
      };
    }
  }

  if (amountMinor > project.totalBudgetMinor) {
    return {
      ok: false,
      status: 400,
      error: "Сумма превышает общий бюджет проекта (возможна опечатка)",
    };
  }

  if (receiptPhotoKey) {
    const verification = await verifyUploadedSize(receiptPhotoKey, MAX_FILE_SIZE);
    if (!verification.ok) {
      return {
        ok: false,
        status: 400,
        error: verification.error || "Ошибка проверки файла в хранилище",
      };
    }
  }

  let parsedDate: Date;
  try {
    parsedDate = new Date(expenseDate);
    if (isNaN(parsedDate.getTime())) throw new Error("invalid");
  } catch {
    return { ok: false, status: 400, error: "Некорректная дата" };
  }

  const result = await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        projectId,
        budgetLineId,
        stageId: stageId || null,
        amountMinor,
        description: description.trim(),
        expenseDate: parsedDate,
        createdBy: userId,
        clientRequestId,
      },
    });

    await tx.eventLog.create({
      data: {
        projectId,
        userId,
        action: "EXPENSE_CREATED",
        entity: "Expense",
        entityId: expense.id,
        metadata: {
          budgetLineId,
          amountMinor: amountMinor.toString(),
          description: description.trim(),
          expenseDate: parsedDate.toISOString(),
          receiptPhotoKey: receiptPhotoKey || null,
        },
        clientRequestId,
      },
    });

    return expense;
  });

  return {
    ok: true,
    status: 201,
    data: {
      ...result,
      amountMinor: result.amountMinor.toString(),
    } as unknown as Record<string, unknown>,
  };
}

export async function getExpenses(
  projectId: string,
  budgetLineId?: string,
) {
  const where: Record<string, unknown> = { projectId };
  if (budgetLineId) {
    where.budgetLineId = budgetLineId;
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: {
      budgetLine: {
        select: { id: true, category: true },
      },
      stage: {
        select: { id: true, name: true, floor: true },
      },
    },
    orderBy: { expenseDate: "desc" },
  });

  return expenses.map((e) => ({
    ...e,
    amountMinor: e.amountMinor.toString(),
  }));
}

export async function getBudgetSummary(projectId: string) {
  const budgetLines = await prisma.budgetLine.findMany({
    where: { projectId },
    select: { id: true, category: true, plannedMinor: true },
    orderBy: { category: "asc" },
  });

  const spentByBudgetLine = await prisma.expense.groupBy({
    by: ["budgetLineId"],
    where: { projectId },
    _sum: { amountMinor: true },
  });

  const spentMap = new Map<string, bigint>();
  for (const row of spentByBudgetLine) {
    spentMap.set(row.budgetLineId, row._sum.amountMinor ?? 0n);
  }

  return budgetLines.map((bl) => {
    const spent = spentMap.get(bl.id) ?? 0n;
    return {
      id: bl.id,
      category: bl.category,
      plannedMinor: bl.plannedMinor.toString(),
      spentMinor: spent.toString(),
      remainingMinor: (bl.plannedMinor - spent).toString(),
    };
  });
}
