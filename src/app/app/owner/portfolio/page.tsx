"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface PortfolioProject {
  id: string;
  name: string;
  address: string | null;
  progressPct: number;
  moneyPct: number | null;
  gapPp: number | null;
  flag: "OK" | "WARN" | "DANGER" | "UNKNOWN";
  pendingReviewCount: number;
}

const flagBadge: Record<string, { label: string; color: string; bg: string }> = {
  OK: { label: "В норме", color: "text-emerald-700", bg: "bg-emerald-100" },
  WARN: { label: "Внимание", color: "text-amber-700", bg: "bg-amber-100" },
  DANGER: { label: "Риск", color: "text-red-700", bg: "bg-red-100" },
  UNKNOWN: { label: "Нет данных", color: "text-slate-600", bg: "bg-slate-200" },
};

function formatGap(gap: number | null): string {
  if (gap === null) return "—";
  const sign = gap > 0 ? "+" : "";
  return `${sign}${gap}%`;
}

export default function PortfolioPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/projects/portfolio")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setProjects(data.projects || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("failed to fetch portfolio", err);
        setError("Не удалось загрузить портфель");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F5F4F1]">
        <p className="text-sm text-[#71818b]">Загрузка портфеля…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F5F4F1]">
        <p className="text-sm text-red-600">{error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F4F1] p-6 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center gap-3">
          <Layers className="h-6 w-6 text-[#0E7A6C]" />
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.035em] text-[#102a40]">
              Портфель объектов
            </h1>
            <p className="text-xs text-[#748590]">
              Сортировка: сначала самые рискованные
            </p>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-[20px] bg-white px-6 py-12 text-center text-sm text-[#71818b] shadow-sm">
            Нет доступных объектов
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => {
              const badge = flagBadge[p.flag];
              return (
                <div
                  key={p.id}
                  onClick={() => router.push(`/app/owner/${p.id}`)}
                  className={cn(
                    "group relative cursor-pointer rounded-[18px] border bg-white p-5 shadow-sm transition-all",
                    "hover:border-[#9fcfc7] hover:shadow-[0_8px_24px_rgba(14,122,108,0.08)]",
                    p.flag === "DANGER" && "border-red-200",
                    p.flag === "WARN" && "border-amber-200",
                    p.flag === "OK" && "border-[#e5eae8]",
                    p.flag === "UNKNOWN" && "border-[#e5eae8]",
                  )}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="text-base font-semibold tracking-[-0.015em] text-[#16324a]">
                          {p.name}
                        </h3>
                        {p.pendingReviewCount > 0 && (
                          <span
                            title={`${p.pendingReviewCount} на проверке`}
                            className="inline-flex items-center gap-1 rounded-full bg-[#fff3cd] px-2 py-0.5 text-[10px] font-semibold text-[#856404]"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            {p.pendingReviewCount}
                          </span>
                        )}
                      </div>
                      {p.address && (
                        <p className="truncate text-xs text-[#73838e]">{p.address}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                      <div className="text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#748590]">Готовность</p>
                        <p className="font-mono text-sm font-semibold text-[#16324a]">{p.progressPct}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#748590]">Деньги</p>
                        <p className="font-mono text-sm font-semibold text-[#16324a]">
                          {p.moneyPct === null ? "—" : `${p.moneyPct}%`}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#748590]">Разрыв</p>
                        <p className={cn(
                          "font-mono text-sm font-semibold",
                          (p.gapPp ?? 0) > 8 ? "text-red-600" : (p.gapPp ?? 0) > 0 ? "text-amber-600" : "text-emerald-600",
                        )}>
                          {formatGap(p.gapPp)}
                        </p>
                      </div>
                      <div className={cn("rounded-full px-3 py-1 text-[10px] font-semibold", badge.color, badge.bg)}>
                        {badge.label}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[#e9eeec]">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        p.flag === "DANGER" ? "bg-red-500" : p.flag === "WARN" ? "bg-amber-500" : "bg-[#0E7A6C]",
                      )}
                      style={{ width: `${p.progressPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
