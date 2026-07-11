"use client";

import { useState, useCallback, useEffect } from "react";
import { useUpload } from "@/hooks/useUpload";

interface Stage {
  id: string;
  name: string;
  floor: number;
  order: number;
  projectId: string;
}

interface StageMark {
  id: string;
  status: string;
  photoKeys: string[];
  comment: string | null;
  createdAt: string;
  stage: { name: string; floor: number };
}

interface FileUploadState {
  file: File;
  key: string | null;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  REVIEW: "На проверке",
  APPROVED: "Принято",
  REJECTED: "Отклонено",
};

const STATUS_COLORS: Record<string, string> = {
  REVIEW: "var(--color-gold)",
  APPROVED: "var(--color-teal)",
  REJECTED: "var(--color-danger)",
};

export default function ForemanMarkPage() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [comment, setComment] = useState("");
  const [uploads, setUploads] = useState<FileUploadState[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [marks, setMarks] = useState<StageMark[]>([]);
  const [loadingStages, setLoadingStages] = useState(true);
  const [loadingMarks, setLoadingMarks] = useState(false);

  const selectedStage = stages.find((s) => s.id === selectedStageId);
  const projectId = selectedStage?.projectId ?? "";

  const { upload } = useUpload({ projectId });

  const fetchStages = useCallback(async () => {
    setLoadingStages(true);
    try {
      const res = await fetch("/api/stages");
      if (!res.ok) throw new Error("Не удалось загрузить этапы");
      const data = await res.json();
      setStages(data.stages);
    } catch (err) {
      console.error("Failed to fetch stages:", err);
    } finally {
      setLoadingStages(false);
    }
  }, []);

  const fetchMarks = useCallback(async () => {
    if (!projectId) return;
    setLoadingMarks(true);
    try {
      const res = await fetch(`/api/stage-marks?projectId=${projectId}`);
      if (!res.ok) throw new Error("Не удалось загрузить отметки");
      const data = await res.json();
      setMarks(data.marks);
    } catch (err) {
      console.error("Failed to fetch marks:", err);
    } finally {
      setLoadingMarks(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchStages();
  }, [fetchStages]);

  useEffect(() => {
    fetchMarks();
  }, [fetchMarks]);

  const handleFileSelect = async (files: FileList) => {
    if (!projectId) return;

    const newUploads: FileUploadState[] = Array.from(files).map((file) => ({
      file,
      key: null,
      progress: 0,
      status: "pending",
      error: null,
    }));

    setUploads((prev) => [...prev, ...newUploads]);

    for (let i = 0; i < newUploads.length; i++) {
      const file = newUploads[i].file;
      const idx = uploads.length + i;

      setUploads((prev) =>
        prev.map((u, j) => (j === idx ? { ...u, status: "uploading" } : u)),
      );

      try {
        const result = await upload(file);
        setUploads((prev) =>
          prev.map((u, j) =>
            j === idx
              ? { ...u, key: result.key, status: "done", progress: 100 }
              : u,
          ),
        );
      } catch (err) {
        setUploads((prev) =>
          prev.map((u, j) =>
            j === idx
              ? {
                  ...u,
                  status: "error",
                  error: err instanceof Error ? err.message : "Ошибка загрузки",
                }
              : u,
          ),
        );
      }
    }
  };

  const uploadedKeys = uploads
    .filter((u) => u.status === "done" && u.key)
    .map((u) => u.key!);

  const canSubmit = selectedStageId && uploadedKeys.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const clientRequestId = crypto.randomUUID();
      const res = await fetch("/api/stage-marks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          stageId: selectedStageId,
          photoKeys: uploadedKeys,
          comment: comment || undefined,
          clientRequestId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Не удалось отправить отметку");
      }

      setComment("");
      setUploads([]);
      setSelectedStageId("");
      await fetchStages();
      await fetchMarks();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setSubmitting(false);
    }
  };

  const stagesByFloor = stages.reduce<Record<number, Stage[]>>((acc, stage) => {
    if (!acc[stage.floor]) acc[stage.floor] = [];
    acc[stage.floor].push(stage);
    return acc;
  }, {});

  const floors = Object.keys(stagesByFloor)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--color-bg-alt)",
        padding: "1rem",
        paddingBottom: "3rem",
      }}
    >
      <div style={{ maxWidth: "480px", margin: "0 auto" }}>
        <h1
          style={{
            fontSize: "1.25rem",
            color: "var(--color-navy)",
            marginBottom: "1.5rem",
          }}
        >
          Отметка этапа
        </h1>

        <section
          style={{
            background: "var(--color-bg)",
            borderRadius: "12px",
            padding: "1.25rem",
            marginBottom: "1.5rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <label
            htmlFor="stage"
            style={{
              display: "block",
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "var(--color-navy)",
              marginBottom: "0.5rem",
            }}
          >
            Выберите этап
          </label>
          {loadingStages ? (
            <p style={{ fontSize: "0.875rem", color: "var(--color-navy)", opacity: 0.5 }}>
              Загрузка этапов...
            </p>
          ) : stages.length === 0 ? (
            <p style={{ fontSize: "0.875rem", color: "var(--color-navy)", opacity: 0.5 }}>
              Нет доступных этапов для отметки
            </p>
          ) : (
            <select
              id="stage"
              value={selectedStageId}
              onChange={(e) => setSelectedStageId(e.target.value)}
              style={{
                width: "100%",
                padding: "0.625rem 0.75rem",
                fontSize: "1rem",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                outline: "none",
                color: "var(--color-navy)",
                background: "var(--color-bg)",
              }}
            >
              <option value="">— Выбрать —</option>
              {floors.map((floor) => (
                <optgroup
                  key={floor}
                  label={floor === 0 ? "Общее" : `Этаж ${floor}`}
                >
                  {stagesByFloor[floor].map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}
        </section>

        {selectedStageId && (
          <section
            style={{
              background: "var(--color-bg)",
              borderRadius: "12px",
              padding: "1.25rem",
              marginBottom: "1.5rem",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            <label
              style={{
                display: "block",
                fontSize: "0.8125rem",
                fontWeight: 500,
                color: "var(--color-navy)",
                marginBottom: "0.5rem",
              }}
            >
              Фото ({uploads.filter((u) => u.status === "done").length} загружено)
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "1.5rem",
                border: "2px dashed #d1d5db",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "0.875rem",
                color: "var(--color-navy)",
                opacity: 0.6,
                marginBottom: "1rem",
              }}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files) handleFileSelect(e.target.files);
                  e.target.value = "";
                }}
              />
              + Добавить фото
            </label>

            {uploads.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {uploads.map((u, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.25rem",
                      padding: "0.75rem",
                      background: "var(--color-bg-alt)",
                      borderRadius: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.8125rem",
                          color: "var(--color-navy)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "200px",
                        }}
                      >
                        {u.file.name}
                      </span>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color:
                            u.status === "done"
                              ? "var(--color-teal)"
                              : u.status === "error"
                                ? "var(--color-danger)"
                                : "var(--color-navy)",
                          opacity: 0.7,
                        }}
                      >
                        {u.status === "done"
                          ? "✓"
                          : u.status === "error"
                            ? "✕"
                            : `${u.progress}%`}
                      </span>
                    </div>
                    {u.status === "uploading" && (
                      <div
                        style={{
                          height: "4px",
                          background: "#e5e7eb",
                          borderRadius: "2px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${u.progress}%`,
                            background: "var(--color-teal)",
                            transition: "width 0.2s",
                          }}
                        />
                      </div>
                    )}
                    {u.status === "error" && u.error && (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--color-danger)",
                        }}
                      >
                        {u.error}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: "1rem" }}>
              <label
                htmlFor="comment"
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "var(--color-navy)",
                  marginBottom: "0.375rem",
                }}
              >
                Комментарий (необязательно)
              </label>
              <textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Примечание к отметке..."
                style={{
                  width: "100%",
                  padding: "0.625rem 0.75rem",
                  fontSize: "0.875rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
            </div>

            {submitError && (
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "var(--color-danger)",
                  marginTop: "0.75rem",
                }}
              >
                {submitError}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                width: "100%",
                marginTop: "1rem",
                padding: "0.75rem 1rem",
                fontSize: "1rem",
                fontWeight: 500,
                color: "#fff",
                background: "var(--color-teal)",
                border: "none",
                borderRadius: "8px",
                cursor: canSubmit ? "pointer" : "not-allowed",
                opacity: canSubmit ? 1 : 0.5,
              }}
            >
              {submitting ? "Отправка..." : "Отправить"}
            </button>
          </section>
        )}

        <section>
          <h2
            style={{
              fontSize: "1rem",
              color: "var(--color-navy)",
              marginBottom: "1rem",
            }}
          >
            Мои отметки
          </h2>

          {loadingMarks ? (
            <p style={{ fontSize: "0.875rem", color: "var(--color-navy)", opacity: 0.5 }}>
              Загрузка...
            </p>
          ) : marks.length === 0 ? (
            <p style={{ fontSize: "0.875rem", color: "var(--color-navy)", opacity: 0.5 }}>
              Отметок пока нет
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {marks.map((mark) => (
                <div
                  key={mark.id}
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    background: "var(--color-bg)",
                    borderRadius: "10px",
                    padding: "0.875rem",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  }}
                >
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "8px",
                      background: "var(--color-bg-alt)",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.75rem",
                      color: "var(--color-navy)",
                      opacity: 0.4,
                    }}
                  >
                    {mark.photoKeys.length} фото
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "0.5rem",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            color: "var(--color-navy)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {mark.stage.name}
                        </p>
                        <p
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--color-navy)",
                            opacity: 0.5,
                          }}
                        >
                          {mark.stage.floor === 0
                            ? "Общее"
                            : `Этаж ${mark.stage.floor}`}
                          {" · "}
                          {new Date(mark.createdAt).toLocaleDateString("ru-RU")}
                        </p>
                      </div>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 500,
                          padding: "0.25rem 0.5rem",
                          borderRadius: "4px",
                          whiteSpace: "nowrap",
                          color: "#fff",
                          background: STATUS_COLORS[mark.status] || "var(--color-navy)",
                        }}
                      >
                        {STATUS_LABELS[mark.status] || mark.status}
                      </span>
                    </div>
                    {mark.comment && (
                      <p
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--color-navy)",
                          opacity: 0.6,
                          marginTop: "0.25rem",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {mark.comment}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
