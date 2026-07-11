import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbOk = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (err) {
    console.error("[health] DB check failed:", err);
  }

  return NextResponse.json(
    { ok: true, db: dbOk },
    { status: dbOk ? 200 : 503 },
  );
}
