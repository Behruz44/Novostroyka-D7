"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Check, ClipboardCheck, Clock3, ImageIcon, Layers3, Loader2, ScanSearch, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DetectionBox {
  class: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DetectionResult {
  photoKey: string;
  detections: DetectionBox[];
  imageWidth: number;
  imageHeight: number;
  cached: boolean;
}

const CLASS_RU: Record<string, string> = {
  person: "Человек",
  car: "Машина",
  truck: "Грузовик",
  bus: "Автобус",
  motorcycle: "Мотоцикл",
  bicycle: "Велосипед",
  excavator: "Экскаватор",
  bulldozer: "Бульдозер",
  crane: "Кран",
  forklift: "Погрузчик",
  concrete_mixer: "Бетономешалка",
  traffic_light: "Светофор",
  fire_hydrant: "Пожарный гидрант",
  stop_sign: "Знак стоп",
  parking_meter: "Паркомат",
  bench: "Скамейка",
};

function translateClass(cls: string): string {
  return CLASS_RU[cls] ?? cls;
}

function getBoxColor(cls: string): string {
  if (cls === "person") return "#0e7a6c";
  if (["car", "truck", "bus", "motorcycle", "bicycle", "excavator", "bulldozer", "crane", "forklift", "concrete_mixer"].includes(cls)) return "#c9971f";
  return "#627482";
}

