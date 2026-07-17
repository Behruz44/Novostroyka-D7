"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Wallet, Receipt, Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BudgetLine {
  id: string;
  category: string;
  plannedMinor: string;
  spentMinor: string;
  remainingMinor: string;
}

interface Stage {
  stageId: string;
  stageName: string;
  floor: number;
  totalSpent: string;
}

interface Expense {
  id: string;
  expenseDate: string;
  budgetLine: { category: string } | null;
  stage: { id: string; name: string; floor: number } | null;
  description: string;
  amountMinor: string;
  receiptPhotoKey: string | null;
}

interface ProjectSummary {
  progressPct: number;
  moneyPct: number | null;
  gapPp: number | null;
  flag: "OK" | "WARN" | "DANGER" | "UNKNOWN";
  pendingReviewCount: number;
}

function formatMoney(minorStr: string): string {
  const n = BigInt(minorStr);
  const rubles = n / 100n;
  return rubles.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export default function OwnerExpensesPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: "",
    category: "",
    stageId: "",
    amount: "",
    description: "",
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [budgetRes, expRes, sumRes, stagesRes] = await Promise.all([
        fetch(`/api/budget-summary?projectId=${projectId}`),
        fetch(`/api/expenses?projectId=${projectId}`),
        fetch(`/api/projects/${projectId}/summary`),
        fetch(`/api/projects/${projectId}/spending-by-stage?includeAll=true`),
      ]);
      if (budgetRes.ok) {
        const bd = await budgetRes.json();
        setBudgetLines(bd.budgetLines || []);
      }
      if (expRes.ok) {
        const ed = await expRes.json();
        setExpenses(ed.expenses || []);
      }
      if (sumRes.ok) {
        setSummary(await sumRes.json());
      }
      if (stagesRes.ok) {
        const sd = await stagesRes.json();
        setStages(sd.stages || []);
      }
    } catch (err) {
      console.error("expenses fetch failed", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function handleReceiptSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setReceiptPreview(URL.createObjectURL(file));
    e.target.value = "";
  }

  async function handleSubmitExpense() {
    if (!form.date || !form.category || !form.amount || !form.description.trim()) {
      return;
    }
    const bl = budgetLines.find((b) => b.category === form.category);
    if (!bl) return;

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          budgetLineId: bl.id,
          stageId: form.stageId || undefined,
          amountMinor: form.amount,
          description: form.description,
          expenseDate: form.date,
          clientRequestId: crypto.randomUUID(),
        }),
      });
      if (res.ok) {
        setForm({ date: "", category: "", stageId: "", amount: "", description: "" });
        setReceiptPreview(null);
        fetchAll();
      }
    } catch (err) {
      console.error("create expense failed", err);
    }
  }

  const flagColor =
    summary?.flag === "DANGER"
      ? "text-danger"
      : summary?.flag === "WARN"
        ? "text-gold"
        : "text-teal";

  return (
    <>
      {/* Header with project metrics */}
      <header className="border-b border-border bg-panel px-5 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-base font-semibold text-foreground">Расходы</h1>
          {summary && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                Готовность:{" "}
                <span className="font-mono font-semibold text-teal">
                  {summary.progressPct}%
                </span>
              </span>
              <span className="text-muted-foreground">
                Деньги:{" "}
                <span className="font-mono font-semibold text-foreground">
                  {summary.moneyPct === null ? "—" : `${summary.moneyPct}%`}
                </span>
              </span>
              <span className="text-muted-foreground">
                Расхождение:{" "}
                <span className={cn("font-mono font-semibold", flagColor)}>
                  {summary.gapPp === null
                    ? "—"
                    : `${summary.gapPp > 0 ? "+" : ""}${summary.gapPp}п.п.`}
                </span>
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-secondary p-4 lg:p-5">
        {loading ? (
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        ) : (
          <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
            {/* Left: Add expense form */}
            <section className="rounded-lg border border-border bg-panel p-4">
              <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
                <Wallet className="h-4 w-4 text-teal" aria-hidden />
                Добавить расход
              </h2>

              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmitExpense();
                }}
              >
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Дата
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, date: e.target.value }))
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Категория
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, category: e.target.value }))
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  >
                    <option value="">— Выберите категорию —</option>
                    {budgetLines.map((b) => (
                      <option key={b.id} value={b.category}>
                        {b.category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Этап (необязательно)
                  </label>
                  <select
                    value={form.stageId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, stageId: e.target.value }))
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  >
                    <option value="">— Без привязки к этапу —</option>
                    {Object.entries(
                      stages.reduce<Record<string, Stage[]>>((acc, s) => {
                        const key = `Этаж ${s.floor}`;
                        (acc[key] ||= []).push(s);
                        return acc;
                      }, {}),
                    ).map(([floorLabel, floorStages]) => (
                      <optgroup key={floorLabel} label={floorLabel}>
                        {floorStages.map((s) => (
                          <option key={s.stageId} value={s.stageId}>
                            {s.stageName}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Сумма, сум
                  </label>
                  <input
                    type="text"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, amount: e.target.value }))
                    }
                    placeholder="0.00"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono outline-none focus:border-ring"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Описание
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    rows={3}
                    placeholder="На что потрачено..."
                    className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Чек (необязательно)
                  </label>
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-input bg-background px-4 py-4 text-center transition-colors hover:border-ring hover:bg-muted">
                    {receiptPreview ? (
                      <img
                        src={receiptPreview}
                        alt="Чек"
                        className="h-24 w-full object-contain"
                      />
                    ) : (
                      <>
                        <Upload
                          className="mb-1 h-5 w-5 text-muted-foreground"
                          aria-hidden
                        />
                        <span className="text-xs text-muted-foreground">
                          Загрузить чек
                        </span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleReceiptSelect}
                    />
                  </label>
                </div>

                <Button type="submit" variant="teal" className="w-full">
                  Сохранить расход
                </Button>
              </form>
            </section>

            {/* Right: Budget summary + expenses table */}
            <div className="space-y-4">
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Бюджет по категориям
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {budgetLines.map((line) => {
                    const remaining = BigInt(line.remainingMinor);
                    const isOver = remaining < 0n;
                    return (
                      <div
                        key={line.id}
                        className="rounded-lg border border-border bg-panel p-4"
                      >
                        <p className="truncate text-sm font-medium text-foreground">
                          {line.category}
                        </p>
                        <div className="mt-2 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Запланировано
                            </span>
                            <span className="font-mono tabular-nums">
                              {formatMoney(line.plannedMinor)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Потрачено
                            </span>
                            <span className="font-mono tabular-nums">
                              {formatMoney(line.spentMinor)}
                            </span>
                          </div>
                          <div className="flex justify-between border-t border-border pt-1">
                            <span className="text-muted-foreground">
                              Остаток
                            </span>
                            <span
                              className={cn(
                                "font-mono font-semibold tabular-nums",
                                isOver ? "text-danger" : "text-teal",
                              )}
                            >
                              {isOver ? "−" : ""}
                              {formatMoney(
                                isOver ? (-remaining).toString() : line.remainingMinor,
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-lg border border-border bg-panel">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <Receipt className="h-4 w-4 text-teal" aria-hidden />
                  <h2 className="text-sm font-semibold text-foreground">
                    История расходов
                  </h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary text-left">
                        <th className="px-4 py-2 font-medium text-muted-foreground">
                          Дата
                        </th>
                        <th className="px-4 py-2 font-medium text-muted-foreground">
                          Категория
                        </th>
                        <th className="px-4 py-2 font-medium text-muted-foreground">
                          Описание
                        </th>
                        <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                          Сумма
                        </th>
                        <th className="px-4 py-2 text-center font-medium text-muted-foreground">
                          Чек
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {expenses.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-6 text-center text-muted-foreground"
                          >
                            Расходов пока нет
                          </td>
                        </tr>
                      ) : (
                        expenses.map((e) => (
                          <tr key={e.id} className="hover:bg-muted/50">
                            <td className="px-4 py-3 font-mono text-xs tabular-nums">
                              {new Date(e.expenseDate).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </td>
                            <td className="px-4 py-3 text-foreground">
                              {e.budgetLine?.category ?? "—"}
                              {e.stage && (
                                <span className="text-muted-foreground">
                                  {" · "}
                                  {e.stage.name}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {e.description}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums">
                              {formatMoney(e.amountMinor)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {e.receiptPhotoKey ? (
                                <a
                                  href={e.receiptPhotoKey}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary"
                                >
                                  <FileText className="h-4 w-4" aria-hidden />
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  —
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
