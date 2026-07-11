const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
}

const store = new Map<string, RateLimitEntry>();

function cleanup(): void {
  const now = Date.now();
  for (const [ip, entry] of store) {
    if (now - entry.firstAttempt > WINDOW_MS) {
      store.delete(ip);
    }
  }
}

export function rateLimit(
  ip: string,
): { allowed: boolean; retryAfter: number } {
  cleanup();

  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    store.set(ip, { count: 1, firstAttempt: now });
    return { allowed: true, retryAfter: 0 };
  }

  entry.count++;

  if (entry.count > MAX_ATTEMPTS) {
    const retryAfter = Math.ceil(
      (WINDOW_MS - (now - entry.firstAttempt)) / 1000,
    );
    return { allowed: false, retryAfter };
  }

  return { allowed: true, retryAfter: 0 };
}
