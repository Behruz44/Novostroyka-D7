"use client";

import { useState } from "react";
import { Wallet, Receipt, Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IconRail } from "@/components/dashboard/icon-rail";
import { ProjectSwitcher } from "@/components/dashboard/project-switcher";
import type { ProjectSummary } from "@/components/dashboard/project-switcher";
import { TopBar } from "@/components/dashboard/top-bar";
import { WarningBanner } from "@/components/dashboard/warning-banner";

const PROJECTS: ProjectSummary[] = [
  { id: "p1", name: "Паркинг 8 этажей", address: "г. Ташкент, ул. Примерная, 1", progressPct: 47, flag: "WARN" },
  { id: "p2", name: "Sunrise Residence", address: null, progressPct: 12, flag: "OK" },
];

interface BudgetLine {
  id: string;
  category: string;
  plannedMinor: bigint;
  spentMinor: bigint;
}

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amountMinor: bigint;
  receiptKey: string | null;
}

const CATEGORIES = [
  "Бетон и арматура",
  "Работа бригад",
  "Электрика",
  "Сантехника",
  "Леса и опалубка",
  "Прочее",
];

const BUDGET: BudgetLine[] = [
  { id: "b1", category: "Бетон и арматура", plannedMinor: 2_500_000_000n, spentMinor: 1_820_000_000n },
  { id: "b2", category: "Работа бригад", plannedMinor: 1_800_000_000n, spentMinor: 980_000_000n },
  { id: "b3", category: "Электрика", plannedMinor: 650_000_000n, spentMinor: 720_000_000n },
  { id: "b4", category: "Сантехника", plannedMinor: 420_000_000n, spentMinor: 120_000_000n },
  { id: "b5", category: "Леса и опалубка", plannedMinor: 900_000_000n, spentMinor: 640_000_000n },
];

const EXPENSES: Expense[] = [
  { id: "e1", date: "2026-07-10", category: "Бетон и арматура", description: "Бетон В25 для плиты 4-го этажа", amountMinor: 185_000_000n, receiptKey: "/site/concrete-slab.png" },
  { id: "e2", date: "2026-07-09", category: "Работа бригад", description: "Оплата арматурщикам, 2-3 этаж", amountMinor: 96_000_000n, receiptKey: null },
  { id: "e3", date: "2026-07-08", category: "Электрика", description: "Кабель ВВГнг 5x6, щитовое оборудование", amountMinor: 72_000_000n, receiptKey: "/site/columns.png" },
  { id: "e4", date: "2026-07-06", category: "Леса и опалубка", description: "Аренда лесов, 4 недели", amountMinor: 64_000_000n, receiptKey: null },
  { id: "e5", date: "2026-07-05", category: "Бетон и арматура", description: "Арматура А500С, 2 тонны", amountMinor: 118_000_000n, receiptKey: "/site/rebar.png" },
];

function formatMoney(minor: bigint): string {
  const rubles = minor / 100n;
  return rubles.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export default function OwnerExpensesPage() {
  const [expenses] = useState<Expense[]>(EXPENSES);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: "",
    category: CATEGORIES[0],
    amount: "",
    description: "",
  });

  function handleReceiptSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setReceiptPreview(URL.createObjectURL(file));
    e.target.value = "";
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <IconRail active="reports" />
      <ProjectSwitcher projects={PROJECTS} activeId={PROJECTS[0].id} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          name={PROJECTS[0].name}
          address={PROJECTS[0].address}
          progressPct={PROJECTS[0].progressPct}
          moneyPct={61}
          gapPp={-14}
          flag={PROJECTS[0].flag}
          pendingReviewCount={5}
        />
        <WarningBanner flag="WARN" gapPp={-14} />

        <main className="flex-1 overflow-y-auto bg-secondary p-4 lg:p-5">
          <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
            {/* Left: Add expense form */}
            <section className="rounded-lg border border-border bg-panel p-4">
              <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
                <Wallet className="h-4 w-4 text-teal" aria-hidden />
                Добавить расход
              </h2>

              <form className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Дата
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Категория
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Сумма, сум
                  </label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono outline-none focus:border-ring"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Описание
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
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
                      <img src={receiptPreview} alt="Чек" className="h-24 w-full object-contain" />
                    ) : (
                      <>
                        <Upload className="mb-1 h-5 w-5 text-muted-foreground" aria-hidden />
                        <span className="text-xs text-muted-foreground">Загрузить чек</span>
                      </>
                    )}
                    <input type="file" accept="image/*" className="sr-only" onChange={handleReceiptSelect} />
                  </label>
                </div>

                <Button type="button" variant="teal" className="w-full">
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
                  {BUDGET.map((line) => {
                    const remaining = line.plannedMinor - line.spentMinor;
                    const isOver = remaining < 0n;
                    return (
                      <div
                        key={line.id}
                        className="rounded-lg border border-border bg-panel p-4"
                      >
                        <p className="truncate text-sm font-medium text-foreground">{line.category}</p>
                        <div className="mt-2 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Запланировано</span>
                            <span className="font-mono tabular-nums">{formatMoney(line.plannedMinor)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Потрачено</span>
                            <span className="font-mono tabular-nums">{formatMoney(line.spentMinor)}</span>
                          </div>
                          <div className="flex justify-between border-t border-border pt-1">
                            <span className="text-muted-foreground">Остаток</span>
                            <span
                              className={cn(
                                "font-mono font-semibold tabular-nums",
                                isOver ? "text-danger" : "text-teal",
                              )}
                            >
                              {isOver ? "−" : ""}
                              {formatMoney(isOver ? -remaining : remaining)}
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
                  <h2 className="text-sm font-semibold text-foreground">История расходов</h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary text-left">
                        <th className="px-4 py-2 font-medium text-muted-foreground">Дата</th>
                        <th className="px-4 py-2 font-medium text-muted-foreground">Категория</th>
                        <th className="px-4 py-2 font-medium text-muted-foreground">Описание</th>
                        <th className="px-4 py-2 text-right font-medium text-muted-foreground">Сумма</th>
                        <th className="px-4 py-2 text-center font-medium text-muted-foreground">Чек</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {expenses.map((e) => (
                        <tr key={e.id} className="hover:bg-muted/50">
                          <td className="px-4 py-3 font-mono text-xs tabular-nums">{e.date}</td>
                          <td className="px-4 py-3 text-foreground">{e.category}</td>
                          <td className="px-4 py-3 text-muted-foreground">{e.description}</td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums">
                            {formatMoney(e.amountMinor)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {e.receiptKey ? (
                              <a
                                href={e.receiptKey}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary"
                              >
                                <FileText className="h-4 w-4" aria-hidden />
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
