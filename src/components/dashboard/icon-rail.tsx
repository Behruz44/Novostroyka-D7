import { LayoutGrid, Camera, ClipboardCheck, BarChart3, Settings, HardHat } from "lucide-react";
import { cn } from "@/lib/utils";

interface IconRailProps {
  active?: "overview" | "captures" | "acts" | "reports";
}

const items = [
  { id: "overview", icon: LayoutGrid, label: "Обзор" },
  { id: "captures", icon: Camera, label: "Снимки" },
  { id: "acts", icon: ClipboardCheck, label: "Акты" },
  { id: "reports", icon: BarChart3, label: "Отчёты" },
] as const;

export function IconRail({ active = "overview" }: IconRailProps) {
  return (
    <nav
      aria-label="Основная навигация"
      className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar py-3"
    >
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-teal text-white">
        <HardHat className="h-5 w-5" aria-hidden />
      </div>
      {items.map(({ id, icon: Icon, label }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            title={label}
            aria-label={label}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </button>
        );
      })}
      <button
        title="Настройки"
        aria-label="Настройки"
        className="mt-auto flex h-10 w-10 items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <Settings className="h-5 w-5" aria-hidden />
      </button>
    </nav>
  );
}
