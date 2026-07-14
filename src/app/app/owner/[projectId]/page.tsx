"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { MoneyProgressRace } from "@/components/dashboard/money-progress-race";
import { BuildingSilhouette } from "@/components/dashboard/building-silhouette";

interface FloorProgress {
  floor: number;
  progressPct: number;
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
    <main
      style={{
        flex: 1,
        overflowY: "auto",
        background: "var(--color-bg-alt)",
        padding: "1rem",
        paddingBottom: "3rem",
      }}
    >
      <div style={{ maxWidth: "640px", margin: "0 auto" }}>
        <h1
          style={{
            fontSize: "1.25rem",
            color: "var(--color-navy)",
            marginBottom: "1.5rem",
          }}
        >
          Кабинет заказчика
        </h1>

        {loading ? (
          <p style={{ color: "var(--color-navy)", opacity: 0.5 }}>
            Загрузка...
          </p>
        ) : !summary ? (
          <p style={{ color: "var(--color-navy)", opacity: 0.5 }}>
            Нет данных
          </p>
        ) : (
          <>
            {/* Warning banner */}
            {(summary.flag === "WARN" || summary.flag === "DANGER") && (
              <div
                style={{
                  background: flagColors[summary.flag].bg,
                  color: flagColors[summary.flag].text,
                  borderRadius: "10px",
                  padding: "0.75rem 1rem",
                  marginBottom: "1rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                }}
              >
                {summary.flag === "DANGER"
                  ? "Серьёзное расхождение между деньгами и готовностью"
                  : "Расхождение между деньгами и готовностью"}
                {summary.gapPp !== null && `: ${summary.gapPp > 0 ? "+" : ""}${summary.gapPp}п.п.`}
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
            <div
              style={{
                background: "var(--color-bg)",
                borderRadius: "12px",
                padding: "1rem 1.25rem",
                marginBottom: "1.5rem",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "0.5rem",
                }}
              >
                <span
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--color-navy)",
                    opacity: 0.6,
                  }}
                >
                  Потрачено
                </span>
                <span
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "var(--color-navy)",
                    fontFamily: "monospace",
                  }}
                >
                  {formatMinor(summary.spentMinor)}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--color-navy)",
                    opacity: 0.6,
                  }}
                >
                  Бюджет
                </span>
                <span
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "var(--color-navy)",
                    fontFamily: "monospace",
                  }}
                >
                  {formatMinor(summary.totalBudgetMinor)}
                </span>
              </div>
            </div>

            {/* Building Silhouette */}
            <BuildingSilhouette floors={summary.floors} />

            {/* Event feed */}
            <h2
              style={{
                fontSize: "1rem",
                color: "var(--color-navy)",
                marginBottom: "0.75rem",
              }}
            >
              Последние события
            </h2>
            {events.length === 0 ? (
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "var(--color-navy)",
                  opacity: 0.5,
                }}
              >
                Событий пока нет
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    style={{
                      background: "var(--color-bg)",
                      borderRadius: "10px",
                      padding: "0.625rem 0.875rem",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 500,
                        color: "var(--color-navy)",
                      }}
                    >
                      {ev.actionLabel}
                    </p>
                    <p
                      style={{
                        fontSize: "0.6875rem",
                        color: "var(--color-navy)",
                        opacity: 0.5,
                      }}
                    >
                      {ev.userName} ·{" "}
                      {new Date(ev.createdAt).toLocaleString("ru-RU")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
