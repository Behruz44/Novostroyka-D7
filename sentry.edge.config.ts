import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN;

const SENSITIVE_KEYS = [
  "passwordhash",
  "password",
  "anthropic_api_key",
  "api_key",
  "auth_token",
  "sentry_auth_token",
  "session-token",
  "next-auth.session-token",
  "secretaccesskey",
  "secret_access_key",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
];

/* eslint-disable @typescript-eslint/no-explicit-any */
function scrubValue(value: any): any {
  if (typeof value === "string") {
    for (const key of SENSITIVE_KEYS) {
      if (value.toLowerCase().includes(key)) {
        return "[Filtered]";
      }
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(scrubValue);
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEYS.includes(k.toLowerCase())) {
        result[k] = "[Filtered]";
      } else {
        result[k] = scrubValue(v);
      }
    }
    return result;
  }
  return value;
}

function scrubEvent(event: any): any {
  if (!event) return event;
  if (event.request) event.request = scrubValue(event.request);
  if (event.extra) event.extra = scrubValue(event.extra);
  if (event.contexts) event.contexts = scrubValue(event.contexts);
  if (event.user) {
    const user = { ...event.user };
    if (user.ip_address) user.ip_address = "[Filtered]";
    event.user = user;
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b: any) => ({
      ...b,
      data: b.data ? scrubValue(b.data) : b.data,
    }));
  }
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((ex: any) => {
      if (ex.stacktrace?.frames) {
        ex.stacktrace.frames = ex.stacktrace.frames.map((f: any) => ({
          ...f,
          vars: f.vars ? scrubValue(f.vars) : f.vars,
        }));
      }
      return ex;
    });
  }
  return event;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

if (SENTRY_DSN && SENTRY_DSN.length > 0) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      return scrubEvent(event);
    },
    beforeSendTransaction(event) {
      return scrubEvent(event);
    },
  });
}
