import { NextResponse } from "next/server";
import { clientIp, hit } from "@/lib/rateLimit";

const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const API_LIMIT = { limit: 300, windowMs: 60 * 1000 };

function json(status, error, headers = {}) {
  return NextResponse.json({ error }, { status, headers });
}

// Runs for /api/* only. NextAuth keeps its own CSRF protection under /api/auth.
export function middleware(request) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/auth")) return NextResponse.next();

  const ip = clientIp(request);
  const result = hit(`api:${ip}`, API_LIMIT);
  if (!result.ok) return json(429, "Too many requests. Please slow down and try again shortly.", { "Retry-After": String(result.retryAfter) });

  if (STATE_CHANGING.has(request.method)) {
    // Browsers always send Origin on cross-origin and same-origin POSTs. Refuse any that point elsewhere.
    const origin = request.headers.get("origin");
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    if (origin) {
      let originHost = "";
      try { originHost = new URL(origin).host; } catch { originHost = ""; }
      if (!originHost || originHost !== host) return json(403, "Cross-origin requests are not allowed.");
    } else if (request.headers.get("sec-fetch-site") === "cross-site") {
      return json(403, "Cross-origin requests are not allowed.");
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*"] };
