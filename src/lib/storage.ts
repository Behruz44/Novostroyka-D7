import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const endpoint = process.env.S3_ENDPOINT;
const region = process.env.S3_REGION || "us-east-1";
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
const bucket = process.env.S3_BUCKET_NAME || "stroycontrol";

export const s3Client = new S3Client({
  region,
  endpoint,
  credentials: {
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
  },
  forcePathStyle: true,
});

export const S3_BUCKET = bucket;

const PRESIGN_EXPIRY = 120;

export async function createPresignedPut(
  key: string,
  contentType: string,
  contentLength: number,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: PRESIGN_EXPIRY,
  });
}

export function buildObjectKey(
  projectId: string,
  extension: string,
): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const uuid = crypto.randomUUID();
  return `${projectId}/${yyyy}-${mm}/${uuid}.${extension}`;
}

export async function createPresignedGet(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn: PRESIGN_EXPIRY });
}

export async function verifyUploadedSize(
  key: string,
  expectedMaxBytes: number,
): Promise<{ ok: boolean; actualSize?: number; error?: string }> {
  try {
    const response = await s3Client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );

    const actualSize = response.ContentLength ?? 0;

    if (actualSize > expectedMaxBytes) {
      await s3Client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: key }),
      );
      return {
        ok: false,
        actualSize,
        error: `Размер файла (${actualSize} байт) превышает лимит (${expectedMaxBytes} байт). Объект удалён.`,
      };
    }

    return { ok: true, actualSize };
  } catch (err) {
    return {
      ok: false,
      error: `Не удалось проверить объект в хранилище: ${err instanceof Error ? err.message : "неизвестная ошибка"}`,
    };
  }
}
