import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireRole(["ADMIN"] as Role[]);
  if (error) return error;

  const passwordHash = "test_password_hash_12345";
  const anthropicApiKey = "sk-ant-api03-fake-key-for-testing";
  const sessionToken = "next-auth.session-token|fake-token-value";

  const exceptionId = Sentry.captureException(new Error("Sentry test error — проверка доставки и скрабинга"));

  Sentry.captureMessage("Test: sensitive data in scope", {
    level: "info",
    extra: {
      passwordHash,
      anthropicApiKey,
      sessionToken,
      note: "Эти значения НЕ должны появиться в Sentry",
    },
  });

  return NextResponse.json({
    ok: true,
    message: "Тестовая ошибка отправлена в Sentry",
    sentryEventId: exceptionId,
    note: "passwordHash, anthropicApiKey, sessionToken были в scope — проверьте, что они отскраблены в Sentry",
  });
}
