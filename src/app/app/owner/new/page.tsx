"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Sparkles, Pencil, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StageForm {
  id: string;
  name: string;
  floor: number;
  weightBp: number;
  order: number;
}

interface BudgetLineForm {
  id: string;
  category: string;
  plannedMinor: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type Mode = "manual" | "ai";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyForm() {
  return {
    name: "",
    address: "",
    totalBudgetMinor: "",
    stages: [
      { id: uid(), name: "", floor: 0, weightBp: 5000, order: 1 },
      { id: uid(), name: "", floor: 0, weightBp: 5000, order: 2 },
    ] as StageForm[],
    budgetLines: [
      { id: uid(), category: "", plannedMinor: "" },
    ] as BudgetLineForm[],
  };
}

export default function NewProjectPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("manual");
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  // AI chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiLoading]);

  const weightSum = form.stages.reduce((sum, s) => sum + s.weightBp, 0);
  const weightValid = weightSum === 10000;
  const formValid =
    form.name.trim().length > 0 &&
    form.totalBudgetMinor.length > 0 &&
    form.stages.length > 0 &&
    form.stages.every((s) => s.name.trim().length > 0) &&
    form.budgetLines.length > 0 &&
    form.budgetLines.every((b) => b.category.trim().length > 0 && b.plannedMinor.length > 0) &&
    weightValid;

  function updateForm(updater: (prev: ReturnType<typeof emptyForm>) => ReturnType<typeof emptyForm>) {
    setForm(updater);
  }

  function addStage() {
    updateForm((prev) => ({
      ...prev,
      stages: [
        ...prev.stages,
        { id: uid(), name: "", floor: 0, weightBp: 0, order: prev.stages.length + 1 },
      ],
    }));
  }

  function removeStage(id: string) {
    updateForm((prev) => ({
      ...prev,
      stages: prev.stages.filter((s) => s.id !== id),
    }));
  }

  function addBudgetLine() {
    updateForm((prev) => ({
      ...prev,
      budgetLines: [...prev.budgetLines, { id: uid(), category: "", plannedMinor: "" }],
    }));
  }

  function removeBudgetLine(id: string) {
    updateForm((prev) => ({
      ...prev,
      budgetLines: prev.budgetLines.filter((b) => b.id !== id),
    }));
  }

  function applyDraft(draft: {
    name?: string;
    address?: string;
    totalBudgetMinor?: string;
    stages?: { name: string; floor: number; weightBp: number }[];
    budgetLines?: { category: string; plannedMinor: string }[];
  }) {
    updateForm(() => ({
      name: draft.name || "",
      address: draft.address || "",
      totalBudgetMinor: draft.totalBudgetMinor || "",
      stages: (draft.stages || []).map((s, i) => ({
        id: uid(),
        name: s.name,
        floor: s.floor,
        weightBp: s.weightBp,
        order: i + 1,
      })),
      budgetLines: (draft.budgetLines || []).map((b) => ({
        id: uid(),
        category: b.category,
        plannedMinor: b.plannedMinor,
      })),
    }));
  }

