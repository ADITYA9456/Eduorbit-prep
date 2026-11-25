import { NextResponse } from "next/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === "string" && UUID.test(value);
}

// Logs the real error on the server and returns a generic message, so database and
// stack details never reach the browser.
export function serverError(error, context = "request", status = 500) {
  console.error(`[${context}]`, error?.message || error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status });
}

export function badRequest(message) {
  return NextResponse.json({ error: message }, { status: 400 });
}

// Parses a JSON body, refusing oversized or malformed payloads. Returns null on failure.
export async function readJson(request, maxBytes = 256 * 1024) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  try {
    const text = await request.text();
    if (text.length > maxBytes) return null;
    const value = JSON.parse(text);
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

export function tooLarge() {
  return NextResponse.json({ error: "Request is invalid or too large." }, { status: 400 });
}
