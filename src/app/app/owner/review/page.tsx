"use client";

import { useState, useCallback, useEffect } from "react";

interface ReviewMark {
  id: string;
  status: string;
  photoKeys: string[];
  comment: string | null;
  createdAt: string;
  stage: { name: string; floor: number };
  user: { name: string };
}

export default function OwnerReviewPage() {
  const [marks, setMarks] = useState<ReviewMark[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState<string>("");
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/stage-marks/review-queue?projectId=${projectId}`,
      );
      if (!res.ok) throw new Error("Не удалось загрузить очередь");
      const data = await res.json();
      setMarks(data.marks);
    } catch (err) {
      console.error("failed to fetch review queue", err);
      setError("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const stored = localStorage.getItem("projectId");
    if (stored) setProjectId(stored);
  }, []);

  useEffect(() => {
    if (projectId) {
      localStorage.setItem("projectId", projectId);
      fetchQueue();
    }
  }, [projectId, fetchQueue]);

  useEffect(() => {
    async function loadPhotos() {
      const newUrls: Record<string, string> = {};
      for (const mark of marks) {
        for (const key of mark.photoKeys) {
          if (!photoUrls[key]) {
            try {
              const res = await fetch(
                `/api/stage-marks/photo-url?key=${encodeURIComponent(key)}`,
              );
              if (res.ok) {
                const data = await res.json();
                newUrls[key] = data.url;
              }
            } catch (err) {
              console.error("failed to fetch photo url", err);
            }
          }
        }
      }
      if (Object.keys(newUrls).length > 0) {
        setPhotoUrls((prev) => ({ ...prev, ...newUrls }));
      }
    }
    loadPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marks]);

  const handleApprove = async (markId: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/stage-marks/${markId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка");
      }
      setMarks((prev) => prev.filter((m) => m.id !== markId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (markId: string) => {
    if (!rejectReason.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/stage-marks/${markId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: rejectReason }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка");
      }
      setMarks((prev) => prev.filter((m) => m.id !== markId));
      setRejectingId(null);
      setRejectReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--color-bg-alt)",
        padding: "1rem",
        paddingBottom: "3rem",
      }}
    >
      <div style={{ maxWidth: "640px", margin: "0 auto" }}>
        <h1
          style={{
            fontSize: "1.25rem",
            color: "var(--color-navy)",
            marginBottom: "1.5rem",
          }}
        >
          На проверке
        </h1>

        <section style={{ marginBottom: "1.5rem" }}>
          <label
            htmlFor="project"
            style={{
              display: "block",
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "var(--color-navy)",
              marginBottom: "0.5rem",
            }}
          >
            Проект
          </label>
          <select
            id="project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
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
            <option value="cmrf8q5300003m25q7dkapoqb">
              Парковка 8 этажей
            </option>
          </select>
        </section>

        {error && (
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--color-danger)",
              marginBottom: "1rem",
            }}
          >
            {error}
          </p>
        )}

        {loading ? (
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--color-navy)",
              opacity: 0.5,
            }}
          >
            Загрузка...
          </p>
        ) : marks.length === 0 ? (
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--color-navy)",
              opacity: 0.5,
            }}
          >
            Нет отметок на проверке
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {marks.map((mark) => (
              <div
                key={mark.id}
                style={{
                  background: "var(--color-bg)",
                  borderRadius: "12px",
                  padding: "1.25rem",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "0.75rem",
                  }}
                >
                  <div>
                    <p
                      style={{
                        fontSize: "1rem",
                        fontWeight: 500,
                        color: "var(--color-navy)",
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
                      {mark.user.name}
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
                      color: "#fff",
                      background: "var(--color-gold)",
                    }}
                  >
                    На проверке
                  </span>
                </div>

                {mark.photoKeys.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      marginBottom: "0.75rem",
                      overflowX: "auto",
                    }}
                  >
                    {mark.photoKeys.map((key) => (
                      <div
                        key={key}
                        style={{
                          width: "80px",
                          height: "80px",
                          borderRadius: "8px",
                          background: "var(--color-bg-alt)",
                          flexShrink: 0,
                          overflow: "hidden",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {photoUrls[key] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photoUrls[key]}
                            alt="Фото"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--color-navy)",
                              opacity: 0.4,
                            }}
                          >
                            ...
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {mark.comment && (
                  <p
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--color-navy)",
                      opacity: 0.7,
                      marginBottom: "0.75rem",
                    }}
                  >
                    {mark.comment}
                  </p>
                )}

                {rejectingId === mark.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={2}
                      placeholder="Причина отклонения..."
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        fontSize: "0.875rem",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        outline: "none",
                        resize: "vertical",
                        fontFamily: "inherit",
                      }}
                    />
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        onClick={() => handleReject(mark.id)}
                        disabled={!rejectReason.trim() || submitting}
                        style={{
                          flex: 1,
                          padding: "0.625rem 1rem",
                          fontSize: "0.875rem",
                          fontWeight: 500,
                          color: "#fff",
                          background: "var(--color-danger)",
                          border: "none",
                          borderRadius: "8px",
                          cursor:
                            rejectReason.trim() && !submitting
                              ? "pointer"
                              : "not-allowed",
                          opacity: rejectReason.trim() && !submitting ? 1 : 0.5,
                        }}
                      >
                        Подтвердить отклонение
                      </button>
                      <button
                        onClick={() => {
                          setRejectingId(null);
                          setRejectReason("");
                        }}
                        disabled={submitting}
                        style={{
                          padding: "0.625rem 1rem",
                          fontSize: "0.875rem",
                          fontWeight: 500,
                          color: "var(--color-navy)",
                          background: "var(--color-bg-alt)",
                          border: "none",
                          borderRadius: "8px",
                          cursor: "pointer",
                        }}
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={() => handleApprove(mark.id)}
                      disabled={submitting}
                      style={{
                        flex: 1,
                        padding: "0.625rem 1rem",
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        color: "#fff",
                        background: "var(--color-teal)",
                        border: "none",
                        borderRadius: "8px",
                        cursor: submitting ? "not-allowed" : "pointer",
                        opacity: submitting ? 0.5 : 1,
                      }}
                    >
                      Принять
                    </button>
                    <button
                      onClick={() => setRejectingId(mark.id)}
                      disabled={submitting}
                      style={{
                        flex: 1,
                        padding: "0.625rem 1rem",
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        color: "var(--color-danger)",
                        background: "var(--color-bg-alt)",
                        border: "1px solid var(--color-danger)",
                        borderRadius: "8px",
                        cursor: submitting ? "not-allowed" : "pointer",
                        opacity: submitting ? 0.5 : 1,
                      }}
                    >
                      Отклонить
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
