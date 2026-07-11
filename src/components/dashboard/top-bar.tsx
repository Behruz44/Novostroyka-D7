import { MapPin, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectTopBarProps {
  name: string;
  address?: string | null;
  progressPct: number;
  moneyPct: number | null;
  gapPp: number | null;
  flag: "OK" | "WARN" | "DANGER" | "UNKNOWN";
  pendingReviewCount: number;
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "teal" | "gold" | "danger";
}) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono text-lg font-semibold leading-tight tabular-nums",
          tone === "teal" && "text-teal",
          tone === "gold" && "text-gold",
          tone === "danger" && "text-danger",
          tone === "default" && "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function TopBar({
  name,
  address,
  progressPct,
  moneyPct,
  gapPp,
  flag,
  pendingReviewCount,
}: ProjectTopBarProps) {
  const gapTone = flag === "OK" ? "teal" : flag === "WARN" ? "gold" : "danger";
  const gapValue =
    gapPp !== null && gapPp !== undefined ? `${gapPp > 0 ? "+" : ""}${gapPp} п.п.` : "—";

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-panel px-5 py-3">
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold text-foreground">{name}</h1>
        {address && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {address}
          </p>
        )}
      </div>

      <div className="flex items-center gap-5">
        <Metric label="Готовность" value={`${progressPct}%`} tone="teal" />
        <div className="h-8 w-px bg-border" aria-hidden />
        <Metric label="Деньги" value={`${moneyPct ?? 0}%`} />
        <div className="h-8 w-px bg-border" aria-hidden />
        <Metric label="Расхождение" value={gapValue} tone={gapTone} />
        <div className="h-8 w-px bg-border" aria-hidden />
        <Metric label="На проверке" value={String(pendingReviewCount)} tone="gold" />

        <button
          aria-label="Уведомления"
          className="relative ml-1 flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary"
        >
          <Bell className="h-[18px] w-[18px]" aria-hidden />
          {pendingReviewCount > 0 && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" aria-hidden />
          )}
        </button>
      </div>
    </header>
  );
}
