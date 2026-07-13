"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";

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

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "var(--color-bg)",
        borderRadius: "12px",
        padding: "1rem 1.25rem",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <p
        style={{
          fontSize: "0.75rem",
          color: "var(--color-navy)",
          opacity: 0.6,
          marginBottom: "0.375rem",
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: "1.5rem",
          fontWeight: 600,
          color,
          lineHeight: 1.2,
        }}
      >
        {value}
      </p>
    </div>
  );
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

            {/* 4 metric cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
                marginBottom: "1.5rem",
              }}
            >
              <MetricCard
                label="Готовность"
                value={`${summary.progressPct}%`}
                color="var(--color-teal)"
              />
              <MetricCard
                label="Деньги"
                value={summary.moneyPct === null ? "—" : `${summary.moneyPct}%`}
                color="var(--color-navy)"
              />
              <MetricCard
                label="Расхождение"
                value={
                  summary.gapPp === null
                    ? "—"
                    : `${summary.gapPp > 0 ? "+" : ""}${summary.gapPp}п.п.`
                }
                color={flagColors[summary.flag].bg}
              />
              <MetricCard
                label="На проверке"
                value={`${summary.pendingReviewCount}`}
                color="var(--color-gold)"
              />
            </div>

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

            {/* Floor pyramid */}
            <h2
              style={{
                fontSize: "1rem",
                color: "var(--color-navy)",
                marginBottom: "0.75rem",
              }}
            >
              Этажи
            </h2>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                marginBottom: "1.5rem",
              }}
            >
              {summary.floors.map((f) => (
                <div
                  key={f.floor}
                  style={{
                    background: "var(--color-bg)",
                    borderRadius: "10px",
                    padding: "0.625rem 0.875rem",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "0.375rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 500,
                        color: "var(--color-navy)",
                      }}
                    >
                      {f.floor === 0 ? "Общее" : `Этаж ${f.floor}`}
                    </span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--color-navy)",
                        opacity: 0.6,
                      }}
                    >
                      {f.progressPct}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: "6px",
                      background: "var(--color-bg-alt)",
                      borderRadius: "3px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${f.progressPct}%`,
                        height: "100%",
                        background: "var(--color-teal)",
                        borderRadius: "3px",
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

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
