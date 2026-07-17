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
      className="relative flex w-[88px] shrink-0 flex-col items-stretch border-r border-white/10 py-0 shadow-[4px_0_18px_rgba(9,29,45,0.12)]"
      style={{ background: "linear-gradient(180deg, #16324A 0%, #0F2333 100%)" }}
    >
      {/* Brand mark */}
      <div className="flex items-center justify-center px-0 py-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/15 bg-[linear-gradient(145deg,#149181,#096157)] text-[16px] font-bold tracking-[-0.03em] text-white shadow-[0_1px_1px_rgba(0,0,0,0.18),0_8px_18px_rgba(0,0,0,0.2)]">
          {brandLetter}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      {/* New project button */}
      <div className="px-3 pt-4">
        <a
          href={newProjectHref}
          aria-label="Новый объект"
          className="group flex flex-col items-center gap-1.5 rounded-xl border border-[#a7ddd4]/10 bg-white/[0.055] px-1 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all hover:border-[#a7ddd4]/25 hover:bg-white/10"
        >
          <Plus
            className="h-[18px] w-[18px] text-[#6fd0c1] transition-colors group-hover:text-white"
            aria-hidden
          />
          <span className="text-[9px] font-semibold uppercase leading-none tracking-[0.09em] text-[#8cd9cd] transition-colors group-hover:text-white">
            Новый
          </span>
        </a>
      </div>

      {/* Divider */}
      <div className="mx-4 mt-4 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      {/* Nav items */}
      <div className="flex flex-col gap-2 px-3 pt-4">
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
                "group relative flex flex-col items-center gap-1.5 transition-all",
                isActive
                  ? "text-white"
                  : "text-[#C4D0DC] hover:text-white",
              )}
            >
              {/* Active icon tile */}
              <span
                className={cn(
                  "flex items-center justify-center transition-all",
                  isActive
                    ? "rounded-[10px] bg-[#0E7A6C] px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.2),0_4px_12px_rgba(14,122,108,0.3)]"
                    : "px-3 py-2.5",
                )}
              >
                <Icon
                  className={cn(
                    "h-[17px] w-[17px] transition-colors",
                    isActive
                      ? "text-white"
                      : "text-[#C4D0DC] group-hover:text-white",
                  )}
                  aria-hidden
                />
              </span>
              <span
                className={cn(
                  "text-[9px] font-semibold uppercase leading-none tracking-[0.08em] transition-colors",
                  isActive
                    ? "text-white"
                    : "text-[#C4D0DC] group-hover:text-white",
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
        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <a
          href={userHref}
          aria-label={userLabel}
          className="group flex flex-col items-center gap-1.5 px-3 py-4 transition-colors"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-[11px] font-semibold text-[#9eb0bd] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all group-hover:border-white/20 group-hover:bg-white/10 group-hover:text-white">
            {userInitial}
          </div>
          <span className="text-[9px] font-medium uppercase leading-none tracking-[0.07em] text-[#6f8798] transition-colors group-hover:text-[#a9bbc7]">
            {userLabel}
          </span>
        </a>
      </div>
    </nav>
  );
}
