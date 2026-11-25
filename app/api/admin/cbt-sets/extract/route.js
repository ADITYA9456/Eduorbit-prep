import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ModelError } from "@/lib/anthropic";
import { extractQuestionsFromImage, reserveExtractionCall } from "@/lib/cbtSets";
import { IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/cbtSetShared";
import { validateUpload } from "@/lib/uploadSafety";

export const runtime = "nodejs";
export const maxDuration = 120;

// Admin-only: one compressed page image in, extracted questions out. Nothing is stored.
export async function POST(request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  let image;
  try {
    image = (await request.formData()).get("image");
  } catch {
    return NextResponse.json({ error: "Expected a multipart image upload." }, { status: 400 });
  }
  if (!image || typeof image.arrayBuffer !== "function") return NextResponse.json({ error: "An image is required." }, { status: 400 });
  const mediaType = String(image.type || "").toLowerCase();
  if (!IMAGE_TYPES.includes(mediaType)) return NextResponse.json({ error: "Only JPG, PNG or WEBP images are supported." }, { status: 400 });
  if (image.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Image is larger than 4 MB after compression." }, { status: 413 });
  const buffer = Buffer.from(await image.arrayBuffer());
  const problem = validateUpload(buffer, mediaType, IMAGE_TYPES, MAX_UPLOAD_BYTES);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  try {
    if (!await reserveExtractionCall(admin.id, "QUESTIONS")) {
      return NextResponse.json({ error: "Extraction limit reached for this hour. Try again later." }, { status: 429 });
    }
    const questions = await extractQuestionsFromImage(buffer, mediaType);
    return NextResponse.json({ questions });
  } catch (error) {
    if (error instanceof ModelError) return NextResponse.json({ error: error.message || "Extraction failed." }, { status: error.status });
    console.error("[admin cbt-set extract]", error?.message || error);
    return NextResponse.json({ error: "Extraction failed. Try again." }, { status: 500 });
  }
}
