import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

if (SENTRY_DSN && SENTRY_DSN.length > 0) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}
