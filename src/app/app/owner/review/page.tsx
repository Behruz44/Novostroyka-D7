"use client";

import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IconRail } from "@/components/dashboard/icon-rail";
import { ProjectSwitcher } from "@/components/dashboard/project-switcher";
import type { ProjectSummary } from "@/components/dashboard/project-switcher";

interface ReviewItem {
  id: string;
  foremanName: string;
  floor: number;
  stageName: string;
  createdAt: string;
  comment: string | null;
  photos: string[];
}

const PROJECTS: ProjectSummary[] = [
  { id: "p1", name: "Паркинг 8 этажей", address: "г. Ташкент, ул. Примерная, 1", progressPct: 47, flag: "WARN" },
  { id: "p2", name: "Sunrise Residence", address: null, progressPct: 12, flag: "OK" },
];

const REVIEW_QUEUE: ReviewItem[] = [
  {
    id: "r1",
    foremanName: "Т. Абдыраев",
    floor: 4,
    stageName: "Монтаж лесов",
    createdAt: "сегодня, 09:14",
    comment: "Каркас 4-го этажа, леса установлены по периметру.",
    photos: ["/site/scaffolding.png", "/site/columns.png", "/site/rebar.png"],
  },
  {
    id: "r2",
    foremanName: "Т. Абдыраев",
    floor: 2,
    stageName: "Заливка плиты",
    createdAt: "вчера, 16:40",
    comment: "Бетон В25, залита плита 2-го этажа.",
    photos: ["/site/concrete-slab.png"],
  },
  {
    id: "r3",
    foremanName: "Т. Абдыраев",
    floor: 0,
    stageName: "Подготовка основания",
    createdAt: "вчера, 11:20",
    comment: null,
    photos: ["/site/exterior.png", "/site/formwork.png"],
  },
];

export default function OwnerReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>(REVIEW_QUEUE);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  function approve(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function reject(id: string) {
    if (!rejectReason.trim()) {
      setRejectingId(id);
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    setRejectingId(null);
    setRejectReason("");
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <IconRail active="acts" />
      <ProjectSwitcher projects={PROJECTS} activeId={PROJECTS[0].id} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-panel px-5 py-3">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-5 w-5 text-teal" aria-hidden />
            <h1 className="text-base font-semibold text-foreground">На проверке</h1>
            {items.length > 0 && (
              <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-medium text-white">
                {items.length}
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-secondary p-4 lg:p-5">
          <div className="mx-auto max-w-[900px]">
            {items.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-border bg-panel">
                <p className="text-lg font-medium text-foreground">Нет этапов на проверке</p>
                <p className="text-sm text-muted-foreground">Все акты обработаны</p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => {
                  const isRejecting = rejectingId === item.id;
                  return (
                    <article
                      key={item.id}
                      className="rounded-lg border border-border bg-panel p-4"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row">
                        {/* Photos */}
                        <div className="shrink-0">
                          <div className="relative h-[200px] w-full overflow-hidden rounded-md border border-border bg-secondary lg:w-[280px]">
                            <img
                              src={item.photos[0]}
                              alt={`Фото: ${item.stageName}`}
                              className="h-full w-full object-cover"
                            />
                            {item.photos.length > 1 && (
                              <div className="absolute bottom-2 right-2 rounded bg-navy/70 px-1.5 py-0.5 text-[10px] text-white">
                                +{item.photos.length - 1}
                              </div>
                            )}
                          </div>
                          {item.photos.length > 1 && (
                            <div className="mt-2 flex gap-2">
                              {item.photos.slice(1).map((p, idx) => (
                                <img
                                  key={idx}
                                  src={p}
                                  alt=""
                                  className="h-12 w-12 rounded border border-border object-cover"
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <h2 className="text-base font-semibold text-foreground">{item.stageName}</h2>
                              <p className="text-sm text-muted-foreground">
                                {item.floor === 0 ? "Общее" : `Этаж ${item.floor}`} · {item.foremanName} ·{" "}
                                {item.createdAt}
                              </p>
                            </div>
                          </div>

                          {item.comment && (
                            <p className="mt-3 rounded-md bg-secondary p-3 text-sm text-foreground">
                              {item.comment}
                            </p>
                          )}

                          <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
                            <Button variant="teal" onClick={() => approve(item.id)}>
                              Принять
                            </Button>
                            <Button
                              variant="danger"
                              onClick={() =>
                                isRejecting ? reject(item.id) : setRejectingId(item.id)
                              }
                            >
                              {isRejecting ? "Подтвердить отклонение" : "Отклонить"}
                            </Button>

                            {isRejecting && (
                              <input
                                autoFocus
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Причина отклонения"
                                className={cn(
                                  "flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:border-ring",
                                  rejectReason.trim() ? "border-input" : "border-danger",
                                )}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
