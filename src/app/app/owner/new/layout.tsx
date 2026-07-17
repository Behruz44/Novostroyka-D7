"use client";

import { useState, useEffect } from "react";
import { LayoutGrid, ClipboardCheck, BarChart3, FileText, MessageCircle } from "lucide-react";
import { IconRail, type IconRailNavItem } from "@/components/dashboard/icon-rail";

export default function NewProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [firstProjectId, setFirstProjectId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        if (data.projects && data.projects.length > 0) {
          setFirstProjectId(data.projects[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const basePath = firstProjectId
    ? `/app/owner/${firstProjectId}`
    : "/app/owner";

  const navItems: IconRailNavItem[] = [
    { id: "overview", label: "Обзор", icon: LayoutGrid, href: basePath },
    { id: "review", label: "Приёмка", icon: ClipboardCheck, href: `${basePath}/review` },
    { id: "expenses", label: "Расходы", icon: BarChart3, href: `${basePath}/expenses` },
    { id: "reports", label: "Отчёты", icon: FileText, href: `${basePath}/reports` },
    { id: "ask", label: "Спросить", icon: MessageCircle, href: `${basePath}/ask` },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F5F4F1] text-foreground">
      <IconRail
        items={navItems}
        activeId=""
        brandLetter="С"
        userInitial="В"
        userLabel="Аккаунт"
        userHref={
          firstProjectId
            ? `/app/owner/${firstProjectId}/account`
            : "/app/owner"
        }
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
