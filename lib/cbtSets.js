import { getPrepTable, getSupabaseServer } from "@/lib/supabase";
import { ModelError, imageBlock, pdfBlock, requestStructuredJson } from "@/lib/anthropic";
import { validateAnswerPairs, validateExtraction } from "@/lib/cbtSetShared";

// Same private bucket the PDF-to-CBT flow already uses; CBT set images live under cbt-sets/.
export const CBT_SET_BUCKET = "eduorbit-cbt-source-pdfs";
export const EXTRACTION_CAP_PER_HOUR = 100;

const QUESTION_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          number: { type: "integer" },
          text: { type: "string" },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: { key: { type: "string" }, text: { type: "string" } },
              required: ["key", "text"],
              additionalProperties: false
            }
          },
          passage: { anyOf: [{ type: "string" }, { type: "null" }] },
          has_figure: { type: "boolean" }
        },
        required: ["number", "text", "options", "passage", "has_figure"],
        additionalProperties: false
      }
    }
  },
  required: ["questions"],
  additionalProperties: false
};

const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    answers: {
      type: "array",
      items: {
        type: "object",
        properties: { number: { type: "integer" }, key: { type: "string" } },
        required: ["number", "key"],
        additionalProperties: false
      }
    }
  },
  required: ["answers"],
  additionalProperties: false
};

const QUESTION_PROMPT = `You transcribe photographed or scanned exam pages into structured data.
Return every question visible in the image, in reading order.
- number: the question number as printed. If the image starts with the continuation of a question whose number is not visible, return it first with number 0.
- text: the question stem exactly as printed, without the number and without the options.
- options: each choice with its letter as key (A, B, C, D...) and its text. Use an empty array if no options are visible.
- passage: shared comprehension or data text that the question depends on, otherwise null.
- has_figure: true if the question relies on a diagram, graph, table image or figure.
Write mathematics as plain text using Unicode symbols where possible (for example x², √2, ≤, π, a/b). Do not output HTML or Markdown. Do not invent content that is not visible; transcribe unreadable parts as [illegible].`;

const ANSWER_PROMPT = `You read exam answer keys. Return one row per question: its number and the single correct option letter (A, B, C, D...).
Skip rows that are not a single letter answer (for example numerical answers or "marks to all"). Do not invent rows.`;

async function withOneRetry(run, validate) {
  let lastError = "Validation failed.";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = validate(await run());
      if (result.ok) return result;
      lastError = `Validation failed: ${result.error}`;
    } catch (error) {
      if (!(error instanceof ModelError) || !error.retryable) throw error;
      lastError = error.message;
    }
  }
  throw new ModelError(`${lastError} (after one retry)`);
}

export async function extractQuestionsFromImage(buffer, mediaType) {
  const result = await withOneRetry(
    () => requestStructuredJson({
      system: QUESTION_PROMPT,
      schema: QUESTION_SCHEMA,
      content: [imageBlock(buffer.toString("base64"), mediaType), { type: "text", text: "Extract the questions from this page." }]
    }),
    validateExtraction
  );
  return result.questions;
}

export async function extractAnswerKey(buffer, mediaType) {
  const source = mediaType === "application/pdf" ? pdfBlock(buffer.toString("base64")) : imageBlock(buffer.toString("base64"), mediaType);
  const result = await withOneRetry(
    () => requestStructuredJson({
      system: ANSWER_PROMPT,
      schema: ANSWER_SCHEMA,
      maxTokens: 8000,
      content: [source, { type: "text", text: "Extract the answer key." }]
    }),
    validateAnswerPairs
  );
  return result.pairs;
}

export async function uploadCbtSetImage(path, buffer, contentType) {
  const { error } = await getSupabaseServer().storage.from(CBT_SET_BUCKET).upload(path, buffer, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

// Records the call first so concurrent requests count toward the cap.
// The run log is best-effort: if cbt_extraction_runs cannot be read or written
// (for example the migration is not applied yet), extraction still continues.
export async function reserveExtractionCall(adminId, kind) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  let count = 0;
  try {
    const result = await getPrepTable("cbt_extraction_runs").select("id", { count: "exact", head: true }).eq("admin_id", adminId).gte("created_at", since);
    if (result.error) throw result.error;
    count = result.count || 0;
  } catch {
    console.warn("CBT extraction log unavailable; skipping the hourly cap check.");
    return true;
  }
  if (count >= EXTRACTION_CAP_PER_HOUR) return false;
  try {
    const { error: insertError } = await getPrepTable("cbt_extraction_runs").insert({ admin_id: adminId, kind });
    if (insertError) throw insertError;
  } catch {
    console.warn("CBT extraction log write failed; continuing with extraction.");
  }
  return true;
}

async function signPaths(paths) {
  if (!paths.length) return new Map();
  const { data, error } = await getSupabaseServer().storage.from(CBT_SET_BUCKET).createSignedUrls(paths, 60 * 60);
  if (error) return new Map();
  return new Map((data || []).filter((item) => item.signedUrl).map((item) => [item.path, item.signedUrl]));
}

export async function listPublishedCbtSets(branchId) {
  const { data, error } = await getPrepTable("cbt_sets")
    .select("id,title,year,created_at,prep_subjects(name),cbt_questions(count)")
    .eq("branch_id", branchId)
    .eq("is_published", true)
    .order("year", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((set) => ({
    id: set.id,
    title: set.title,
    year: set.year,
    subjectName: set.prep_subjects?.name || null,
    questionCount: set.cbt_questions?.[0]?.count || 0
  }));
}

// Loads a published set with options and signed figure URLs for the player.
export async function getPublishedCbtSet(id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) return null;
  const { data, error } = await getPrepTable("cbt_sets")
    .select("id,title,year,exam_id,branch_id,prep_exams(name,slug),prep_branches(name,slug),prep_subjects(name),cbt_questions(id,number,position,text,passage,explanation,has_figure,image_paths,correct_key,cbt_options(key,text,position))")
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const questions = [...(data.cbt_questions || [])].sort((a, b) => a.position - b.position);
  const urls = await signPaths([...new Set(questions.flatMap((question) => Array.isArray(question.image_paths) ? question.image_paths : []))]);
  return {
    id: data.id,
    title: data.title,
    year: data.year,
    examName: data.prep_exams?.name || null,
    examSlug: data.prep_exams?.slug || null,
    branchName: data.prep_branches?.name || null,
    branchSlug: data.prep_branches?.slug || null,
    subjectName: data.prep_subjects?.name || null,
    questions: questions.map((question) => ({
      id: question.id,
      number: question.number,
      text: question.text,
      passage: question.passage,
      explanation: question.explanation,
      correctKey: question.correct_key,
      images: (question.image_paths || []).map((path) => urls.get(path)).filter(Boolean),
      options: [...(question.cbt_options || [])].sort((a, b) => a.position - b.position).map(({ key, text }) => ({ key, text }))
    }))
  };
}
