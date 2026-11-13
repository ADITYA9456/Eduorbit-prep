import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ModelError } from "@/lib/anthropic";
import { extractAnswerKey, reserveExtractionCall } from "@/lib/cbtSets";
import { IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/cbtSetShared";

export const runtime = "nodejs";
export const maxDuration = 120;

// Admin-only: answer-key image or PDF in, number-to-key pairs out. Pasted text is parsed in the browser.
export async function POST(request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  let file;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return NextResponse.json({ error: "Expected a multipart upload." }, { status: 400 });
  }
  if (!file || typeof file.arrayBuffer !== "function") return NextResponse.json({ error: "A file is required." }, { status: 400 });
  const mediaType = String(file.type || "").toLowerCase();
  if (![...IMAGE_TYPES, "application/pdf"].includes(mediaType)) return NextResponse.json({ error: "Use a JPG, PNG, WEBP or PDF answer key." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "File is larger than 4 MB." }, { status: 413 });
  try {
    if (!await reserveExtractionCall(admin.id, "ANSWER_KEY")) {
      return NextResponse.json({ error: "Extraction limit reached for this hour. Try again later." }, { status: 429 });
    }
    const pairs = await extractAnswerKey(Buffer.from(await file.arrayBuffer()), mediaType);
    return NextResponse.json({ pairs });
  } catch (error) {
    const status = error instanceof ModelError ? error.status : 500;
    return NextResponse.json({ error: error.message || "Answer key extraction failed." }, { status });
  }
}
