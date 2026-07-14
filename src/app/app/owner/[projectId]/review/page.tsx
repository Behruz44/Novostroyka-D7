"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { ClipboardCheck, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function FallbackImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-2 bg-secondary text-muted-foreground",
          className,
        )}
      >
        <ImageIcon className="h-8 w-8 opacity-40" aria-hidden />
        <span className="text-xs">Фото недоступно</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setErrored(true)}
    />
  );
}

interface ReviewItem {
  id: string;
  foremanName: string;
  floor: number;
  stageName: string;
  createdAt: string;
  comment: string | null;
  photos: string[];
}

interface ApiMark {
  id: string;
  createdAt: string;
  comment: string | null;
  photoKeys: string[];
  user: { name: string } | null;
  stage: { floor: number; name: string } | null;
}

export default function OwnerReviewPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchReviewQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/stage-marks/review-queue?projectId=${projectId}`,
      );
      if (res.ok) {
        const data = await res.json();
        setItems(
          (data.marks || []).map((m: ApiMark) => ({
            id: m.id,
            foremanName: m.user?.name ?? "—",
            floor: m.stage?.floor ?? 0,
            stageName: m.stage?.name ?? "—",
            createdAt: new Date(m.createdAt).toLocaleString("ru-RU"),
            comment: m.comment,
            photos: m.photoKeys ?? [],
          })),
        );
      }
    } catch (err) {
      console.error("review queue fetch failed", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchReviewQueue();
  }, [fetchReviewQueue]);

  async function approve(id: string) {
    try {
      await fetch(`/api/stage-marks/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
    } catch (err) {
      console.error("approve failed", err);
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function reject(id: string) {
    if (!rejectReason.trim()) {
      setRejectingId(id);
      return;
    }
    try {
      await fetch(`/api/stage-marks/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: rejectReason }),
      });
    } catch (err) {
      console.error("reject failed", err);
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    setRejectingId(null);
    setRejectReason("");
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-border bg-panel px-5 py-3">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-5 w-5 text-teal" aria-hidden />
          <h1 className="text-base font-semibold text-foreground">
            На проверке
          </h1>
          {items.length > 0 && (
            <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-medium text-white">
              {items.length}
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-secondary p-4 lg:p-5">
        <div className="mx-auto max-w-[900px]">
          {loading ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : items.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-border bg-panel">
              <p className="text-lg font-medium text-foreground">
                Нет этапов на проверке
              </p>
              <p className="text-sm text-muted-foreground">
                Все акты обработаны
              </p>
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
                          {item.photos.length > 0 ? (
                            <FallbackImage
                              src={item.photos[0]}
                              alt={`Фото: ${item.stageName}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                              Нет фото
                            </div>
                          )}
                          {item.photos.length > 1 && (
                            <div className="absolute bottom-2 right-2 rounded bg-navy/70 px-1.5 py-0.5 text-[10px] text-white">
                              +{item.photos.length - 1}
                            </div>
                          )}
                        </div>
                        {item.photos.length > 1 && (
                          <div className="mt-2 flex gap-2">
                            {item.photos.slice(1).map((p, idx) => (
                              <FallbackImage
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
                            <h2 className="text-base font-semibold text-foreground">
                              {item.stageName}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                              {item.floor === 0
                                ? "Общее"
                                : `Этаж ${item.floor}`}{" "}
                              · {item.foremanName} · {item.createdAt}
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
                              isRejecting
                                ? reject(item.id)
                                : setRejectingId(item.id)
                            }
                          >
                            {isRejecting
                              ? "Подтвердить отклонение"
                              : "Отклонить"}
                          </Button>

                          {isRejecting && (
                            <input
                              autoFocus
                              value={rejectReason}
                              onChange={(e) =>
                                setRejectReason(e.target.value)
                              }
                              placeholder="Причина отклонения"
                              className={cn(
                                "flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:border-ring",
                                rejectReason.trim()
                                  ? "border-input"
                                  : "border-danger",
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
    </>
  );
}
