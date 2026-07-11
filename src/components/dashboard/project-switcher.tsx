import { cn } from "@/lib/utils";

export interface ProjectSummary {
  id: string;
  name: string;
  address: string | null;
  progressPct: number;
  flag: "OK" | "WARN" | "DANGER" | "UNKNOWN";
}

interface ProjectSwitcherProps {
  projects: ProjectSummary[];
  activeId: string;
}

const flagDot: Record<ProjectSummary["flag"], string> = {
  OK: "bg-teal",
  WARN: "bg-gold",
  DANGER: "bg-danger",
  UNKNOWN: "bg-muted-foreground",
};

export function ProjectSwitcher({ projects, activeId }: ProjectSwitcherProps) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-panel md:flex">
      <div className="border-b border-border px-4 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Объекты</p>
      </div>
      <div className="flex flex-col gap-1 p-2">
        {projects.map((p) => {
          const isActive = p.id === activeId;
          return (
            <button
              key={p.id}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "flex flex-col gap-2 rounded-md border px-3 py-2.5 text-left transition-colors",
                isActive
                  ? "border-teal/40 bg-accent"
                  : "border-transparent hover:border-border hover:bg-secondary",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium leading-tight text-foreground">{p.name}</span>
                <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", flagDot[p.flag])} aria-hidden />
              </div>
              {p.address && (
                <p className="truncate text-[11px] text-muted-foreground">{p.address}</p>
              )}
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn("h-full rounded-full", isActive ? "bg-teal" : "bg-muted-foreground/50")}
                    style={{ width: `${p.progressPct}%` }}
                  />
                </div>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{p.progressPct}%</span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
