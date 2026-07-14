"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { LayoutGrid, ClipboardCheck, BarChart3, FileText, MessageCircle } from "lucide-react";
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
        : pathname.startsWith(`${basePath}/reports`)
          ? "reports"
          : pathname.startsWith(`${basePath}/ask`)
            ? "ask"
            : "overview";

  const sectionPath =
    activeSection === "review"
      ? "/review"
      : activeSection === "expenses"
        ? "/expenses"
        : activeSection === "reports"
          ? "/reports"
          : activeSection === "ask"
            ? "/ask"
            : "";

  const navItems: IconRailNavItem[] = [
    { id: "overview", label: "Обзор", icon: LayoutGrid, href: basePath },
    { id: "review", label: "Приёмка", icon: ClipboardCheck, href: `${basePath}/review` },
    { id: "expenses", label: "Расходы", icon: BarChart3, href: `${basePath}/expenses` },
    { id: "reports", label: "Отчёты", icon: FileText, href: `${basePath}/reports` },
    { id: "ask", label: "Спросить", icon: MessageCircle, href: `${basePath}/ask` },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Icon rail */}
      <IconRail
        items={navItems}
        activeId={activeSection}
        brandLetter="С"
        userInitial="В"
        userLabel="Аккаунт"
      />

      {/* Project switcher */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-panel md:flex">
        <div className="border-b border-border px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Объекты
          </p>
        </div>
        <div className="flex flex-col gap-1 p-2">
          {projects.map((p) => {
            const isActive = p.id === projectId;
            return (
              <Link
                key={p.id}
                href={`/app/owner/${p.id}${sectionPath}`}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "flex flex-col gap-2 rounded-md border px-3 py-2.5 text-left transition-colors",
                  isActive
                    ? "border-teal/40 bg-accent"
                    : "border-transparent hover:border-border hover:bg-secondary",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium leading-tight text-foreground">
                    {p.name}
                  </span>
                  <span
                    className={cn(
                      "mt-1 h-2 w-2 shrink-0 rounded-full",
                      flagDot[p.flag],
                    )}
                    aria-hidden
                  />
                </div>
                {p.address && (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {p.address}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        isActive ? "bg-teal" : "bg-muted-foreground/50",
                      )}
                      style={{ width: `${p.progressPct}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
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
