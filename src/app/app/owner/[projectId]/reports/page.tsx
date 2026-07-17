"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Download, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HistoryPoint {
  date: string;
  progressPct: number;
  moneyPct: number | null;
  gapPp: number | null;
}

interface EventItem {
  id: string;
  action: string;
  actionLabel: string;
  entity: string;
  entityId: string;
  userName: string;
  createdAt: string;
}

interface SpendingByStage {
  stageId: string;
  stageName: string;
  floor: number;
  totalSpent: string;
}

const ACTION_OPTIONS = [
  { value: "", label: "Все события" },
  { value: "MARK_APPROVED", label: "Этап одобрен" },
  { value: "MARK_REJECTED", label: "Этап отклонён" },
  { value: "MARK_SUBMITTED", label: "Метка отправлена" },
  { value: "DOWNTIME_REPORTED", label: "Простой" },
  { value: "EXPENSE_CREATED", label: "Расход добавлен" },
  { value: "PROJECT_CREATED", label: "Проект создан" },
];

function formatMoney(minorStr: string): string {
  const n = BigInt(minorStr);
  const rubles = n / 100n;
  return rubles.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export default function ReportsPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [spendingByStage, setSpendingByStage] = useState<SpendingByStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [actionFilter, setActionFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/projects/${projectId}/history?days=30`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/events?limit=100`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/spending-by-stage`).then((r) => r.json()),
    ])
      .then(([hData, eData, sData]) => {
        if (hData.history) setHistory(hData.history);
        if (eData.events) setEvents(eData.events);
        if (sData.stages) setSpendingByStage(sData.stages);
      })
      .catch(() => setError("Ошибка загрузки данных"))
      .finally(() => setLoading(false));
  }, [projectId]);

  function applyFilters() {
    const params = new URLSearchParams({ limit: "100" });
    if (actionFilter) params.set("action", actionFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);

    fetch(`/api/projects/${projectId}/events?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.events) setEvents(data.events);
      })
      .catch(() => setError("Ошибка фильтрации событий"));
  }

  function downloadCsv() {
    window.location.href = `/api/expenses/export?projectId=${projectId}`;
  }

  const chartData = useMemo(
    () =>
      history.map((h) => ({
        date: h.date.slice(5),
        Готовность: h.progressPct,
        Деньги: h.moneyPct,
      })),
    [history],
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-panel px-5 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold text-foreground">Отчёты</h1>
          <Button variant="outline" size="sm" onClick={downloadCsv}>
            <Download className="h-3.5 w-3.5" />
            Экспорт расходов в CSV
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 lg:p-5">
        <div className="mx-auto max-w-[900px] space-y-6">
          {error && (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          {/* Chart */}
          <section className="rounded-lg border border-border bg-panel p-4">
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              Готовность vs Деньги (30 дней)
            </h2>
            {loading ? (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                Загрузка...
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                Нет данных для графика
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-panel)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Line
                    type="monotone"
                    dataKey="Готовность"
                    stroke="var(--color-teal)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Деньги"
                    stroke="var(--color-gold)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </section>

          {/* Spending by stage */}
          <section className="rounded-lg border border-border bg-panel p-4">
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              Расходы по этапам
            </h2>
            {spendingByStage.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Нет расходов с привязкой к этапам
              </p>
            ) : (
              <div className="space-y-2">
                {spendingByStage.map((s) => (
                  <div
                    key={s.stageId}
                    className="flex items-center justify-between rounded-md border border-border bg-secondary px-3 py-2"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">
                        {s.stageName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Этаж {s.floor}
                      </span>
                    </div>
                    <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                      {formatMoney(s.totalSpent)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Events with filters */}
          <section className="rounded-lg border border-border bg-panel p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Лента событий</h2>
              <Filter className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Filters */}
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Тип события
                </label>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                >
                  {ACTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  С
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  По
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                />
              </div>
              <Button variant="teal" size="sm" onClick={applyFilters}>
                Применить
              </Button>
            </div>

            {/* Events list */}
            <div className="space-y-2">
              {events.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Нет событий
                </p>
              ) : (
                events.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between rounded-md border border-border bg-secondary px-3 py-2"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">
                        {e.actionLabel}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {e.userName} · {new Date(e.createdAt).toLocaleString("ru-RU")}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
