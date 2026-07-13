import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatMinor(minor: bigint): string {
  const rubles = minor / 100n;
  const kopecks = minor % 100n;
  return `${rubles}.${kopecks.toString().padStart(2, "0")}`;
}

export async function GET(request: Request) {
  const { session, error } = await requireRole(["OWNER", "ADMIN"] as Role[]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json(
      { error: "Не указан projectId" },
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
    select: { name: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  const expenses = await prisma.expense.findMany({
    where: { projectId },
    include: {
      budgetLine: { select: { category: true } },
    },
    orderBy: { expenseDate: "desc" },
  });

  const header = ["Дата", "Категория", "Описание", "Сумма", "Есть чек"];
  const rows: string[] = [header.map(escapeCsvField).join(",")];

  for (const e of expenses) {
    const dateStr = e.expenseDate.toISOString().slice(0, 10);
    const category = e.budgetLine.category;
    const description = e.description;
    const amount = formatMinor(e.amountMinor);
    const hasReceipt = "нет";

    rows.push(
      [dateStr, category, description, amount, hasReceipt]
        .map(escapeCsvField)
        .join(","),
    );
  }

  const csv = rows.join("\r\n");
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `expenses-${project.name}-${dateStr}.csv`.replace(/\s+/g, "_");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
