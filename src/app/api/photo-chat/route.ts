import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";
import { answerPhotoQuestion } from "@/lib/services/photo-chat";

export const dynamic = "force-dynamic";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_REQUESTS_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;

interface UserRateLimit {
  timestamps: number[];
}

const store = new Map<string, UserRateLimit>();

function cleanupUser(userId: string): void {
  const now = Date.now();
  const entry = store.get(userId);
  if (!entry) return;
  entry.timestamps = entry.timestamps.filter((t) => now - t < HOUR_MS);
  if (entry.timestamps.length === 0) {
    store.delete(userId);
  }
}

function checkRateLimit(userId: string): { allowed: boolean; error?: string } {
  cleanupUser(userId);
  const entry = store.get(userId);
  const count = entry?.timestamps.length ?? 0;

  if (count >= MAX_REQUESTS_PER_HOUR) {
    return {
      allowed: false,
      error: `Превышен лимит запросов к ИИ (${MAX_REQUESTS_PER_HOUR} в час). Попробуйте позже.`,
    };
  }

  const newEntry = entry ?? { timestamps: [] };
  newEntry.timestamps.push(Date.now());
  store.set(userId, newEntry);

  return { allowed: true };
}

interface RequestBody {
  projectId?: string;
  question?: string;
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

  const { projectId, question } = body;

  if (!projectId || typeof projectId !== "string") {
    return NextResponse.json(
      { error: "projectId обязателен" },
      { status: 400 },
    );
  }

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return NextResponse.json(
      { error: "Вопрос обязателен" },
      { status: 400 },
    );
  }

  if (question.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Вопрос слишком длинный (максимум ${MAX_MESSAGE_LENGTH} символов)` },
      { status: 400 },
    );
  }

  // Membership check — first substantive security gate after RBAC
  if (session!.user.role !== "ADMIN" && !session!.user.projectIds.includes(projectId)) {
    return NextResponse.json({ error: "Нет доступа к проекту" }, { status: 403 });
  }

  // Rate limit check
  const userId = session!.user.id;
  const rlResult = checkRateLimit(userId);
  if (!rlResult.allowed) {
    return NextResponse.json(
      { error: rlResult.error },
      { status: 429 },
    );
  }

  try {
    const result = await answerPhotoQuestion(projectId, question.trim());
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Неизвестная ошибка ИИ";
    console.error("[api/photo-chat] error:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
