import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getPrepTable, getSupabaseServer } from "@/lib/supabase";
import { uploadSource } from "@/lib/cbt";
import crypto from "node:crypto";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function PATCH(request, { params }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await request.json();
  if (!Array.isArray(body.questions)) return NextResponse.json({ error: "Questions are required." }, { status: 400 });
  const { data: current, error: currentError } = await getPrepTable("prep_practice_tests").select("questions").eq("id", params.id).eq("status", "DRAFT").single();
  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 400 });
  const questions = body.questions.map((question, index) => normalizeQuestion(question, current.questions[index]));
  const invalid = questions.find((question) => question.answerError);
  if (invalid) return NextResponse.json({ error: invalid.answerError }, { status: 400 });
  const { data, error } = await getPrepTable("prep_practice_tests").update({
    questions,
    metadata: body.metadata || {},
    updated_at: new Date().toISOString()
  }).eq("id", params.id).eq("status", "DRAFT").select("id,status,title,questions,metadata").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
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
  if (!await requireAdmin()) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    const form = await request.formData();
    const questionIndex = Number(form.get("questionIndex"));
    const files = form.getAll("images");
    if (!Number.isInteger(questionIndex) || questionIndex < 0 || !files.length || files.length > 10) return NextResponse.json({ error: "Question and image files are required." }, { status: 400 });
    const { data: draft, error: loadError } = await getPrepTable("prep_practice_tests").select("id,questions").eq("id", params.id).eq("status", "DRAFT").single();
    if (loadError) return NextResponse.json({ error: loadError.message }, { status: 400 });
    if (!draft.questions[questionIndex]) return NextResponse.json({ error: "Question not found." }, { status: 400 });
    const images = [];
    for (const file of files) {
      if (!IMAGE_TYPES.includes(String(file.type || "").toLowerCase()) || file.size > 10 * 1024 * 1024) return NextResponse.json({ error: `Invalid image: ${file.name}` }, { status: 400 });
      const path = `${draft.id}/questions/${questionIndex}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      await uploadSource(path, Buffer.from(await file.arrayBuffer()), file.type, "eduorbit-practice-sources");
      const { data: signed, error: signedError } = await getSupabaseServer().storage.from("eduorbit-practice-sources").createSignedUrl(path, 60 * 60);
      if (signedError) return NextResponse.json({ error: signedError.message }, { status: 400 });
      images.push({ path, name: file.name, url: signed.signedUrl });
    }
    const questions = draft.questions.map((question, index) => index === questionIndex ? { ...question, images: [...(question.images || []), ...images] } : question);
    const { data, error } = await getPrepTable("prep_practice_tests").update({ questions, updated_at: new Date().toISOString() }).eq("id", params.id).select("id,status,title,questions,metadata").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ test: data });
  }
  const { data: test, error: loadError } = await getPrepTable("prep_practice_tests").select("id,status,questions").eq("id", params.id).maybeSingle();
  if (loadError || !test) return NextResponse.json({ error: loadError?.message || "Practice test not found." }, { status: 404 });
  if (!test.questions?.length) return NextResponse.json({ error: "At least one extracted question is required before publishing." }, { status: 400 });
  const incomplete = test.questions.filter((question) => !String(question.text || "").trim() || (question.type !== "NAT" && !question.options?.length));
  if (incomplete.length) return NextResponse.json({ error: `${incomplete.length} question(s) need text and options before publishing.` }, { status: 400 });
  const { data, error } = await getPrepTable("prep_practice_tests").update({ status: "PUBLISHED", updated_at: new Date().toISOString() }).eq("id", params.id).select("id,status").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ test: data });
}
