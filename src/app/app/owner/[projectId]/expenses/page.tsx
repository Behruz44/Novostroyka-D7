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
      <header className="border-b border-[#dce3e1] bg-white px-5 py-4 shadow-[var(--shadow-sm)] sm:px-7">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-[22px] font-semibold tracking-[-0.04em] text-[#102a40]">Расходы</h1>
          {summary && (
            <div className="flex items-center gap-5 text-[13px]">
              <span className="text-[#71818b]">
                Готовность:{" "}
                <span className="font-mono font-semibold text-[#096157]">
                  {summary.progressPct}%
                </span>
              </span>
              <span className="text-[#71818b]">
                Деньги:{" "}
                <span className="font-mono font-semibold text-[#102a40]">
                  {summary.moneyPct === null ? "—" : `${summary.moneyPct}%`}
                </span>
              </span>
              <span className="text-[#71818b]">
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

      <main className="premium-page flex-1 overflow-y-auto px-4 pb-14 pt-6 sm:px-6 lg:px-8">
        {loading ? (
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        ) : (
          <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-5 lg:grid-cols-[380px_1fr]">
            {/* Left: Add expense form */}
            <section className="premium-surface rounded-[18px] p-5">
              <h2 className="mb-5 flex items-center gap-2 text-[18px] font-semibold tracking-[-0.03em] text-[#102a40]">
                <span className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-[#d5e7e3] bg-[#effaf7] text-[#096157] shadow-[inset_0_1px_0_white]">
                  <Wallet className="h-4 w-4" aria-hidden />
                </span>
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
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#748590]">
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
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#748590]">
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
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#748590]">
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
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#748590]">
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
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#748590]">
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
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#748590]">
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
                <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#748590]">
                  Бюджет по категориям
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {budgetLines.map((line) => {
                    const remaining = BigInt(line.remainingMinor);
                    const isOver = remaining < 0n;
                    return (
                      <div
                        key={line.id}
                        className="premium-surface premium-surface-interactive rounded-[14px] p-4"
                      >
                        <p className="truncate text-[13px] font-semibold tracking-[-0.01em] text-[#16324a]">
                          {line.category}
                        </p>
                        <div className="mt-2.5 space-y-1.5 text-[13px]">
                          <div className="flex justify-between">
                            <span className="text-[#71818b]">
                              Запланировано
                            </span>
                            <span className="font-mono tabular-nums text-[#506773]">
                              {formatMoney(line.plannedMinor)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#71818b]">
                              Потрачено
                            </span>
                            <span className="font-mono tabular-nums text-[#506773]">
                              {formatMoney(line.spentMinor)}
                            </span>
                          </div>
                          <div className="flex justify-between border-t border-[#e8edeb] pt-1.5">
                            <span className="text-[#71818b]">
                              Остаток
                            </span>
                            <span
                              className={cn(
                                "font-mono text-[18px] font-semibold tabular-nums tracking-[-0.02em]",
                                isOver ? "text-[#c0392b]" : "text-[#096157]",
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

              <section className="premium-surface overflow-hidden rounded-[18px]">
                <div className="flex items-center gap-2.5 border-b border-[#e5eae8] px-5 py-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-[#d5e7e3] bg-[#effaf7] text-[#096157] shadow-[inset_0_1px_0_white]">
                    <Receipt className="h-4 w-4" aria-hidden />
                  </span>
                  <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-[#102a40]">
                    История расходов
                  </h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#e5eae8] bg-[#f7f9f8] text-left">
                        <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#748590]">
                          Дата
                        </th>
                        <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#748590]">
                          Категория
                        </th>
                        <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#748590]">
                          Описание
                        </th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-[#748590]">
                          Сумма
                        </th>
                        <th className="px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-[#748590]">
                          Чек
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf1ef]">
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
                          <tr key={e.id} className="transition-colors hover:bg-[#f7f9f8]">
                            <td className="px-4 py-3 font-mono text-[11px] tabular-nums text-[#506773]">
                              {new Date(e.expenseDate).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </td>
                            <td className="px-4 py-3 text-[13px] font-medium text-[#16324a]">
                              {e.budgetLine?.category ?? "—"}
                              {e.stage && (
                                <span className="text-[#71818b]">
                                  {" · "}
                                  {e.stage.name}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-[13px] text-[#71818b]">
                              {e.description}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-[14px] font-semibold tabular-nums text-[#102a40]">
                              {formatMoney(e.amountMinor)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {e.receiptPhotoKey ? (
                                <a
                                  href={e.receiptPhotoKey}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#dfe7e4] bg-[#f3f7f5] text-[#506773] transition-colors hover:bg-[#e9eeec]"
                                >
                                  <FileText className="h-4 w-4" aria-hidden />
                                </a>
                              ) : (
                                <span className="text-xs text-[#9aa7ad]">
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
