import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";
import {
  generateProjectDraft,
  type ChatMessageInput,
} from "@/lib/services/ai-project-draft";

export const dynamic = "force-dynamic";

// --- Rate limiting (in-memory, per-user) ---
// Max 10 messages per dialog session, max 5 dialogs per hour per user

interface DialogSession {
  messageCount: number;
  startedAt: number;
}

interface UserRateLimit {
  dialogs: DialogSession[];
}

const MAX_MESSAGES_PER_DIALOG = 10;
const MAX_DIALOGS_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;
const MAX_MESSAGE_LENGTH = 2000;

const store = new Map<string, UserRateLimit>();

function cleanupUser(userId: string): void {
  const now = Date.now();
  const entry = store.get(userId);
  if (!entry) return;
  entry.dialogs = entry.dialogs.filter((d) => now - d.startedAt < HOUR_MS);
  if (entry.dialogs.length === 0) {
    store.delete(userId);
  }
}

function checkRateLimit(
  userId: string,
  messageCount: number,
): { allowed: boolean; error?: string } {
  cleanupUser(userId);

  // Check message count for current dialog
  if (messageCount > MAX_MESSAGES_PER_DIALOG) {
    return {
      allowed: false,
      error: `Превышен лимит сообщений в диалоге (максимум ${MAX_MESSAGES_PER_DIALOG}). Начните новый диалог.`,
    };
  }

  const entry = store.get(userId);

  // If this is the first message of a new dialog (messageCount === 1)
  if (messageCount === 1) {
    const dialogs = entry?.dialogs ?? [];
    if (dialogs.length >= MAX_DIALOGS_PER_HOUR) {
      return {
        allowed: false,
        error: `Превышен лимит диалогов с ИИ (${MAX_DIALOGS_PER_HOUR} в час). Попробуйте позже.`,
      };
    }
    // Start new dialog session
    const newEntry = entry ?? { dialogs: [] };
    newEntry.dialogs.push({ messageCount: 1, startedAt: Date.now() });
    store.set(userId, newEntry);
  } else {
    // Update existing dialog's message count
    if (entry) {
      const latest = entry.dialogs[entry.dialogs.length - 1];
      if (latest) {
        latest.messageCount = messageCount;
      }
    }
  }

  return { allowed: true };
}

interface RequestBody {
  messages?: ChatMessageInput[];
}

export async function POST(request: Request) {
  const { session, error } = await requireRole(["OWNER", "ADMIN"] as Role[]);
  if (error) return error;

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const messages = body.messages;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "Сообщения обязательны" },
      { status: 400 },
    );
  }

  // Validate message structure
  for (const msg of messages) {
    if (
      (msg.role !== "user" && msg.role !== "assistant") ||
      typeof msg.content !== "string" ||
      msg.content.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Некорректный формат сообщений" },
        { status: 400 },
      );
    }
    if (msg.content.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Сообщение слишком длинное (максимум ${MAX_MESSAGE_LENGTH} символов)` },
        { status: 400 },
      );
    }
  }

  // Rate limit check
  const userId = session!.user.id;
  const messageCount = messages.length;
  const rlResult = checkRateLimit(userId, messageCount);
  if (!rlResult.allowed) {
    return NextResponse.json(
      { error: rlResult.error },
      { status: 429 },
    );
  }

  // Call Anthropic API
  try {
    const result = await generateProjectDraft(messages);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Неизвестная ошибка ИИ";
    console.error("[api/ai/project-draft] error:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
