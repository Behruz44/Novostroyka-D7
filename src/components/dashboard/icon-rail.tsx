import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface IconRailNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
}

interface IconRailProps {
  items: IconRailNavItem[];
  activeId: string;
  brandLetter?: string;
  userInitial?: string;
  userLabel?: string;
  userHref?: string;
  newProjectHref?: string;
  onNavigate?: (item: IconRailNavItem) => void;
}

export function IconRail({
  items,
  activeId,
  brandLetter = "С",
  userInitial = "В",
  userLabel = "Аккаунт",
  userHref,
  newProjectHref = "/app/owner/new",
  onNavigate,
}: IconRailProps) {
  return (
    <nav
      aria-label="Основная навигация"
      className="flex w-[76px] shrink-0 flex-col items-stretch border-r border-[#1d4060] bg-[#16324a] py-0"
    >
      {/* Brand mark */}
      <div className="flex items-center justify-center px-0 py-3.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal text-[15px] font-bold text-white shadow-sm">
          {brandLetter}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3 h-px bg-[#1d4060]" />

      {/* New project button */}
      <div className="px-2 pt-3">
        <a
          href={newProjectHref}
          aria-label="Новый объект"
          className="group flex flex-col items-center gap-1 rounded-lg bg-teal/20 px-1 py-2 transition-colors hover:bg-teal/40"
        >
          <Plus
            className="h-5 w-5 text-teal transition-colors group-hover:text-white"
            aria-hidden
          />
          <span className="text-[9px] font-semibold uppercase leading-none tracking-[0.06em] text-teal transition-colors group-hover:text-white">
            Новый
          </span>
        </a>
      </div>

      {/* Divider */}
      <div className="mx-3 mt-3 h-px bg-[#1d4060]" />

      {/* Nav items */}
      <div className="flex flex-col gap-1.5 px-2 pt-3">
        {items.map((item) => {
          const isActive = item.id === activeId;
          const Icon = item.icon;
          return (
            <a
              key={item.id}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              onClick={(e) => {
                if (onNavigate) {
                  e.preventDefault();
                  onNavigate(item);
                }
              }}
              className={cn(
                "group relative flex flex-col items-center gap-1 rounded-lg px-1 py-2 transition-colors",
                isActive
                  ? "bg-teal text-white"
                  : "text-[#7a92a3] hover:bg-[#1d4060] hover:text-white",
              )}
            >
              {/* Left-edge accent bar for active state */}
              {isActive && (
                <span
                  className="absolute -left-2 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-[#14b8a6]"
                  aria-hidden
                />
              )}
              <Icon
                className={cn(
                  "h-5 w-5 transition-colors",
                  isActive
                    ? "text-white"
                    : "text-[#7a92a3] group-hover:text-white",
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "text-[9px] font-semibold uppercase leading-none tracking-[0.06em] transition-colors",
                  isActive
                    ? "text-white"
                    : "text-[#7a92a3] group-hover:text-white",
                )}
              >
                {item.label}
              </span>
            </a>
          );
        })}
      </div>

      {/* Bottom divider + account area */}
      <div className="mt-auto">
        <div className="mx-3 h-px bg-[#1d4060]" />
        <a
          href={userHref}
          aria-label={userLabel}
          className="flex flex-col items-center gap-1 px-2 py-3 transition-colors"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1d4060] text-[11px] font-semibold text-[#7a92a3] transition-colors hover:bg-[#264a6e] hover:text-white">
            {userInitial}
          </div>
          <span className="text-[9px] font-medium uppercase leading-none tracking-[0.04em] text-[#5a7384]">
            {userLabel}
          </span>
        </a>
      </div>
    </nav>
  );
}
