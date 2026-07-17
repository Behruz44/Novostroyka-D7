"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { Activity, AlertTriangle, ArrowUpRight, Clock3, WalletCards } from "lucide-react";
import { MoneyProgressRace } from "@/components/dashboard/money-progress-race";
import { BuildingSilhouette } from "@/components/dashboard/building-silhouette";

interface FloorProgress {
  floor: number;
  progressPct: number;
}

interface StageScheduleInfo {
  id: string;
  name: string;
  floor: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  scheduleStatus: "ON_TRACK" | "AT_RISK" | "LATE" | "NO_PLAN";
}

interface ProjectSummary {
  progressPct: number;
  moneyPct: number | null;
  gapPp: number | null;
  flag: "OK" | "WARN" | "DANGER" | "UNKNOWN";
  pendingReviewCount: number;
  totalBudgetMinor: string;
  spentMinor: string;
  doneWeightBp: number;
  totalWeightBp: number;
  floors: FloorProgress[];
  stages: StageScheduleInfo[];
  criticalStages: number;
}

interface ProjectEvent {
  id: string;
  actionLabel: string;
  userName: string;
  createdAt: string;
}

function formatMinor(minor: string): string {
  const n = BigInt(minor);
  const rubles = n / 100n;
  const kopecks = n % 100n;
  const kopecksStr = kopecks.toString().padStart(2, "0");
  return `${rubles}.${kopecksStr}`;
}

const flagColors: Record<string, { bg: string; text: string; dot: string }> = {
  OK: { bg: "var(--color-teal)", text: "#fff", dot: "var(--color-teal)" },
  WARN: { bg: "var(--color-gold)", text: "#fff", dot: "var(--color-gold)" },
  DANGER: { bg: "var(--color-danger)", text: "#fff", dot: "var(--color-danger)" },
  UNKNOWN: { bg: "#9ca3af", text: "#fff", dot: "#9ca3af" },
};

