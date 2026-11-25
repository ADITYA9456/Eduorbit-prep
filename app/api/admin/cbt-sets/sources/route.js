import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireAdmin } from "@/lib/auth";
import { uploadCbtSetImage } from "@/lib/cbtSets";
import { IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/cbtSetShared";
import { limitRequest } from "@/lib/rateLimit";
import { validateUpload } from "@/lib/uploadSafety";
import { saveFailed } from "@/lib/adminHttp";

export const runtime = "nodejs";

const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Admin-only: stores one source image while a set is being saved. Called once per image so each request stays small.
export async function POST(request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const limited = limitRequest(request, "admin-upload", { limit: 60, userId: admin.id }); if (limited) return limited;
  let form;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart image upload." }, { status: 400 });
  }
  const image = form.get("image");
  const draftId = String(form.get("draftId") || "");
  if (!/^[0-9a-f-]{36}$/i.test(draftId)) return NextResponse.json({ error: "Invalid draft id." }, { status: 400 });
  if (!image || typeof image.arrayBuffer !== "function") return NextResponse.json({ error: "An image is required." }, { status: 400 });
  const mediaType = String(image.type || "").toLowerCase();
  if (!IMAGE_TYPES.includes(mediaType)) return NextResponse.json({ error: "Only JPG, PNG or WEBP images are supported." }, { status: 400 });
  if (image.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Image is larger than 4 MB." }, { status: 413 });
  const buffer = Buffer.from(await image.arrayBuffer());
  const problem = validateUpload(buffer, mediaType, IMAGE_TYPES, MAX_UPLOAD_BYTES);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const path = `cbt-sets/${admin.id}/${draftId}/${crypto.randomUUID()}.${EXTENSIONS[mediaType]}`;
  try {
    await uploadCbtSetImage(path, buffer, mediaType);
    return NextResponse.json({ path }, { status: 201 });
  } catch (error) {
    return saveFailed(error, "admin cbt-set source upload");
  }
}
