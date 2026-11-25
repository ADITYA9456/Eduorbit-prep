// Best-effort fixed-window rate limiter kept in process memory.
// On serverless hosting every instance has its own counters, so this slows abuse but does not replace
// an edge or WAF limit (see SECURITY_REMAINING_RISKS.md). No Node-only imports: it also runs in middleware.

const buckets = new Map();
const MAX_BUCKETS = 10000;

function prune(now) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  if (buckets.size >= MAX_BUCKETS) buckets.clear();
}

// Returns { ok, remaining, retryAfter } and counts this call.
export function hit(key, { limit, windowMs }) {
  const now = Date.now();
  prune(now);
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  return { ok: bucket.count <= limit, remaining: Math.max(0, limit - bucket.count), retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
}

export function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded ? forwarded.split(",")[0].trim() : "";
  return first || request.headers.get("x-real-ip") || "unknown";
}

// Convenience for route handlers: returns a 429 Response when over the limit, otherwise null.
export function limitRequest(request, name, { limit, windowMs = 60 * 1000, userId = null }) {
  const subject = userId || clientIp(request);
  const result = hit(`${name}:${subject}`, { limit, windowMs });
  if (result.ok) return null;
  return new Response(JSON.stringify({ error: "Too many requests. Please slow down and try again shortly." }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": String(result.retryAfter) }
  });
}
