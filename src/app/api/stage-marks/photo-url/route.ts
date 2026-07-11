import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";
import { createPresignedGet } from "@/lib/storage";

export const dynamic = "force-dynamic";

const KEY_RE = /^[A-Za-z0-9]+\/[0-9]{4}-[0-9]{2}\/[A-Za-z0-9-]+\.[A-Za-z0-9]+$/;

export async function GET(request: Request) {
  const { session, error } = await requireRole([
    "OWNER",
    "FOREMAN",
    "ADMIN",
  ] as Role[]);

  if (error) return error;

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (!key || !KEY_RE.test(key)) {
    return NextResponse.json(
      { error: "Некорректный ключ" },
      { status: 400 },
    );
  }

  const projectId = key.split("/")[0];
  if (
    session!.user.role !== "ADMIN" &&
    !session!.user.projectIds.includes(projectId)
  ) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  try {
    const url = await createPresignedGet(key);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("photo-url presign failed", { key, error: err });
    return NextResponse.json(
      { error: "Не удалось создать ссылку" },
      { status: 500 },
    );
  }
}
