"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { LayoutGrid, ClipboardCheck, BarChart3, FileText, MessageCircle, HardHat, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconRail, type IconRailNavItem } from "@/components/dashboard/icon-rail";

interface ProjectListItem {
  id: string;
  name: string;
  address: string | null;
  progressPct: number;
  flag: "OK" | "WARN" | "DANGER" | "UNKNOWN";
}

const flagDot: Record<string, string> = {
  OK: "bg-teal",
  WARN: "bg-gold",
  DANGER: "bg-danger",
  UNKNOWN: "bg-muted-foreground",
};

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const projectId = params.projectId as string;
  const pathname = usePathname();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        if (data.projects) setProjects(data.projects);
      })
      .catch((err) => console.error("failed to fetch /api/projects", err));
  }, []);

  const basePath = `/app/owner/${projectId}`;
  const activeSection = pathname === basePath
    ? "overview"
    : pathname.startsWith(`${basePath}/review`)
      ? "review"
      : pathname.startsWith(`${basePath}/expenses`)
        ? "expenses"
        : pathname.startsWith(`${basePath}/contractors`)
          ? "contractors"
          : pathname.startsWith(`${basePath}/reports`)
            ? "reports"
            : pathname.startsWith(`${basePath}/ask`)
              ? "ask"
              : pathname.startsWith(`${basePath}/account`)
                ? "account"
                : "overview";

  const sectionPath =
    activeSection === "review"
      ? "/review"
      : activeSection === "expenses"
        ? "/expenses"
        : activeSection === "contractors"
          ? "/contractors"
          : activeSection === "reports"
            ? "/reports"
            : activeSection === "ask"
              ? "/ask"
              : activeSection === "account"
                ? "/account"
                : "";

  const navItems: IconRailNavItem[] = [
    { id: "portfolio", label: "Портфель", icon: Layers, href: "/app/owner/portfolio" },
    { id: "overview", label: "Обзор", icon: LayoutGrid, href: basePath },
    { id: "review", label: "Приёмка", icon: ClipboardCheck, href: `${basePath}/review` },
    { id: "expenses", label: "Расходы", icon: BarChart3, href: `${basePath}/expenses` },
    { id: "contractors", label: "Подрядчики", icon: HardHat, href: `${basePath}/contractors` },
    { id: "reports", label: "Отчёты", icon: FileText, href: `${basePath}/reports` },
    { id: "ask", label: "Спросить", icon: MessageCircle, href: `${basePath}/ask` },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F5F4F1] text-foreground">
      {/* Icon rail */}
      <IconRail
        items={navItems}
        activeId={activeSection}
        brandLetter="С"
        userInitial="В"
        userLabel="Аккаунт"
        userHref={`${basePath}/account`}
      />

      {/* Project switcher */}
      <aside className="hidden w-[272px] shrink-0 flex-col border-r border-[#dce3e1] bg-[#fbfcfb] shadow-[3px_0_16px_rgba(9,29,45,0.035)] md:flex">
        <div className="border-b border-[#e5eae8] px-5 pb-4 pt-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#748590]">
            Объекты
          </p>
          <p className="mt-1 text-sm font-semibold tracking-[-0.015em] text-[#16324a]">
            Портфель проектов
          </p>
        </div>
        <div className="flex flex-col gap-2.5 p-3">
          {projects.map((p) => {
            const isActive = p.id === projectId;
            return (
              <Link
                key={p.id}
                href={`/app/owner/${p.id}${sectionPath}`}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "premium-surface-interactive flex flex-col gap-3 rounded-[14px] border px-3.5 py-3.5 text-left",
                  isActive
                    ? "border-[#9fcfc7] bg-[linear-gradient(135deg,#ffffff_0%,#f0faf7_100%)] shadow-[0_1px_1px_rgba(9,29,45,0.06),0_8px_20px_rgba(14,122,108,0.09)]"
                    : "border-transparent bg-transparent shadow-none hover:border-[#d9e2df] hover:bg-white", 
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[13px] font-semibold leading-tight tracking-[-0.01em] text-[#16324a]">
                    {p.name}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(9,29,45,0.08)]",
                      flagDot[p.flag],
                    )}
                    aria-hidden
                  />
                </div>
                {p.address && (
                  <p className="truncate text-[11px] leading-relaxed text-[#73838e]">
                    {p.address}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full border border-[#dfe6e3] bg-[#e9eeec] shadow-[inset_0_1px_2px_rgba(9,29,45,0.1)]">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        isActive
                          ? "bg-[linear-gradient(90deg,#096157,#20a894)] shadow-[0_0_8px_rgba(14,122,108,0.22)]"
                          : "bg-[#8fa19d]",
                      )}
                      style={{ width: `${p.progressPct}%` }}
                    />
                  </div>
                  <span className="min-w-9 text-right font-mono text-[11px] font-semibold tabular-nums text-[#506773]">
                    {p.progressPct}%
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </aside>

      {/* Main content */}
      <div key={activeSection} className="flex min-w-0 flex-1 flex-col animate-section-enter">
        {children}
      </div>
    </div>
  );
}
