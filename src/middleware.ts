import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit } from "./lib/rate-limit";

const authMiddleware = withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    const role = token?.role as string | undefined;

    if (path.startsWith("/app/owner")) {
      if (role !== "OWNER" && role !== "ADMIN") {
        return NextResponse.rewrite(new URL("/403", req.url));
      }
    }

    if (path.startsWith("/app/foreman")) {
      if (role !== "FOREMAN" && role !== "ADMIN") {
        return NextResponse.rewrite(new URL("/403", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  },
);

export default function middleware(req: NextRequest, context: unknown) {
  const path = req.nextUrl.pathname;

  if (path === "/api/auth/callback/credentials" && req.method === "POST") {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      req.ip ||
      "unknown";
    const result = rateLimit(ip);
    if (!result.allowed) {
      return NextResponse.json(
        { error: "Слишком много попыток входа. Попробуйте позже." },
        {
          status: 429,
          headers: { "Retry-After": String(result.retryAfter) },
        },
      );
    }
    return NextResponse.next();
  }

  return authMiddleware(req as never, context as never);
}

export const config = {
  matcher: ["/app/:path*", "/api/auth/callback/credentials"],
};