function DetectionOverlay({
  detections,
  imageWidth,
  imageHeight,
}: {
  detections: DetectionBox[];
  imageWidth: number;
  imageHeight: number;
}) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
      preserveAspectRatio="xMidYMid slice"
    >
      {detections.map((d, i) => {
        const left = d.x - d.width / 2;
        const top = d.y - d.height / 2;
        const color = getBoxColor(d.class);
        return (
          <g key={i}>
            <rect
              x={left}
              y={top}
              width={d.width}
              height={d.height}
              fill="none"
              stroke={color}
              strokeWidth={Math.max(2, imageWidth / 400)}
              rx={4}
            />
            <rect
              x={left}
              y={top - Math.max(22, imageHeight / 50)}
              width={Math.max(120, d.width * 0.6)}
              height={Math.max(22, imageHeight / 50)}
              fill={color}
              rx={4}
            />
            <text
              x={left + 6}
              y={top - Math.max(6, imageHeight / 80)}
              fill="white"
              fontSize={Math.max(14, imageWidth / 80)}
              fontWeight="600"
              fontFamily="system-ui, sans-serif"
            >
              {translateClass(d.class)} {Math.round(d.confidence * 100)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

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
          "flex h-full w-full flex-col items-center justify-center gap-2 bg-[#edf1ef] text-[#71818b]",
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
  const [detections, setDetections] = useState<Record<string, DetectionResult>>({});
  const [analyzingKey, setAnalyzingKey] = useState<string | null>(null);
  const [detectError, setDetectError] = useState<string | null>(null);

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

  async function analyzePhoto(photoKey: string) {
    setAnalyzingKey(photoKey);
    setDetectError(null);
    try {
      const res = await fetch("/api/photo-detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoKey }),
      });
      if (res.ok) {
        const data: DetectionResult = await res.json();
        setDetections((prev) => ({ ...prev, [photoKey]: data }));
      } else {
        const err = await res.json().catch(() => ({}));
        setDetectError(err.error || "Ошибка анализа");
      }
    } catch {
      setDetectError("Не удалось выполнить анализ");
    } finally {
      setAnalyzingKey(null);
    }
  }

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
      <header className="border-b border-[#dce3e1] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,33,0.05)] sm:px-7">
        <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-[13px] border border-[#d5e7e3] bg-[#effaf7] text-[#096157] shadow-[inset_0_1px_0_white,0_4px_12px_rgba(14,122,108,0.08)]">
              <ClipboardCheck className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#748590]">Контроль качества</p>
              <h1 className="mt-0.5 text-[22px] font-semibold leading-none tracking-[-0.04em] text-[#102a40]">На проверке</h1>
            </div>
          </div>
          {items.length > 0 && (
            <span className="inline-flex items-center gap-2 rounded-full border border-[#ead39c] bg-[#fdf8ea] px-3 py-1.5 text-[11px] font-semibold text-[#805311]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#b07c1f]" />
              Ожидают решения
              <span className="font-mono font-bold">{items.length}</span>
            </span>
          )}
        </div>
      </header>

      <main className="premium-page flex-1 overflow-y-auto px-4 pb-14 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1080px]">
          {loading ? (
            <div className="premium-surface rounded-[20px] px-6 py-12 text-sm text-[#71818b]">Загрузка очереди...</div>
          ) : items.length === 0 ? (
            <div className="premium-surface flex h-72 flex-col items-center justify-center rounded-[22px] text-center">
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] border border-[#d7e8e4] bg-[#effaf7] text-[#096157]">
                <Check className="h-5 w-5" aria-hidden />
              </span>
              <p className="text-xl font-semibold tracking-[-0.03em] text-[#102a40]">
                Нет этапов на проверке
              </p>
              <p className="mt-1.5 text-sm text-[#71818b]">
                Все акты обработаны
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {items.map((item) => {
                const isRejecting = rejectingId === item.id;
                return (
                  <article
                    key={item.id}
                    className="premium-surface premium-surface-interactive overflow-hidden rounded-[22px] p-3 sm:p-4"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:gap-6">
                      {/* Photos */}
                      <div className="shrink-0">
                        <div className="relative h-[230px] w-full overflow-hidden rounded-[16px] border border-[#d7dfdc] bg-[#edf1ef] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6),0_5px_14px_rgba(9,29,45,0.08)] lg:w-[340px]">
                          {item.photos.length > 0 ? (
                            <>
                              <FallbackImage
                                src={item.photos[0]}
                                alt={`Фото: ${item.stageName}`}
                                className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.015]"
                              />
                              {detections[item.photos[0]] && (
                                <DetectionOverlay
                                  detections={detections[item.photos[0]].detections}
                                  imageWidth={detections[item.photos[0]].imageWidth}
                                  imageHeight={detections[item.photos[0]].imageHeight}
                                />
                              )}
                            </>
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-[#71818b]">
                              <ImageIcon className="h-7 w-7 opacity-40" aria-hidden />
                              Нет фото
                            </div>
                          )}
                          {item.photos.length > 1 && (
                            <div className="absolute bottom-3 right-3 rounded-lg border border-white/15 bg-[#102a40]/85 px-2.5 py-1 font-mono text-[10px] font-semibold text-white shadow-[0_4px_12px_rgba(9,29,45,0.22)] backdrop-blur-sm">
                              +{item.photos.length - 1}
                            </div>
                          )}
                        </div>
                        {item.photos.length > 0 && (
                          <div className="mt-3 flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={analyzingKey === item.photos[0]}
                              onClick={() => analyzePhoto(item.photos[0])}
                              className="h-8 rounded-[9px] border-[#d5e7e3] bg-[#effaf7] px-3 text-[11px] font-semibold text-[#096157] hover:bg-[#e0f5f0]"
                            >
                              {analyzingKey === item.photos[0] ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                  Анализ...
                                </>
                              ) : detections[item.photos[0]] ? (
                                <>
                                  <ScanSearch className="h-3.5 w-3.5" aria-hidden />
                                  ИИ: {detections[item.photos[0]].detections.length} объектов
                                  {detections[item.photos[0]].cached && (
                                    <span className="text-[#71818b]">(кэш)</span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <ScanSearch className="h-3.5 w-3.5" aria-hidden />
                                  Анализ ИИ
                                </>
                              )}
                            </Button>
                            {detectError && analyzingKey === null && (
                              <span className="text-[10px] text-[#a53629]">{detectError}</span>
                            )}
                          </div>
                        )}
                        {item.photos.length > 1 && (
                          <div className="mt-3 flex gap-2.5">
                            {item.photos.slice(1).map((p, idx) => (
                              <FallbackImage
                                key={idx}
                                src={p}
                                alt=""
                                className="h-14 w-14 rounded-[10px] border border-[#d4ddda] object-cover shadow-[0_2px_6px_rgba(9,29,45,0.08)]"
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex min-w-0 flex-1 flex-col py-1 lg:py-2">
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e8edeb] pb-4">
                          <div>
                            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#748590]">Этап строительства</p>
                            <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.04em] text-[#102a40]">
                              {item.stageName}
                            </h2>
                          </div>
                          <span className="rounded-full border border-[#d8e8e4] bg-[#effaf7] px-3 py-1 font-mono text-[10px] font-semibold text-[#096157]">
                            {item.floor === 0 ? "Общее" : `${item.floor} этаж`}
                          </span>
                        </div>

                        <div className="grid gap-3 border-b border-[#e8edeb] py-4 sm:grid-cols-2">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#f2f5f4] text-[#627482]">
                              <UserRound className="h-4 w-4" aria-hidden />
                            </span>
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-[#8a989f]">Прораб</p>
                              <p className="mt-0.5 text-xs font-semibold text-[#24465f]">{item.foremanName}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#f2f5f4] text-[#627482]">
                              <Clock3 className="h-4 w-4" aria-hidden />
                            </span>
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-[#8a989f]">Отправлено</p>
                              <p className="mt-0.5 text-xs font-semibold text-[#24465f]">{item.createdAt}</p>
                            </div>
                          </div>
                        </div>

                        {item.comment && (
                          <div className="mt-4 rounded-[13px] border border-[#e0e7e4] bg-[#f7f9f8] p-3.5 shadow-[inset_3px_0_0_#a7ddd4]">
                            <div className="mb-1.5 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.13em] text-[#748590]">
                              <Layers3 className="h-3.5 w-3.5" aria-hidden />
                              Комментарий к акту
                            </div>
                            <p className="text-[13px] leading-relaxed text-[#344f62]">{item.comment}</p>
                          </div>
                        )}

                        <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
                          <Button
                            variant="teal"
                            onClick={() => approve(item.id)}
                            className="h-10 rounded-[11px] bg-[#0e7a6c] px-4 font-semibold shadow-[0_1px_1px_rgba(9,29,45,0.1),0_5px_12px_rgba(14,122,108,0.18)] hover:bg-[#096157]"
                          >
                            <Check className="h-4 w-4" aria-hidden />
                            Принять
                          </Button>
                          <Button
                            variant="danger"
                            className="h-10 rounded-[11px] border-[#ebc2bc] bg-white px-4 font-semibold text-[#a53629] shadow-[0_1px_1px_rgba(9,29,45,0.04)] hover:bg-[#fdf1ef]"
                            onClick={() =>
                              isRejecting
                                ? reject(item.id)
                                : setRejectingId(item.id)
                            }
                          >
                            <X className="h-4 w-4" aria-hidden />
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
                                "h-10 min-w-[220px] flex-1 rounded-[11px] border bg-white px-3.5 text-sm text-[#24465f] shadow-[inset_0_1px_2px_rgba(9,29,45,0.06)] outline-none transition-colors placeholder:text-[#9aa7ad] focus:border-ring",
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
