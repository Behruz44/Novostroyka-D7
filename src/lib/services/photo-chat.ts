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

interface IntentResult {
  isPhotoQuestion: boolean;
  from?: string;
  to?: string;
}

async function analyzeIntent(question: string): Promise<IntentResult> {
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
            content: `Ты — классификатор вопросов для строительного приложения «СтройКонтроль». Сегодня ${today}.\n\nПользователь находится в разделе «Спросить об объекте», где ИИ анализирует ФОТО со стройплощадки. Нужно определить, относится ли вопрос к просмотру/анализу фото с площадки.\n\nОтветь ТОЛЬКО JSON без пояснений:\n{"isPhotoQuestion": true/false, "from": "YYYY-MM-DD", "to": "YYYY-MM-DD"}\n\nisPhotoQuestion=true — вопрос про ТО ЧТО УЖЕ ПРОИЗОШЛО на площадке: «что происходило», «какие работы», «что видно на фото», «какой этап», «что сделали на этой неделе».\nisPhotoQuestion=false — вопрос про ПЛАНИРОВАНИЕ или НЕ СВЯЗАН со стройкой: «хочу построить», «помоги рассчитать бюджет», «создать новый объект», «какая погода», «как добавить расход».\n\nКлючевое отличие: photo-вопрос смотрит в ПРОШЛОЕ (что уже сделано на площадке), non-photo смотрит в БУДУЩЕЕ или не связан с конкретной площадкой.\n\nfrom/to — диапазон дат. Если вопрос без явной даты — последние 3 дня от сегодня.\n\nВопрос: ${question}`,
          },
        ],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Истекло время ожидания при анализе вопроса.");
    }
    throw new Error("ИИ недоступен для анализа вопроса.");
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    console.error(
      `[photo-chat] intent analysis error ${response.status}: ${errBody.slice(0, 200)}`,
    );
    throw new Error("Ошибка ИИ при анализе вопроса.");
  }

  const data = await response.json();
  const text: string =
    data.content?.map((c: { text?: string }) => c.text).join("") ?? "";

  let parsed: IntentResult;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const raw = jsonMatch ? jsonMatch[0] : text;
    parsed = JSON.parse(raw);
  } catch {
    return { isPhotoQuestion: true, from: fallbackFrom(), to: fallbackTo() };
  }

  if (typeof parsed.isPhotoQuestion !== "boolean") {
    return { isPhotoQuestion: true, from: fallbackFrom(), to: fallbackTo() };
  }

  if (parsed.isPhotoQuestion) {
    if (!parsed.from || !parsed.to || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.from) || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.to)) {
      return { isPhotoQuestion: true, from: fallbackFrom(), to: fallbackTo() };
    }
  }

  return parsed;
}

function fallbackFrom(): string {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 3);
  return from.toISOString().slice(0, 10);
}

function fallbackTo(): string {
  return new Date().toISOString().slice(0, 10);
}

async function answerNonPhotoQuestion(question: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY не настроен");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

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
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: `Ты — помощник в строительном приложении «СтройКонтроль». Пользователь (заказчик) написал сообщение, которое не относится к фото-архиву стройплощадки.\n\nКоротко и вежливо ответь на русском. Если пользователь хочет создать новый объект — направь в раздел «+ Новый». Если вопрос не по теме приложения — скажи это честно.\n\nСообщение пользователя: ${question}`,
          },
        ],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      return "Истекло время ожидания. Попробуйте переформулировать вопрос.";
    }
    return "ИИ недоступен. Попробуйте позже.";
  }
  clearTimeout(timeout);

  if (!response.ok) {
    return "Не удалось обработать вопрос. Попробуйте позже.";
  }

  const data = await response.json();
  const text: string =
    data.content?.map((c: { text?: string }) => c.text).join("") ?? "";

  return text || "Не удалось обработать вопрос.";
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

  const intent = await analyzeIntent(question);

  if (!intent.isPhotoQuestion) {
    const reply = await answerNonPhotoQuestion(question);
    return { reply, photos: [] };
  }

  const { from, to } = intent;

  const fromDate = new Date(from! + "T00:00:00.000Z");
  const toDate = new Date(to! + "T23:59:59.999Z");

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

  // Fetch any existing AI detections for the sampled photos
  const photoKeysForDetections = sampled.map((p) => p.photoKey);
  const existingDetections = await prisma.photoDetection.findMany({
    where: { photoKey: { in: photoKeysForDetections } },
    select: { photoKey: true, detections: true },
  });
  const detectionMap = new Map<string, { class: string; confidence: number }[]>();
  for (const d of existingDetections) {
    detectionMap.set(d.photoKey, d.detections as { class: string; confidence: number }[]);
  }

  // Build detection summary text for prompt
  const detectionSummaries: string[] = [];
  for (const photo of sampled) {
    const dets = detectionMap.get(photo.photoKey);
    if (dets && dets.length > 0) {
      const counts: Record<string, number> = {};
      for (const d of dets) {
        counts[d.class] = (counts[d.class] ?? 0) + 1;
      }
      const parts = Object.entries(counts).map(([cls, n]) => `${cls}: ${n}`);
      detectionSummaries.push(`- ${photo.photoKey}: ${parts.join(", ")}`);
    }
  }
  const detectionContext = detectionSummaries.length > 0
    ? `\n\nДанные ИИ-детекции объектов на фото:\n${detectionSummaries.join("\n")}\n`
    : "";

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
    text: `Вопрос владельца: ${question}\n\nТы анализируешь фото стройплощадки. Ответь на вопрос владельца по тому, что видно на фото. Если видишь технику/людей/машины — опиши. Если на вопрос нельзя ответить по этим фото — честно скажи, что не видно. Ответь на русском языке.${detectionContext}`,
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
