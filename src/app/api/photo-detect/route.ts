import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";
import { analyzePhoto } from "@/lib/services/photo-detect";

export const dynamic = "force-dynamic";

const MAX_REQUESTS_PER_HOUR = 30;
const HOUR_MS = 60 * 60 * 1000;

const KEY_RE = /^[A-Za-z0-9]+\/[0-9]{4}-[0-9]{2}\/[A-Za-z0-9-]+\.[A-Za-z0-9]+$/;

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
      error: `Превышен лимит анализов ИИ (${MAX_REQUESTS_PER_HOUR} в час). Попробуйте позже.`,
    };
  }

  const newEntry = entry ?? { timestamps: [] };
  newEntry.timestamps.push(Date.now());
  store.set(userId, newEntry);

  return { allowed: true };
}

interface RequestBody {
  photoKey?: string;
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

  const { photoKey } = body;

  if (!photoKey || typeof photoKey !== "string" || !KEY_RE.test(photoKey)) {
    return NextResponse.json(
      { error: "Некорректный photoKey" },
      { status: 400 },
    );
  }

  // Membership check — photoKey starts with projectId
  const projectId = photoKey.split("/")[0];
  if (
    session!.user.role !== "ADMIN" &&
    !session!.user.projectIds.includes(projectId)
  ) {
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
    const result = await analyzePhoto(photoKey);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Ошибка при анализе фото";
    console.error("[api/photo-detect] error:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
