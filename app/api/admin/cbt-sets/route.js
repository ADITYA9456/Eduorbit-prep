import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getPrepTable, getSupabaseServer } from "@/lib/supabase";

const UUID = /^[0-9a-f-]{36}$/i;
const KEY = /^[A-Z]$/;

function text(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// Validates the builder payload. Returns { error } or { set, questions }.
function validatePayload(body, adminId) {
  const examId = String(body?.examId || "");
  const branchId = String(body?.branchId || "");
  const subjectId = body?.subjectId ? String(body.subjectId) : null;
  if (!UUID.test(examId) || !UUID.test(branchId) || (subjectId && !UUID.test(subjectId))) return { error: "Exam and branch are required." };
  const year = body?.year === "" || body?.year === null || body?.year === undefined ? null : Number(body.year);
  if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2200)) return { error: "Year must be a four-digit year." };
  const title = text(body?.title, 250);
  if (!title) return { error: "Title is required." };
  const pathPrefix = `cbt-sets/${adminId}/`;
  const sourceImages = Array.isArray(body?.sourceImages) ? body.sourceImages.map(String) : [];
  if (sourceImages.length > 20 || sourceImages.some((path) => !path.startsWith(pathPrefix) || path.includes(".."))) return { error: "Invalid source images." };
  const allowedPaths = new Set(sourceImages);
  const rawQuestions = Array.isArray(body?.questions) ? body.questions : [];
  if (!rawQuestions.length || rawQuestions.length > 300) return { error: "Add between 1 and 300 questions." };
  const numbers = new Set();
  const questions = [];
  for (const raw of rawQuestions) {
    const number = Number(raw?.number);
    if (!Number.isInteger(number) || number < 1 || number > 999) return { error: "Every question needs a number from 1 to 999." };
    if (numbers.has(number)) return { error: `Question number ${number} is used twice.` };
    numbers.add(number);
    const questionText = text(raw?.text, 20000);
    if (!questionText) return { error: `Question ${number} has no text.` };
    const options = Array.isArray(raw?.options) ? raw.options : [];
    const keys = new Set();
    const cleanOptions = [];
    for (const option of options.slice(0, 10)) {
      const key = String(option?.key || "").trim().toUpperCase();
      if (!KEY.test(key) || keys.has(key)) return { error: `Question ${number} has an invalid or repeated option letter.` };
      keys.add(key);
      cleanOptions.push({ key, text: text(option?.text, 5000) });
    }
    if (cleanOptions.filter((option) => option.text).length < 2) return { error: `Question ${number} needs at least two options.` };
    const correctKey = raw?.correctKey ? String(raw.correctKey).toUpperCase() : "";
    if (correctKey && !keys.has(correctKey)) return { error: `Question ${number} answer key is not one of its options.` };
    const imagePaths = (Array.isArray(raw?.imagePaths) ? raw.imagePaths.map(String) : []).filter((path) => allowedPaths.has(path));
    questions.push({
      number,
      text: questionText,
      passage: text(raw?.passage, 20000) || null,
      explanation: text(raw?.explanation, 20000) || null,
      has_figure: Boolean(raw?.hasFigure),
      image_paths: [...new Set(imagePaths)],
      correct_key: correctKey || null,
      options: cleanOptions
    });
  }
  return {
    set: { exam_id: examId, branch_id: branchId, subject_id: subjectId, year, title, source_images: sourceImages, is_published: Boolean(body?.isPublished), created_by: adminId },
    questions
  };
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { data, error } = await getPrepTable("cbt_sets").select("id,title,year,is_published,created_at,cbt_questions(count)").order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sets: data || [] });
}

export async function POST(request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const result = validatePayload(body, admin.id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  const { data: branch, error: branchError } = await getPrepTable("prep_branches").select("id").eq("id", result.set.branch_id).eq("exam_id", result.set.exam_id).maybeSingle();
  if (branchError) return NextResponse.json({ error: branchError.message }, { status: 400 });
  if (!branch) return NextResponse.json({ error: "Branch does not belong to the selected exam." }, { status: 400 });
  if (result.set.subject_id) {
    const { data: mapping } = await getPrepTable("prep_branch_subjects").select("subject_id").eq("branch_id", result.set.branch_id).eq("subject_id", result.set.subject_id).maybeSingle();
    if (!mapping) return NextResponse.json({ error: "Subject is not mapped to the selected branch." }, { status: 400 });
  }
  const { data: id, error } = await getSupabaseServer().schema("eduorbit_prep").rpc("create_cbt_set", { p_set: result.set, p_questions: result.questions });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ set: { id, title: result.set.title, is_published: result.set.is_published, questionCount: result.questions.length } }, { status: 201 });
}
