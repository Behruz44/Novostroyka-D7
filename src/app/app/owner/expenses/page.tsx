"use client";

import { useState, useCallback, useEffect } from "react";
import { useUpload } from "@/hooks/useUpload";

interface BudgetLine {
  id: string;
  category: string;
  plannedMinor: string;
}

interface BudgetSummaryItem {
  id: string;
  category: string;
  plannedMinor: string;
  spentMinor: string;
  remainingMinor: string;
}

interface Expense {
  id: string;
  amountMinor: string;
  description: string;
  expenseDate: string;
  budgetLine: { id: string; category: string };
}

function formatMinor(minor: string): string {
  const n = BigInt(minor);
  const rubles = n / 100n;
  const kopecks = n % 100n;
  const kopecksStr = kopecks.toString().padStart(2, "0");
  return `${rubles}.${kopecksStr}`;
}

export default function OwnerExpensesPage() {
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [summary, setSummary] = useState<BudgetSummaryItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [selectedBudgetLineId, setSelectedBudgetLineId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [receiptKey, setReceiptKey] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "done" | "error"
  >("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { upload } = useUpload({ projectId });

  const fetchAll = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [sumRes, expRes] = await Promise.all([
        fetch(`/api/budget-summary?projectId=${projectId}`),
        fetch(`/api/expenses?projectId=${projectId}`),
      ]);
      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setSummary(sumData.budgetLines);
        setBudgetLines(
          sumData.budgetLines.map((bl: BudgetSummaryItem) => ({
            id: bl.id,
            category: bl.category,
            plannedMinor: bl.plannedMinor,
          })),
        );
      }
      if (expRes.ok) {
        const expData = await expRes.json();
        setExpenses(expData.expenses);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.projectIds && data.projectIds.length > 0) {
          setProjectId(data.projectIds[0]);
        }
      })
      .catch((err) => console.error("Failed to fetch user:", err));
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleReceiptUpload = async (file: File) => {
    setUploadProgress(0);
    setUploadStatus("uploading");
    setUploadError(null);
    try {
      const result = await upload(file);
      setReceiptKey(result.key);
      setUploadStatus("done");
      setUploadProgress(100);
    } catch (err) {
      setUploadStatus("error");
      setUploadError(err instanceof Error ? err.message : "Ошибка загрузки");
    }
  };

  const canSubmit =
    selectedBudgetLineId &&
    amount &&
    description.trim() &&
    expenseDate &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const clientRequestId = crypto.randomUUID();
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          budgetLineId: selectedBudgetLineId,
          amountMinor: amount,
          description,
          expenseDate,
          receiptPhotoKey: receiptKey || undefined,
          clientRequestId,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Не удалось создать расход");
      }
      setAmount("");
      setDescription("");
      setSelectedBudgetLineId("");
      setReceiptKey(null);
      setUploadStatus("idle");
      setUploadProgress(0);
      await fetchAll();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setSubmitting(false);
    }
  };

  if (!projectId) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "var(--color-bg-alt)",
          padding: "1rem",
        }}
      >
        <p style={{ color: "var(--color-navy)", opacity: 0.5 }}>
          Нет доступных проектов
        </p>
      </main>
    );
  }

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
          Расходы
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
          <h2
            style={{
              fontSize: "1rem",
              color: "var(--color-navy)",
              marginBottom: "1rem",
            }}
          >
            Бюджет по статьям
          </h2>
          {loading ? (
            <p style={{ fontSize: "0.875rem", color: "var(--color-navy)", opacity: 0.5 }}>
              Загрузка...
            </p>
          ) : summary.length === 0 ? (
            <p style={{ fontSize: "0.875rem", color: "var(--color-navy)", opacity: 0.5 }}>
              Нет статей бюджета
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
              }}
            >
              {summary.map((bl) => {
                const remaining = BigInt(bl.remainingMinor);
                const isOver = remaining < 0n;
                return (
                  <div
                    key={bl.id}
                    style={{
                      padding: "0.875rem",
                      borderRadius: "8px",
                      background: "var(--color-bg-alt)",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 500,
                        color: "var(--color-navy)",
                        marginBottom: "0.5rem",
                      }}
                    >
                      {bl.category}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.125rem",
                      }}
                    >
                      <span style={{ fontSize: "0.75rem", color: "var(--color-navy)", opacity: 0.6 }}>
                        План: {formatMinor(bl.plannedMinor)}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "var(--color-navy)", opacity: 0.6 }}>
                        Факт: {formatMinor(bl.spentMinor)}
                      </span>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          color: isOver
                            ? "var(--color-danger)"
                            : "var(--color-teal)",
                        }}
                      >
                        Остаток: {formatMinor(bl.remainingMinor)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section
          style={{
            background: "var(--color-bg)",
            borderRadius: "12px",
            padding: "1.25rem",
            marginBottom: "1.5rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <h2
            style={{
              fontSize: "1rem",
              color: "var(--color-navy)",
              marginBottom: "1rem",
            }}
          >
            Новый расход
          </h2>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <div>
              <label
                htmlFor="budgetLine"
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "var(--color-navy)",
                  marginBottom: "0.375rem",
                }}
              >
                Статья бюджета
              </label>
              <select
                id="budgetLine"
                value={selectedBudgetLineId}
                onChange={(e) => setSelectedBudgetLineId(e.target.value)}
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
                {budgetLines.map((bl) => (
                  <option key={bl.id} value={bl.id}>
                    {bl.category}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
              }}
            >
              <div>
                <label
                  htmlFor="amount"
                  style={{
                    display: "block",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    color: "var(--color-navy)",
                    marginBottom: "0.375rem",
                  }}
                >
                  Сумма (руб)
                </label>
                <input
                  id="amount"
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1250.50"
                  style={{
                    width: "100%",
                    padding: "0.625rem 0.75rem",
                    fontSize: "1rem",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    outline: "none",
                    color: "var(--color-navy)",
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="date"
                  style={{
                    display: "block",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    color: "var(--color-navy)",
                    marginBottom: "0.375rem",
                  }}
                >
                  Дата
                </label>
                <input
                  id="date"
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.625rem 0.75rem",
                    fontSize: "1rem",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    outline: "none",
                    color: "var(--color-navy)",
                  }}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="desc"
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "var(--color-navy)",
                  marginBottom: "0.375rem",
                }}
              >
                Описание
              </label>
              <input
                id="desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Что куплено / за что заплачено"
                style={{
                  width: "100%",
                  padding: "0.625rem 0.75rem",
                  fontSize: "1rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  outline: "none",
                  color: "var(--color-navy)",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "var(--color-navy)",
                  marginBottom: "0.375rem",
                }}
              >
                Чек (необязательно)
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "1rem",
                  border: "2px dashed #d1d5db",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  color: "var(--color-navy)",
                  opacity: 0.6,
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleReceiptUpload(e.target.files[0]);
                    }
                    e.target.value = "";
                  }}
                />
                {uploadStatus === "uploading"
                  ? `Загрузка... ${uploadProgress}%`
                  : uploadStatus === "done"
                    ? "✓ Чек загружен"
                    : uploadStatus === "error"
                      ? `✕ ${uploadError}`
                      : "+ Добавить чек"}
              </label>
            </div>

            {submitError && (
              <p style={{ fontSize: "0.875rem", color: "var(--color-danger)" }}>
                {submitError}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                width: "100%",
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
              {submitting ? "Сохранение..." : "Добавить расход"}
            </button>
          </div>
        </section>

        <section>
          <h2
            style={{
              fontSize: "1rem",
              color: "var(--color-navy)",
              marginBottom: "1rem",
            }}
          >
            История расходов
          </h2>
          {loading ? (
            <p style={{ fontSize: "0.875rem", color: "var(--color-navy)", opacity: 0.5 }}>
              Загрузка...
            </p>
          ) : expenses.length === 0 ? (
            <p style={{ fontSize: "0.875rem", color: "var(--color-navy)", opacity: 0.5 }}>
              Расходов пока нет
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {expenses.map((exp) => (
                <div
                  key={exp.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.75rem",
                    background: "var(--color-bg)",
                    borderRadius: "10px",
                    padding: "0.875rem",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
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
                      {exp.description}
                    </p>
                    <p
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--color-navy)",
                        opacity: 0.5,
                      }}
                    >
                      {exp.budgetLine.category}
                      {" · "}
                      {new Date(exp.expenseDate).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      color: "var(--color-navy)",
                      whiteSpace: "nowrap",
                      fontFamily: "monospace",
                    }}
                  >
                    {formatMinor(exp.amountMinor)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
