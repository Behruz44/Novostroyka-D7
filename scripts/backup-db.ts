import { config } from "dotenv";
config();

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import * as Sentry from "@sentry/nextjs";

const execFileAsync = promisify(execFile);

const RETENTION_DAYS = 14;

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing env var: ${key}`);
  }
  return val;
}

function getDbNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    return path.replace(/^\//, "") || "unknown-db";
  } catch {
    return "unknown-db";
  }
}

async function runPgDump(): Promise<Buffer> {
  const dbUrl = getEnv("DATABASE_URL");
  const dbName = getDbNameFromUrl(dbUrl);

  const containerName = process.env.POSTGRES_CONTAINER || "novostroyka-postgres-1";
  const pgUser = process.env.POSTGRES_USER || "stroycontrol";

  console.log(`[backup] Running pg_dump for database "${dbName}" via container "${containerName}"...`);

  try {
    const { stdout } = await execFileAsync("docker", [
      "exec",
      containerName,
      "pg_dump",
      "-U",
      pgUser,
      "-d",
      dbName,
      "--no-owner",
      "--no-acl",
      "--format=plain",
    ], {
      maxBuffer: 100 * 1024 * 1024,
    });

    console.log(`[backup] pg_dump completed, size: ${(stdout.length / 1024).toFixed(1)} KB`);
    return Buffer.from(stdout, "utf-8");
  } catch (err) {
    console.error("[backup] pg_dump via docker failed, trying direct pg_dump...");
    const { stdout } = await execFileAsync("pg_dump", [
      dbUrl,
      "--no-owner",
      "--no-acl",
      "--format=plain",
    ], {
      maxBuffer: 100 * 1024 * 1024,
    });
    console.log(`[backup] pg_dump (direct) completed, size: ${(stdout.length / 1024).toFixed(1)} KB`);
    return Buffer.from(stdout, "utf-8");
  }
}

async function gzipData(data: Buffer): Promise<Buffer> {
  console.log(`[backup] Compressing with gzip...`);
  const gzip = createGzip();
  const source = Readable.from(data);
  const chunks: Buffer[] = [];

  await pipeline(
    source,
    gzip,
    new (require("node:stream").Writable)({
      write(chunk: Buffer, _enc: string, cb: () => void) {
        chunks.push(chunk);
        cb();
      },
    }),
  );

  const result = Buffer.concat(chunks);
  console.log(`[backup] Gzip done: ${(result.length / 1024).toFixed(1)} KB (ratio: ${(result.length / data.length * 100).toFixed(1)}%)`);
  return result;
}

function createS3Client(): S3Client {
  const endpoint = getEnv("S3_ENDPOINT");
  const region = process.env.S3_REGION || "us-east-1";
  const accessKeyId = getEnv("S3_ACCESS_KEY_ID");
  const secretAccessKey = getEnv("S3_SECRET_ACCESS_KEY");

  return new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
}

async function uploadToR2(
  client: S3Client,
  bucket: string,
  key: string,
  data: Buffer,
): Promise<void> {
  console.log(`[backup] Uploading to R2: s3://${bucket}/${key} (${(data.length / 1024).toFixed(1)} KB)`);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: data,
      ContentType: "application/gzip",
    }),
  );
  console.log(`[backup] Upload complete.`);
}

async function applyRetention(
  client: S3Client,
  bucket: string,
  prefix: string,
): Promise<void> {
  console.log(`[backup] Checking retention (delete backups older than ${RETENTION_DAYS} days)...`);

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const listResponse = await client.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }),
  );

  const objects = listResponse.Contents || [];
  if (objects.length === 0) {
    console.log(`[backup] No existing backups found in ${prefix}`);
    return;
  }

  console.log(`[backup] Found ${objects.length} objects in ${prefix}`);

  const toDelete: { Key: string }[] = [];
  for (const obj of objects) {
    if (!obj.Key) continue;
    const baseName = obj.Key.split("/").pop() || "";
    const dateMatch = baseName.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      const backupDate = new Date(
        parseInt(dateMatch[1]),
        parseInt(dateMatch[2]) - 1,
        parseInt(dateMatch[3]),
        parseInt(dateMatch[4]),
        parseInt(dateMatch[5]),
        parseInt(dateMatch[6]),
      );
      if (backupDate < cutoff) {
        console.log(`[backup]   DELETE: ${obj.Key} (backup date: ${backupDate.toISOString()})`);
        toDelete.push({ Key: obj.Key });
      }
    }
  }

  if (toDelete.length === 0) {
    console.log(`[backup] No backups older than ${RETENTION_DAYS} days found.`);
    return;
  }

  await client.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: toDelete },
    }),
  );
  console.log(`[backup] Deleted ${toDelete.length} old backup(s).`);
}

async function main() {
  console.log("=== DB BACKUP START ===");
  console.log(`[backup] Time: ${new Date().toISOString()}`);

  try {
    const dbUrl = getEnv("DATABASE_URL");
    const dbName = getDbNameFromUrl(dbUrl);
    const bucket = process.env.S3_BUCKET_NAME || "stroycontrol";
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, "-");
    const key = `backups/${dbName}/${dateStr}.sql.gz`;

    // 1. pg_dump
    const sqlDump = await runPgDump();

    // 2. gzip
    const compressed = await gzipData(sqlDump);

    // 3. Upload to R2
    const client = createS3Client();
    await uploadToR2(client, bucket, key, compressed);

    // 4. Retention
    await applyRetention(client, bucket, `backups/${dbName}/`);

    console.log(`\n[backup] SUCCESS: ${key}`);
    console.log("=== DB BACKUP END ===");
  } catch (err) {
    console.error("[backup] FAILED:", err);
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(err);
      await Sentry.flush(5000);
    }
    process.exit(1);
  }
}

main();