export default function OwnerDashboardPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [events, setEvents] = useState<ProjectEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, evRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/summary`),
        fetch(`/api/projects/${projectId}/events?limit=30`),
      ]);
      if (sumRes.ok) setSummary(await sumRes.json());
      if (evRes.ok) {
        const evData = await evRes.json();
        setEvents(evData.events);
      }
    } catch (err) {
      console.error("owner dashboard fetch failed", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return (
    <main className="premium-page flex-1 overflow-y-auto px-4 pb-14 pt-5 sm:px-6 lg:px-8 lg:pt-7">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-6 overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(118deg,#102a40_0%,#14394e_58%,#0a514a_100%)] px-6 py-6 text-white shadow-[0_1px_2px_rgba(9,29,45,0.2),0_18px_38px_rgba(9,29,45,0.16)] sm:px-8 sm:py-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8fd9ce]">
                <Activity className="h-3.5 w-3.5" aria-hidden />
                Операционный обзор
              </div>
              <h1 className="text-[30px] font-semibold leading-none tracking-[-0.045em] sm:text-[38px]">
                Кабинет заказчика
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#b9c9d3]">
                Финансовая динамика, фактическая готовность и контроль строительных этапов
              </p>
            </div>
            {!loading && summary && (
              <div className="flex items-center gap-3 rounded-[14px] border border-white/10 bg-white/[0.065] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <span
                  className="h-2.5 w-2.5 rounded-full shadow-[0_0_12px_currentColor]"
                  style={{ color: flagColors[summary.flag].dot, background: flagColors[summary.flag].dot }}
                />
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#8fa7b6]">Статус проекта</p>
                  <p className="mt-0.5 text-sm font-semibold text-white">
                    {summary.flag === "OK" ? "В пределах плана" : summary.flag === "UNKNOWN" ? "Недостаточно данных" : "Требует внимания"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="premium-surface rounded-[20px] px-6 py-12 text-sm text-[#71818b]">Загрузка данных...</div>
        ) : !summary ? (
          <div className="premium-surface rounded-[20px] px-6 py-12 text-sm text-[#71818b]">Нет данных</div>
        ) : (
          <>
            {/* Warning banner */}
            {(summary.flag === "WARN" || summary.flag === "DANGER") && (
              <div
                className="mb-5 flex items-center gap-3 rounded-[16px] border px-4 py-3.5 shadow-[0_1px_1px_rgba(9,29,45,0.04)]"
                style={{
                  borderColor: summary.flag === "DANGER" ? "#efc4be" : "#ead39c",
                  background: summary.flag === "DANGER" ? "#fdf1ef" : "#fdf8ea",
                  color: summary.flag === "DANGER" ? "#8f2e23" : "#805311",
                }}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white shadow-[0_1px_1px_rgba(9,29,45,0.08),0_4px_10px_rgba(9,29,45,0.06)]">
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-70">Контроль отклонения</p>
                  <p className="mt-0.5 text-sm font-semibold">
                    {summary.flag === "DANGER"
                      ? "Серьёзное расхождение между деньгами и готовностью"
                      : "Расхождение между деньгами и готовностью"}
                    {summary.gapPp !== null && `: ${summary.gapPp > 0 ? "+" : ""}${summary.gapPp} п.п.`}
                  </p>
                </div>
              </div>
            )}

            {/* Critical stages banner */}
            {summary.criticalStages > 0 && (
              <div className="mb-5 flex items-center gap-3 rounded-[16px] border border-[#efc4be] bg-[#fdf1ef] px-4 py-3.5 text-[#8f2e23] shadow-[0_1px_1px_rgba(9,29,45,0.04)]">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white shadow-[0_1px_1px_rgba(9,29,45,0.08),0_4px_10px_rgba(9,29,45,0.06)]">
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-70">Критическая комбинация</p>
                  <p className="mt-0.5 text-sm font-semibold">
                    {summary.criticalStages === 1
                      ? "1 этап с опозданием в проекте с перерасходом"
                      : `${summary.criticalStages} этапа(ов) с опозданием в проекте с перерасходом`}
                  </p>
                </div>
              </div>
            )}

            {/* Money vs Progress Race */}
            <MoneyProgressRace
              progressPct={summary.progressPct}
              moneyPct={summary.moneyPct}
              gapPp={summary.gapPp}
              flag={summary.flag}
              pendingReviewCount={summary.pendingReviewCount}
            />

            {/* Money detail */}
            <div className="mb-7 grid gap-4 sm:grid-cols-2">
              <div className="premium-surface premium-surface-interactive rounded-[18px] p-5">
                <div className="mb-5 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-[#d8e8e4] bg-[#effaf7] text-[#096157] shadow-[inset_0_1px_0_white]">
                    <WalletCards className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-[#93a39d]" aria-hidden />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#748590]">Освоено средств</p>
                <p className="mt-2 break-all font-mono text-[25px] font-semibold leading-none tracking-[-0.05em] text-[#102a40] sm:text-[30px]">
                  {formatMinor(summary.spentMinor)}
                </p>
                <p className="mt-3 text-xs text-[#71818b]">Фактические расходы по проекту</p>
              </div>
              <div className="premium-surface premium-surface-interactive rounded-[18px] p-5">
                <div className="mb-5 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-[#eadbb4] bg-[#fdf8ea] text-[#956515] shadow-[inset_0_1px_0_white]">
                    <WalletCards className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <span className="rounded-full bg-[#f4f6f5] px-2.5 py-1 font-mono text-[10px] font-semibold text-[#627482]">100%</span>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#748590]">Общий бюджет</p>
                <p className="mt-2 break-all font-mono text-[25px] font-semibold leading-none tracking-[-0.05em] text-[#102a40] sm:text-[30px]">
                  {formatMinor(summary.totalBudgetMinor)}
                </p>
                <p className="mt-3 text-xs text-[#71818b]">Утверждённый лимит проекта</p>
              </div>
            </div>

            <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1.06fr)_minmax(360px,0.94fr)]">
              {/* Building Silhouette */}
              <BuildingSilhouette floors={summary.floors} stages={summary.stages} />

              <section className="premium-surface overflow-hidden rounded-[22px]">
                <div className="flex items-center justify-between border-b border-[#e5eae8] px-6 py-5">
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#748590]">Журнал проекта</p>
                    {/* Event feed */}
                    <h2 className="text-xl font-semibold tracking-[-0.035em] text-[#102a40]">Последние события</h2>
                  </div>
                  <span className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-[#dfe7e4] bg-[#f3f7f5] text-[#506773]">
                    <Clock3 className="h-4 w-4" aria-hidden />
                  </span>
                </div>
                {events.length === 0 ? (
                  <p className="px-6 py-10 text-sm text-[#71818b]">Событий пока нет</p>
                ) : (
                  <div className="max-h-[560px] overflow-y-auto px-6 py-2">
                    {events.map((ev, index) => (
                      <div key={ev.id} className="relative flex gap-4 border-b border-[#edf1ef] py-4 last:border-0">
                        <div className="relative flex w-3 shrink-0 justify-center pt-1.5">
                          <span className="relative z-10 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#149181] shadow-[0_0_0_1px_#a9d8d0,0_2px_6px_rgba(14,122,108,0.25)]" />
                          {index < events.length - 1 && <span className="absolute left-1/2 top-5 h-[calc(100%+16px)] w-px -translate-x-1/2 bg-[#dce6e3]" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold leading-snug text-[#16324a]">{ev.actionLabel}</p>
                          <p className="mt-1.5 text-[11px] leading-relaxed text-[#71818b]">
                            <span className="font-medium text-[#506773]">{ev.userName}</span> · {new Date(ev.createdAt).toLocaleString("ru-RU")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
