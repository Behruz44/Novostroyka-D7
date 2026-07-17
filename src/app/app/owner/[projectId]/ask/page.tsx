"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { MessageCircle, Send, ImageIcon, Plus, MessageSquare } from "lucide-react";
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
  isTyping?: boolean;
  photosVisible?: boolean;
}

interface ThreadListItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

function PhotoThumbnail({ photoKey, visible }: { photoKey: string; visible: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    fetch(`/api/stage-marks/photo-url?key=${encodeURIComponent(photoKey)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.url) setUrl(data.url);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [photoKey, visible]);

  if (!visible) return null;

  if (errored || !url) {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-md border border-border bg-secondary animate-fade-in">
        <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt="Фото стройплощадки"
      className="h-16 w-16 rounded-md border border-border object-cover animate-fade-in"
      onError={() => setErrored(true)}
    />
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-typing-dot"
          style={{ animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </div>
  );
}

const CHARS_PER_FRAME = 2;
const FRAME_INTERVAL_MS = 50;

export default function PhotoChatPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Thread history state
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch(`/api/photo-chat/threads?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setThreads(data.threads || []);
      }
    } catch {}
  }, [projectId]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    };
  }, []);

  const startTypingAnimation = useCallback((msgIndex: number, fullText: string, hasPhotos: boolean) => {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);

    let charCount = 0;
    typingTimerRef.current = setInterval(() => {
      charCount += CHARS_PER_FRAME;
      const partial = fullText.slice(0, charCount);
      const isDone = charCount >= fullText.length;

      setMessages((prev) => {
        const next = [...prev];
        if (next[msgIndex]) {
          next[msgIndex] = {
            ...next[msgIndex],
            content: partial,
            isTyping: !isDone,
            photosVisible: isDone && hasPhotos,
          };
        }
        return next;
      });

      if (isDone) {
        if (typingTimerRef.current) {
          clearInterval(typingTimerRef.current);
          typingTimerRef.current = null;
        }
      }
    }, FRAME_INTERVAL_MS);
  }, []);

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
        body: JSON.stringify({ projectId, question, threadId: activeThreadId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка ИИ");
        return;
      }

      if (data.threadId) {
        setActiveThreadId(data.threadId);
      }

      const photos = data.photos || [];
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: "",
        photos: photos.length > 0 ? photos : undefined,
        isTyping: true,
        photosVisible: false,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      const msgIndex = messages.length + 1;
      startTypingAnimation(msgIndex, data.reply, photos.length > 0);

      // Refresh thread list
      fetchThreads();
    } catch {
      setError("Сетевая ошибка при обращении к ИИ");
    } finally {
      setLoading(false);
    }
  }

  async function loadThread(threadId: string) {
    setActiveThreadId(threadId);
    setMessages([]);
    setError("");
    try {
      const res = await fetch(`/api/photo-chat/threads/${threadId}`);
      if (res.ok) {
        const data = await res.json();
        const loaded: ChatMessage[] = (data.messages || []).map((m: { role: string; content: string; photoKeys: string[] }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          photos: m.photoKeys && m.photoKeys.length > 0
            ? m.photoKeys.map((k: string) => ({ photoKey: k, stageName: "", floor: 0, createdAt: "" }))
            : undefined,
          photosVisible: m.photoKeys && m.photoKeys.length > 0,
        }));
        setMessages(loaded);
      }
    } catch {}
  }

  function startNewDialog() {
    setActiveThreadId(null);
    setMessages([]);
    setError("");
    setInput("");
  }

  return (
    <div className="flex h-full">
      {/* Thread history sidebar */}
      <aside className="hidden w-[240px] shrink-0 flex-col border-r border-border bg-panel sm:flex">
        <div className="border-b border-border p-3">
          <button
            onClick={startNewDialog}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              !activeThreadId
                ? "bg-teal/10 text-teal"
                : "text-foreground hover:bg-secondary",
            )}
          >
            <Plus className="h-4 w-4" />
            Новый диалог
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {threads.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">
              История диалогов пуста
            </p>
          ) : (
            <div className="space-y-1">
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => loadThread(thread.id)}
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-md px-3 py-2 text-left transition-colors",
                    activeThreadId === thread.id
                      ? "bg-teal/10 text-foreground"
                      : "text-foreground hover:bg-secondary",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-xs font-medium">
                      {thread.title}
                    </span>
                  </div>
                  <span className="pl-5 text-[10px] text-muted-foreground">
                    {new Date(thread.updatedAt).toLocaleDateString("ru-RU")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Chat area */}
      <div className="flex min-w-0 flex-1 flex-col">
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
                      {msg.isTyping && (
                        <span className="inline-flex items-center ml-1 align-middle">
                          <span className="inline-block w-0.5 h-4 bg-teal animate-blink-cursor" />
                        </span>
                      )}
                    </div>
                    {msg.photos && msg.photos.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {msg.photos.map((photo, idx) => (
                          <div key={idx} className="flex flex-col items-center gap-1">
                            <PhotoThumbnail photoKey={photo.photoKey} visible={msg.photosVisible ?? false} />
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
                  <div className="rounded-lg bg-panel border border-border px-4 py-3">
                    <TypingDots />
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
      </div>
    </div>
  );
}
