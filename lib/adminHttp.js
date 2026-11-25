import { NextResponse } from "next/server";

export const SAVE_FAILED = "Could not save. Check the values and try again.";

// Logs the real database error and answers with a generic 400, so internals never reach the browser.
export function saveFailed(error, context = "admin save") {
  console.error(`[${context}]`, error?.message || error);
  return NextResponse.json({ error: SAVE_FAILED }, { status: 400 });
}
