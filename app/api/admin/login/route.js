import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCurrentUser, createAdminToken, ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE } from "@/lib/auth";
import { hit } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

// Keyed on the authenticated admin's email only (never on a client-supplied header).
// hit() always increments, so it is called only after a failed password; the lock map lets the next
// attempt be rejected without counting. A successful login bumps the generation to start a fresh count.
const locks = new Map();
const generations = new Map();

function failureKey(email) {
  return `adminlogin:${email}:${generations.get(email) || 0}`;
}

function lockedFor(email) {
  const until = locks.get(email);
  if (!until) return 0;
  if (until <= Date.now()) { locks.delete(email); return 0; }
  return Math.ceil((until - Date.now()) / 1000);
}

function recordFailure(email) {
  const result = hit(failureKey(email), { limit: MAX_FAILURES, windowMs: WINDOW_MS });
  if (result.remaining === 0) locks.set(email, Date.now() + WINDOW_MS);
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const retryAfter = lockedFor(user.email);
  if (retryAfter) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  const body = await request.json().catch(() => ({}));
  const hash = process.env.ADMIN_PASSWORD_HASH;
  const valid = hash && typeof body?.password === "string" && body.password.length <= 1024 && await bcrypt.compare(body.password, hash);
  if (!valid) {
    recordFailure(user.email);
    await logAdminAction(user, "admin.login.failure", { request });
    return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
  }
  locks.delete(user.email);
  generations.set(user.email, (generations.get(user.email) || 0) + 1);
  await logAdminAction(user, "admin.login.success", { request });
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