  async function handleSubmit() {
    if (!formValid) return;
    setSubmitting(true);
    setServerError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          clientRequestId: `owner-new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        router.push(`/app/owner/${data.id}`);
      } else {
        setServerError(data.error || "Ошибка создания проекта");
      }
    } catch {
      setServerError("Сетевая ошибка");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendChatMessage() {
    if (!input.trim() || aiLoading) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setAiLoading(true);
    setAiError("");

    try {
      const res = await fetch("/api/ai/project-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();

      if (!res.ok) {
        setAiError(data.error || "Ошибка ИИ");
        setAiLoading(false);
        return;
      }

      const assistantMsg: ChatMessage = { role: "assistant", content: data.reply };
      setMessages([...newMessages, assistantMsg]);

      // Check if reply contains JSON draft
      if (data.draft) {
        applyDraft(data.draft);
        setMode("manual");
      }
    } catch {
      setAiError("Сетевая ошибка при обращении к ИИ");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <main className="flex h-full flex-col bg-secondary">
      {/* Header */}
      <header className="border-b border-border bg-panel px-5 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold text-foreground">
            Новый объект
          </h1>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary p-0.5">
            <button
              onClick={() => setMode("manual")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                mode === "manual"
                  ? "bg-panel text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Pencil className="h-3.5 w-3.5" />
              Заполнить вручную
            </button>
            <button
              onClick={() => setMode("ai")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                mode === "ai"
                  ? "bg-panel text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Спросить ИИ
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* AI Chat panel — visible in AI mode */}
        {mode === "ai" && (
          <div className="flex w-[400px] shrink-0 flex-col border-r border-border bg-panel">
            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <Sparkles className="mb-2 h-8 w-8 text-teal" />
                  <p className="text-sm font-medium text-foreground">
                    Опишите объект словами
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ИИ задаст уточняющие вопросы и предложит готовую структуру
                  </p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                      msg.role === "user"
                        ? "bg-teal text-white"
                        : "bg-secondary text-foreground",
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div className="flex justify-start">
                  <div className="rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">
                    ИИ думает...
                  </div>
                </div>
              )}
              {aiError && (
                <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {aiError}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendChatMessage();
                    }
                  }}
                  placeholder="Опишите объект..."
                  disabled={aiLoading}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring disabled:opacity-50"
                />
                <Button
                  variant="teal"
                  size="icon"
                  onClick={sendChatMessage}
                  disabled={aiLoading || !input.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Form panel — always visible */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-5">
          <div className="mx-auto max-w-[700px] space-y-6">
            {mode === "ai" && messages.length > 0 && (
              <div className="rounded-lg border border-teal/30 bg-teal/5 px-4 py-2.5 text-sm text-foreground">
                Форма ниже предзаполнена ИИ. Проверьте и отредактируйте перед созданием.
              </div>
            )}

            {/* Basic info */}
            <section className="rounded-lg border border-border bg-panel p-4">
              <h2 className="mb-4 text-sm font-semibold text-foreground">
                Основная информация
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Название *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      updateForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Паркинг на 5 этажей"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Адрес
                  </label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) =>
                      updateForm((prev) => ({ ...prev, address: e.target.value }))
                    }
                    placeholder="ул. Пример, 1"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Общий бюджет, сум *
                  </label>
                  <input
                    type="text"
                    value={form.totalBudgetMinor}
                    onChange={(e) =>
                      updateForm((prev) => ({
                        ...prev,
                        totalBudgetMinor: e.target.value,
                      }))
                    }
                    placeholder="1250000.00"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono outline-none focus:border-ring"
                  />
                </div>
              </div>
            </section>

            {/* Stages */}
            <section className="rounded-lg border border-border bg-panel p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">
                  Этапы строительства
                </h2>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "font-mono text-sm tabular-nums",
                      weightValid ? "text-teal" : "text-danger",
                    )}
                  >
                    {weightSum} / 10000
                  </span>
                  <Button variant="outline" size="sm" onClick={addStage}>
                    <Plus className="h-3.5 w-3.5" />
                    Этап
                  </Button>
                </div>
              </div>
              {!weightValid && (
                <p className="mb-3 text-xs text-danger">
                  Сумма весов должна быть ровно 10000 (100%). Сейчас: {weightSum}.
                </p>
              )}
              <div className="space-y-2">
                {form.stages.map((stage, idx) => (
                  <div
                    key={stage.id}
                    className="grid grid-cols-[1fr_80px_100px_40px] items-center gap-2"
                  >
                    <input
                      type="text"
                      value={stage.name}
                      onChange={(e) =>
                        updateForm((prev) => ({
                          ...prev,
                          stages: prev.stages.map((s) =>
                            s.id === stage.id ? { ...s, name: e.target.value } : s,
                          ),
                        }))
                      }
                      placeholder={`Этап ${idx + 1}`}
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                    />
                    <input
                      type="number"
                      value={stage.floor}
                      min={0}
                      onChange={(e) =>
                        updateForm((prev) => ({
                          ...prev,
                          stages: prev.stages.map((s) =>
                            s.id === stage.id
                              ? { ...s, floor: parseInt(e.target.value) || 0 }
                              : s,
                          ),
                        }))
                      }
                      placeholder="Этаж"
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm font-mono outline-none focus:border-ring"
                    />
                    <input
                      type="number"
                      value={stage.weightBp}
                      min={0}
                      max={10000}
                      onChange={(e) =>
                        updateForm((prev) => ({
                          ...prev,
                          stages: prev.stages.map((s) =>
                            s.id === stage.id
                              ? { ...s, weightBp: parseInt(e.target.value) || 0 }
                              : s,
                          ),
                        }))
                      }
                      placeholder="Вес (bp)"
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm font-mono outline-none focus:border-ring"
                    />
                    <button
                      onClick={() => removeStage(stage.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                      aria-label="Удалить этап"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Budget lines */}
            <section className="rounded-lg border border-border bg-panel p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">
                  Статьи бюджета
                </h2>
                <Button variant="outline" size="sm" onClick={addBudgetLine}>
                  <Plus className="h-3.5 w-3.5" />
                  Статья
                </Button>
              </div>
              <div className="space-y-2">
                {form.budgetLines.map((bl) => (
                  <div
                    key={bl.id}
                    className="grid grid-cols-[1fr_160px_40px] items-center gap-2"
                  >
                    <input
                      type="text"
                      value={bl.category}
                      onChange={(e) =>
                        updateForm((prev) => ({
                          ...prev,
                          budgetLines: prev.budgetLines.map((b) =>
                            b.id === bl.id
                              ? { ...b, category: e.target.value }
                              : b,
                          ),
                        }))
                      }
                      placeholder="Материалы"
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                    />
                    <input
                      type="text"
                      value={bl.plannedMinor}
                      onChange={(e) =>
                        updateForm((prev) => ({
                          ...prev,
                          budgetLines: prev.budgetLines.map((b) =>
                            b.id === bl.id
                              ? { ...b, plannedMinor: e.target.value }
                              : b,
                          ),
                        }))
                      }
                      placeholder="500000.00"
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm font-mono outline-none focus:border-ring"
                    />
                    <button
                      onClick={() => removeBudgetLine(bl.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                      aria-label="Удалить статью"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Submit */}
            {serverError && (
              <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                {serverError}
              </div>
            )}
            <div className="flex items-center justify-end gap-3 pb-6">
              <Button variant="ghost" onClick={() => router.back()}>
                Отмена
              </Button>
              <Button
                variant="teal"
                onClick={handleSubmit}
                disabled={!formValid || submitting}
              >
                {submitting ? "Создание..." : "Создать"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
