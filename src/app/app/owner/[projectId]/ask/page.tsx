"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { MessageCircle, Send, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  photos?: Array<{
    photoKey: string;
    stageName: string;
    floor: number;
    createdAt: string;
  }>;
}

function PhotoThumbnail({ photoKey }: { photoKey: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stage-marks/photo-url?key=${encodeURIComponent(photoKey)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.url) setUrl(data.url);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [photoKey]);

  if (errored || !url) {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-md border border-border bg-secondary">
        <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt="Фото стройплощадки"
      className="h-16 w-16 rounded-md border border-border object-cover"
      onError={() => setErrored(true)}
    />
  );
}

export default function PhotoChatPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendQuestion() {
    if (!input.trim() || loading) return;
    const question = input.trim();
    const userMsg: ChatMessage = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/photo-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, question }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка ИИ");
        return;
      }

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.reply,
        photos: data.photos || [],
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setError("Сетевая ошибка при обращении к ИИ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="border-b border-border bg-panel px-5 py-3">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-5 w-5 text-teal" aria-hidden />
          <h1 className="text-base font-semibold text-foreground">
            Спросить об объекте
          </h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-secondary p-4 lg:p-5">
        <div className="mx-auto max-w-[700px]">
          {messages.length === 0 && (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <MessageCircle className="mb-3 h-10 w-10 text-teal" />
              <p className="text-base font-medium text-foreground">
                Спросите ИИ о ходе строительства
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                ИИ проанализирует фото с площадки и ответит на ваш вопрос
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {[
                  "Что происходило на площадке на этой неделе?",
                  "Какие машины заехали сегодня?",
                  "Что происходило на этаже 3 на прошлой неделе?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="rounded-full border border-border bg-panel px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-teal/40 hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div className="max-w-[85%]">
                  <div
                    className={cn(
                      "rounded-lg px-4 py-3 text-sm",
                      msg.role === "user"
                        ? "bg-teal text-white"
                        : "bg-panel border border-border text-foreground",
                    )}
                  >
                    {msg.content}
                  </div>
                  {msg.photos && msg.photos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.photos.map((photo, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-1">
                          <PhotoThumbnail photoKey={photo.photoKey} />
                          <span className="text-[10px] text-muted-foreground">
                            {photo.floor === 0 ? "Общее" : `${photo.floor} эт.`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-panel border border-border px-4 py-3 text-sm text-muted-foreground">
                  ИИ анализирует фото...
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>
      </main>

      <div className="border-t border-border bg-panel p-3">
        <div className="mx-auto flex max-w-[700px] gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendQuestion();
              }
            }}
            placeholder="Спросите о ходе строительства..."
            disabled={loading}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring disabled:opacity-50"
          />
          <button
            onClick={sendQuestion}
            disabled={loading || !input.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-teal text-white transition-colors hover:bg-teal/90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}
