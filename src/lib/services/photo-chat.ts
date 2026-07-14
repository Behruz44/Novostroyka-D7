import { prisma } from "@/lib/db";
import { s3Client, S3_BUCKET } from "@/lib/storage";
import { GetObjectCommand } from "@aws-sdk/client-s3";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";
const TIMEOUT_MS = 60_000;
const MAX_PHOTOS = 12;

export interface PhotoWithMeta {
  photoKey: string;
  stageName: string;
  floor: number;
  createdAt: string;
}

export interface PhotoChatResult {
  reply: string;
  photos: PhotoWithMeta[];
}

interface DateRange {
  from: string;
  to: string;
}

async function extractDateRange(question: string): Promise<DateRange> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY не настроен");

  const today = new Date().toISOString().slice(0, 10);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 256,
        messages: [
          {
            role: "user",
            content: `Извлеки диапазон дат из вопроса пользователя. Сегодня ${today}. Ответь ТОЛЬКО JSON {"from":"YYYY-MM-DD","to":"YYYY-MM-DD"}, без пояснений. Если вопрос без явной даты — верни последние 3 дня от сегодня.\n\nВопрос: ${question}`,
          },
        ],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Истекло время ожидания при определении дат.");
    }
    throw new Error("ИИ недоступен для определения дат.");
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    console.error(
      `[photo-chat] date extraction error ${response.status}: ${errBody.slice(0, 200)}`,
    );
    throw new Error("Ошибка ИИ при определении дат.");
  }

  const data = await response.json();
  const text: string =
    data.content?.map((c: { text?: string }) => c.text).join("") ?? "";

  let parsed: DateRange;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const raw = jsonMatch ? jsonMatch[0] : text;
    parsed = JSON.parse(raw);
  } catch {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 3);
    return {
      from: from.toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
    };
  }

  if (!parsed.from || !parsed.to || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.from) || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.to)) {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 3);
    return {
      from: from.toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
    };
  }

  return parsed;
}

async function downloadPhotoAsBase64(key: string): Promise<{ base64: string; mediaType: string } | null> {
  try {
    const response = await s3Client.send(
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
    );
    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) return null;

    const buf = Buffer.from(bytes);
    const base64 = buf.toString("base64");

    const ext = key.split(".").pop()?.toLowerCase() ?? "";
    const mediaType =
      ext === "png" ? "image/png" :
      ext === "webp" ? "image/webp" :
      ext === "gif" ? "image/gif" :
      "image/jpeg";

    return { base64, mediaType };
  } catch (err) {
    console.error(`[photo-chat] Failed to download ${key}:`, err);
    return null;
  }
}

function uniformSample<T>(arr: T[], maxCount: number): T[] {
  if (arr.length <= maxCount) return arr;
  const step = arr.length / maxCount;
  const result: T[] = [];
  for (let i = 0; i < maxCount; i++) {
    result.push(arr[Math.floor(i * step)]);
  }
  return result;
}

export async function answerPhotoQuestion(
  projectId: string,
  question: string,
): Promise<PhotoChatResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error("ANTHROPIC_API_KEY не настроен на сервере");
  }

  const { from, to } = await extractDateRange(question);

  const fromDate = new Date(from + "T00:00:00.000Z");
  const toDate = new Date(to + "T23:59:59.999Z");

  const marks = await prisma.stageMark.findMany({
    where: {
      createdAt: { gte: fromDate, lte: toDate },
      stage: { projectId },
    },
    include: {
      stage: { select: { name: true, floor: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const allPhotos: PhotoWithMeta[] = [];
  for (const mark of marks) {
    for (const key of mark.photoKeys) {
      allPhotos.push({
        photoKey: key,
        stageName: mark.stage?.name ?? "—",
        floor: mark.stage?.floor ?? 0,
        createdAt: mark.createdAt.toISOString(),
      });
    }
  }

  if (allPhotos.length === 0) {
    return {
      reply: `За период с ${from} по ${to} фото не найдено. Попробуйте изменить диапазон дат в вопросе.`,
      photos: [],
    };
  }

  const sampled = uniformSample(allPhotos, MAX_PHOTOS);

  const photoContents: Array<
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
    | { type: "text"; text: string }
  > = [];

  const usedPhotos: PhotoWithMeta[] = [];

  for (const photo of sampled) {
    const downloaded = await downloadPhotoAsBase64(photo.photoKey);
    if (downloaded) {
      photoContents.push({
        type: "image",
        source: {
          type: "base64",
          media_type: downloaded.mediaType,
          data: downloaded.base64,
        },
      });
      usedPhotos.push(photo);
    }
  }

  if (photoContents.length === 0) {
    return {
      reply: `За период с ${from} по ${to} найдено ${allPhotos.length} фото, но не удалось загрузить ни одного. Возможны проблемы с хранилищем.`,
      photos: [],
    };
  }

  photoContents.push({
    type: "text",
    text: `Вопрос владельца: ${question}\n\nТы анализируешь фото стройплощадки. Ответь на вопрос владельца по тому, что видно на фото. Если видишь технику/людей/машины — опиши. Если на вопрос нельзя ответить по этим фото — честно скажи, что не видно. Ответь на русском языке.`,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: photoContents,
          },
        ],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Истекло время ожидания ответа ИИ. Попробуйте еще раз.");
    }
    throw new Error("ИИ недоступен. Попробуйте позже.");
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    console.error(
      `[photo-chat] Vision API error ${response.status}: ${errBody.slice(0, 200)}`,
    );
    if (response.status === 429) {
      throw new Error("Превышен лимит запросов к ИИ. Попробуйте через минуту.");
    }
    if (response.status >= 500) {
      throw new Error("Сервис ИИ временно недоступен. Попробуйте позже.");
    }
    throw new Error(`Ошибка ИИ (${response.status})`);
  }

  const data = await response.json();
  const replyText: string =
    data.content?.map((c: { text?: string }) => c.text).join("") ?? "";

  return {
    reply: replyText,
    photos: usedPhotos,
  };
}
