import { prisma } from "@/lib/db";
import { s3Client, S3_BUCKET } from "@/lib/storage";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { Prisma } from "@prisma/client";
import * as Sentry from "@sentry/nextjs";

const ROBOFLOW_ENDPOINT = "https://serverless.roboflow.com/coco/40";
const MODEL_ID = "coco/40";
const CONFIDENCE_THRESHOLD = 0.4;
const TIMEOUT_MS = 30_000;

export interface DetectionBox {
  class: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PhotoDetectionResult {
  photoKey: string;
  detections: DetectionBox[];
  modelId: string;
  imageWidth: number;
  imageHeight: number;
  cached: boolean;
}

interface RoboflowPrediction {
  class: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RoboflowResponse {
  predictions?: RoboflowPrediction[];
  image?: { width: number; height: number };
}

async function downloadPhotoAsBuffer(key: string): Promise<Buffer> {
  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
  );
  const bytes = await response.Body?.transformToByteArray();
  if (!bytes) throw new Error("Не удалось скачать фото из хранилища");
  return Buffer.from(bytes);
}

export async function analyzePhoto(photoKey: string): Promise<PhotoDetectionResult> {
  // Check cache first — photo is immutable, one analysis per photoKey forever
  const existing = await prisma.photoDetection.findUnique({
    where: { photoKey },
  });
  if (existing) {
    return {
      photoKey,
      detections: existing.detections as unknown as DetectionBox[],
      modelId: existing.modelId,
      imageWidth: existing.imageWidth,
      imageHeight: existing.imageHeight,
      cached: true,
    };
  }

  const apiKey = process.env.ROBOFLOW_API_KEY;
  if (!apiKey) throw new Error("ROBOFLOW_API_KEY не настроен");

  // Download photo from R2
  const imgBuf = await downloadPhotoAsBuffer(photoKey);
  const b64 = imgBuf.toString("base64");

  // Call Roboflow Serverless API
  const url = `${ROBOFLOW_ENDPOINT}?api_key=${apiKey}&confidence=${CONFIDENCE_THRESHOLD}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: b64,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      Sentry.captureException(new Error(`Roboflow timeout for ${photoKey}`));
      throw new Error("Таймаут при обращении к ИИ-сервису. Попробуйте ещё раз.");
    }
    Sentry.captureException(err);
    throw new Error("Не удалось связаться с ИИ-сервисом.");
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    console.error(
      `[photo-detect] Roboflow error ${response.status}: ${errBody.slice(0, 200)}`,
    );
    Sentry.captureException(
      new Error(`Roboflow API error ${response.status}: ${errBody.slice(0, 100)}`),
    );
    throw new Error("Ошибка ИИ-сервиса при анализе фото.");
  }

  const data: RoboflowResponse = await response.json();
  const imageWidth = data.image?.width ?? 0;
  const imageHeight = data.image?.height ?? 0;

  const detections: DetectionBox[] = (data.predictions || [])
    .filter((p) => p.confidence >= CONFIDENCE_THRESHOLD)
    .map((p) => ({
      class: p.class,
      confidence: p.confidence,
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
    }));

  // Save to DB (upsert — race-safe, photoKey is unique)
  const saved = await prisma.photoDetection.upsert({
    where: { photoKey },
    create: {
      photoKey,
      detections: detections as unknown as Prisma.JsonObject,
      modelId: MODEL_ID,
      imageWidth,
      imageHeight,
    },
    update: {
      detections: detections as unknown as Prisma.JsonObject,
      modelId: MODEL_ID,
      imageWidth,
      imageHeight,
    },
  });

  return {
    photoKey: saved.photoKey,
    detections,
    modelId: saved.modelId,
    imageWidth: saved.imageWidth,
    imageHeight: saved.imageHeight,
    cached: false,
  };
}
