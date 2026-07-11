"use client";

import { useState, useMemo } from "react";
import { Camera, Upload, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Mock data — realistic construction stages for a parking project
const FLOORS = [0, 1, 2, 3, 4, 5];
const STAGES: { id: string; floor: number; name: string }[] = [
  { id: "s0-1", floor: 0, name: "Земляные работы" },
  { id: "s0-2", floor: 0, name: "Подготовка основания" },
  { id: "s1-1", floor: 1, name: "Опалубка плиты" },
  { id: "s1-2", floor: 1, name: "Армирование" },
  { id: "s1-3", floor: 1, name: "Заливка бетона" },
  { id: "s2-1", floor: 2, name: "Опалубка плиты" },
  { id: "s2-2", floor: 2, name: "Армирование" },
  { id: "s3-1", floor: 3, name: "Опалубка плиты" },
  { id: "s4-1", floor: 4, name: "Опалубка плиты" },
  { id: "s5-1", floor: 5, name: "Опалубка плиты" },
];

const STATUS_LABELS: Record<string, string> = {
  REVIEW: "На проверке",
  APPROVED: "Принято",
  REJECTED: "Отклонено",
};

const STATUS_COLORS: Record<string, string> = {
  REVIEW: "bg-gold",
  APPROVED: "bg-teal",
  REJECTED: "bg-danger",
};

interface MockMark {
  id: string;
  floor: number;
  stageName: string;
  status: "REVIEW" | "APPROVED" | "REJECTED";
  createdAt: string;
  comment: string | null;
  thumb: string;
}

const MY_MARKS: MockMark[] = [
  {
    id: "m1",
    floor: 1,
    stageName: "Армирование",
    status: "REVIEW",
    createdAt: "10 июля, 09:14",
    comment: "Каркас 1-го этажа",
    thumb: "/site/rebar.png",
  },
  {
    id: "m2",
    floor: 2,
    stageName: "Заливка бетона",
    status: "APPROVED",
    createdAt: "8 июля, 16:40",
    comment: null,
    thumb: "/site/concrete-slab.png",
  },
  {
    id: "m3",
    floor: 0,
    stageName: "Земляные работы",
    status: "REJECTED",
    createdAt: "6 июля, 11:20",
    comment: "Добавить фото углового профиля",
    thumb: "/site/exterior.png",
  },
];

interface FileUpload {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  preview: string;
}

export default function ForemanMarkPage() {
  const [selectedFloor, setSelectedFloor] = useState<string>("");
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [comment, setComment] = useState("");
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const stagesForFloor = useMemo(() => {
    if (selectedFloor === "") return [];
    return STAGES.filter((s) => s.floor === Number(selectedFloor));
  }, [selectedFloor]);

  const doneCount = uploads.filter((u) => u.status === "done").length;
  const canSubmit = selectedStageId && doneCount > 0 && !submitting;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    const newUploads: FileUpload[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      progress: 0,
      status: "pending",
      preview: URL.createObjectURL(file),
    }));

    setUploads((prev) => [...prev, ...newUploads]);

    // Simulate individual uploads
    newUploads.forEach((upload) => {
      const interval = setInterval(() => {
        setUploads((prev) =>
          prev.map((u) => {
            if (u.id !== upload.id || u.status === "done" || u.status === "error") return u;
            const next = Math.min(u.progress + Math.floor(Math.random() * 25) + 10, 100);
            if (next >= 100) {
              clearInterval(interval);
              return { ...u, progress: 100, status: "done" };
            }
            return { ...u, progress: next, status: "uploading" };
          }),
        );
      }, 200);
    });

    e.target.value = "";
  }

  function removeUpload(id: string) {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 800));
    setSubmitting(false);
    setUploads([]);
    setSelectedStageId("");
    setComment("");
  }

  return (
    <main className="min-h-screen bg-secondary px-4 py-5">
      <div className="mx-auto max-w-[480px]">
        <h1 className="mb-5 text-xl font-semibold text-foreground">Отметка этапа</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Floor selector */}
          <section className="rounded-lg border border-border bg-panel p-4">
            <label htmlFor="floor" className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Этаж
            </label>
            <select
              id="floor"
              value={selectedFloor}
              onChange={(e) => {
                setSelectedFloor(e.target.value);
                setSelectedStageId("");
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            >
              <option value="">— Выберите этаж —</option>
              {FLOORS.map((f) => (
                <option key={f} value={f}>
                  {f === 0 ? "Общее" : `Этаж ${f}`}
                </option>
              ))}
            </select>
          </section>

          {/* Stage selector */}
          <section className="rounded-lg border border-border bg-panel p-4">
            <label htmlFor="stage" className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Этап
            </label>
            <select
              id="stage"
              value={selectedStageId}
              onChange={(e) => setSelectedStageId(e.target.value)}
              disabled={!selectedFloor}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none disabled:opacity-50 focus:border-ring"
            >
              <option value="">— Выберите этап —</option>
              {stagesForFloor.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </section>

          {/* Photo upload */}
          <section className="rounded-lg border border-border bg-panel p-4">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Фото ({doneCount} загружено)
            </label>

            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-input bg-background px-4 py-6 text-center transition-colors hover:border-ring hover:bg-muted">
              <Upload className="mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
              <span className="text-sm font-medium text-foreground">Нажми и выбери фото</span>
              <span className="mt-1 text-xs text-muted-foreground">или перетащи сюда</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={handleFileSelect}
              />
            </label>

            {uploads.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3">
                {uploads.map((u) => (
                  <div key={u.id} className="relative">
                    <div className="relative aspect-square overflow-hidden rounded-md border border-border bg-secondary">
                      <img src={u.preview} alt="" className="h-full w-full object-cover" />
                      {u.status !== "done" && (
                        <div className="absolute inset-0 flex flex-col justify-end bg-navy/40 px-2 pb-2">
                          <div className="h-1.5 overflow-hidden rounded-full bg-white/30">
                            <div
                              className="h-full rounded-full bg-teal transition-all"
                              style={{ width: `${u.progress}%` }}
                            />
                          </div>
                          <span className="mt-1 text-center text-[10px] font-medium text-white">{u.progress}%</span>
                        </div>
                      )}
                      {u.status === "done" && (
                        <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-teal text-white">
                          <Check className="h-3 w-3" aria-hidden />
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeUpload(u.id)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-panel text-muted-foreground hover:text-danger"
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Comment */}
          <section className="rounded-lg border border-border bg-panel p-4">
            <label htmlFor="comment" className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Комментарий (необязательно)
            </label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Примечание к отметке..."
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            />
          </section>

          <Button type="submit" variant="teal" size="lg" disabled={!canSubmit} className="w-full">
            {submitting ? "Отправка..." : "Отправить на проверку"}
          </Button>
        </form>

        {/* Previous marks */}
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
            <Camera className="h-4 w-4 text-teal" aria-hidden />
            Мои отметки
          </h2>

          <div className="space-y-3">
            {MY_MARKS.map((mark) => (
              <div
                key={mark.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-panel p-3"
              >
                <img
                  src={mark.thumb}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-md border border-border object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="truncate text-sm font-medium text-foreground">{mark.stageName}</p>
                      <p className="text-xs text-muted-foreground">
                        {mark.floor === 0 ? "Общее" : `Этаж ${mark.floor}`} · {mark.createdAt}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white",
                        STATUS_COLORS[mark.status],
                      )}
                    >
                      {STATUS_LABELS[mark.status]}
                    </span>
                  </div>
                  {mark.comment && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">{mark.comment}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
