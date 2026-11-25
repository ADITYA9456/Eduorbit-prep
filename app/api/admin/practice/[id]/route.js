import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getPrepTable, getSupabaseServer } from "@/lib/supabase";
import { uploadSource } from "@/lib/cbt";
import crypto from "node:crypto";
import { isUuid, readJson, serverError, tooLarge } from "@/lib/http";
import { saveFailed } from "@/lib/adminHttp";
import { limitRequest } from "@/lib/rateLimit";
import { safeFileName, validateUpload } from "@/lib/uploadSafety";
import { logAdminAction } from "@/lib/audit";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function PATCH(request, { params }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid test id." }, { status: 400 });
  const body = await readJson(request, 4 * 1024 * 1024);
  if (!body) return tooLarge();
  if (!Array.isArray(body.questions) || body.questions.length > 500) return NextResponse.json({ error: "Questions are required." }, { status: 400 });
  const { data: current, error: currentError } = await getPrepTable("prep_practice_tests").select("questions").eq("id", id).eq("status", "DRAFT").single();
  if (currentError) return saveFailed(currentError, "admin practice load draft");
  const questions = body.questions.map((question, index) => normalizeQuestion(question, current.questions[index]));
  const invalid = questions.find((question) => question.answerError);
  if (invalid) return NextResponse.json({ error: invalid.answerError }, { status: 400 });
  const { data, error } = await getPrepTable("prep_practice_tests").update({
    questions,
    metadata: body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {},
    updated_at: new Date().toISOString()
  }).eq("id", id).eq("status", "DRAFT").select("id,status,title,questions,metadata").single();
  if (error) return saveFailed(error, "admin practice save");
  await logAdminAction(admin, "practice.review_save", { targetType: "prep_practice_tests", targetId: id, metadata: { questionCount: questions.length }, request });
  return NextResponse.json({ test: data });
}

function normalizeQuestion(question, previous = {}) {
  const options = Array.isArray(question.options) ? question.options : [];
  const answer = question.answer;
  const next = { ...previous, ...question, options };
  delete next.answerError;
  if (answer === null || answer === undefined || answer === "" || (Array.isArray(answer) && !answer.length)) {
    delete next.answer;
    delete next.answerVerified;
    return next;
  }
  if (question.type === "MCQ") {
    if (typeof answer !== "string" || !options.some((option) => option.label === answer)) next.answerError = `Question ${question.number}: select one valid MCQ option.`;
    else { next.answer = answer; next.answerVerified = true; }
  } else if (question.type === "MSQ") {
    if (!Array.isArray(answer) || !answer.length || answer.some((value) => !options.some((option) => option.label === value))) next.answerError = `Question ${question.number}: select valid MSQ options.`;
    else { next.answer = [...new Set(answer)].sort(); next.answerVerified = true; }
  } else if (question.type === "NAT") {
    if (typeof answer !== "number" || !Number.isFinite(answer)) next.answerError = `Question ${question.number}: enter a valid numerical answer.`;
    else { next.answer = answer; next.answerVerified = true; }
  }
  return next;
}

export async function POST(request, { params }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid test id." }, { status: 400 });
  if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    const limited = limitRequest(request, "admin-upload", { limit: 60, userId: admin.id }); if (limited) return limited;
    let form;
    try { form = await request.formData(); } catch { return NextResponse.json({ error: "The upload could not be read." }, { status: 400 }); }
    const questionIndex = Number(form.get("questionIndex"));
    const files = form.getAll("images");
    if (!Number.isInteger(questionIndex) || questionIndex < 0 || !files.length || files.length > 10) return NextResponse.json({ error: "Question and image files are required." }, { status: 400 });
    const { data: draft, error: loadError } = await getPrepTable("prep_practice_tests").select("id,questions").eq("id", id).eq("status", "DRAFT").single();
    if (loadError) return saveFailed(loadError, "admin practice load draft");
    if (!draft.questions[questionIndex]) return NextResponse.json({ error: "Question not found." }, { status: 400 });
    const images = [];
    for (const file of files) {
      if (!file || typeof file.arrayBuffer !== "function") return NextResponse.json({ error: "Invalid image." }, { status: 400 });
      const fileName = safeFileName(file.name, "image");
      const buffer = Buffer.from(await file.arrayBuffer());
      const problem = validateUpload(buffer, String(file.type || "").toLowerCase(), IMAGE_TYPES, 10 * 1024 * 1024);
      if (problem) return NextResponse.json({ error: `${problem} (${fileName})` }, { status: 400 });
      const path = `${draft.id}/questions/${questionIndex}/${crypto.randomUUID()}-${fileName}`;
      await uploadSource(path, buffer, String(file.type).toLowerCase(), "eduorbit-practice-sources");
      const { data: signed, error: signedError } = await getSupabaseServer().storage.from("eduorbit-practice-sources").createSignedUrl(path, 60 * 60);
      if (signedError) return saveFailed(signedError, "admin practice signed url");
      images.push({ path, name: fileName, url: signed.signedUrl });
    }
    const questions = draft.questions.map((question, index) => index === questionIndex ? { ...question, images: [...(question.images || []), ...images] } : question);
    const { data, error } = await getPrepTable("prep_practice_tests").update({ questions, updated_at: new Date().toISOString() }).eq("id", id).select("id,status,title,questions,metadata").single();
    if (error) return saveFailed(error, "admin practice images");
    await logAdminAction(admin, "practice.images_add", { targetType: "prep_practice_tests", targetId: id, metadata: { questionIndex, count: images.length }, request });
    return NextResponse.json({ test: data });
  }
  const { data: test, error: loadError } = await getPrepTable("prep_practice_tests").select("id,status,questions").eq("id", id).maybeSingle();
  if (loadError) return serverError(loadError, "admin practice load");
  if (!test) return NextResponse.json({ error: "Practice test not found." }, { status: 404 });
  if (!test.questions?.length) return NextResponse.json({ error: "At least one extracted question is required before publishing." }, { status: 400 });
  const incomplete = test.questions.filter((question) => !String(question.text || "").trim() || (question.type !== "NAT" && !question.options?.length));
  if (incomplete.length) return NextResponse.json({ error: `${incomplete.length} question(s) need text and options before publishing.` }, { status: 400 });
  const { data, error } = await getPrepTable("prep_practice_tests").update({ status: "PUBLISHED", updated_at: new Date().toISOString() }).eq("id", id).select("id,status").single();
  if (error) return saveFailed(error, "admin practice publish");
  await logAdminAction(admin, "practice.publish", { targetType: "prep_practice_tests", targetId: id, request });
  return NextResponse.json({ test: data });
}
