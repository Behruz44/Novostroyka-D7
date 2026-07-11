import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";
import { createPresignedPut, buildObjectKey } from "@/lib/storage";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const VALID_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
]);

interface PresignRequest {
  projectId?: string;
  filename?: string;
  contentType?: string;
  contentLength?: number;
}

export async function POST(request: Request) {
  const { session, error } = await requireRole([
    "OWNER",
    "FOREMAN",
    "ADMIN",
  ] as Role[]);

  if (error) return error;

  let body: PresignRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Некорректный запрос" },
      { status: 400 },
    );
  }

  const { projectId, filename, contentType, contentLength } = body;

  if (!projectId || !filename || !contentType || !contentLength) {
    return NextResponse.json(
      { error: "Не указаны projectId, filename, contentType или contentLength" },
      { status: 400 },
    );
  }

  if (!contentType.startsWith("image/")) {
    return NextResponse.json(
      { error: "Допускаются только изображения" },
      { status: 400 },
    );
  }

  if (contentLength > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Размер файла превышает 10 МБ" },
      { status: 400 },
    );
  }

  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (!VALID_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { error: `Недопустимое расширение: .${ext}. Допускаются: ${[...VALID_EXTENSIONS].join(", ")}` },
      { status: 400 },
    );
  }

  const userProjectIds = session!.user.projectIds;
  if (session!.user.role !== "ADMIN" && !userProjectIds.includes(projectId)) {
    return NextResponse.json(
      { error: "Нет доступа к проекту" },
      { status: 403 },
    );
  }

  const key = buildObjectKey(projectId, ext);

  try {
    const url = await createPresignedPut(key, contentType, contentLength);
    return NextResponse.json({ url, key });
  } catch (err) {
    console.error("[uploads/presign] Failed to create presigned URL:", err);
    return NextResponse.json(
      { error: "Ошибка при создании ссылки для загрузки" },
      { status: 500 },
    );
  }
}
