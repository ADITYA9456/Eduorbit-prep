import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCurrentUser, createAdminToken, ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE } from "@/lib/auth";

const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function attemptKey(request, email) {
  return `${request.headers.get("x-forwarded-for") || "unknown"}:${email}`;
}

function isRateLimited(key) {
  const current = attempts.get(key);
  if (!current) return false;
  if (current.lockedUntil > Date.now()) return true;
  if (current.windowStarted + WINDOW_MS <= Date.now()) {
    attempts.delete(key);
    return false;
  }
  return current.failures >= MAX_ATTEMPTS;
}

function recordFailure(key) {
  const current = attempts.get(key);
  const next = current && current.windowStarted + WINDOW_MS > Date.now()
    ? { ...current, failures: current.failures + 1 }
    : { failures: 1, windowStarted: Date.now(), lockedUntil: 0 };
  if (next.failures >= MAX_ATTEMPTS) next.lockedUntil = Date.now() + LOCKOUT_MS;
  attempts.set(key, next);
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const key = attemptKey(request, user.email);
  if (isRateLimited(key)) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  const body = await request.json().catch(() => ({}));
  const hash = process.env.ADMIN_PASSWORD_HASH;
  const valid = hash && typeof body.password === "string" && await bcrypt.compare(body.password, hash);
  if (!valid) {
    recordFailure(key);
    return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
  }
  attempts.delete(key);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, createAdminToken(user.email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ADMIN_COOKIE_MAX_AGE,
    path: "/"
  });
  return response;
}
