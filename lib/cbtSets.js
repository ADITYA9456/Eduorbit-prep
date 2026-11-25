import { getPrepTable, getSupabaseServer } from "@/lib/supabase";
import { ModelError, imageBlock, pdfBlock, requestStructuredJson } from "@/lib/anthropic";
import { cleanMarks, defaultDurationMinutes, hasAnswerKey, normalizeType, validateAnswerPairs, validateExtraction } from "@/lib/cbtSetShared";

// Same private bucket the PDF-to-CBT flow already uses; CBT set images live under cbt-sets/.
export const CBT_SET_BUCKET = "eduorbit-cbt-source-pdfs";
export const EXTRACTION_CAP_PER_HOUR = 100;
// Long enough for a full timed exam session without figures going blank.
const SIGNED_URL_SECONDS = 6 * 60 * 60;

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
          type: { type: "string", enum: ["MCQ", "MSQ", "NAT"] },
          marks: { anyOf: [{ type: "number" }, { type: "null" }] },
          passage: { anyOf: [{ type: "string" }, { type: "null" }] },
          has_figure: { type: "boolean" }
        },
        required: ["number", "text", "options", "type", "marks", "passage", "has_figure"],
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
        properties: { number: { type: "integer" }, answer: { type: "string" } },
        required: ["number", "answer"],
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
- options: each choice with its letter as key (A, B, C, D...) and its text. Use an empty array if no options are visible, which is normal for numerical answer questions.
- type: "MCQ" for a single-correct multiple choice question, "MSQ" when the question says one or more options can be correct (multiple select), "NAT" for a numerical answer type question that has no options and asks for a number to be typed in. When unsure and options are shown, use "MCQ".
- marks: the marks for the question if the page states it (for example "Q.1 to Q.25 carry one mark each" or "2 marks"), otherwise null.
- passage: shared comprehension or data text that the question depends on, otherwise null.
- has_figure: true if the question relies on a diagram, graph, table image or figure.
Write mathematics as plain text using Unicode symbols where possible (for example x², √2, ≤, π, a/b). Do not output HTML or Markdown. Do not invent content that is not visible; transcribe unreadable parts as [illegible].`;

const ANSWER_PROMPT = `You read exam answer keys. Return one row per question: its number and its answer as printed.
- Multiple choice: the single option letter, for example "B".
- Multiple select: all correct letters separated by semicolons, for example "A;C".
- Numerical answer: the number, for example "4.5", or a range written as "4.5 to 4.6".
Skip rows with no usable answer, such as "marks to all" or "bonus". Do not invent rows.`;

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
  const { data, error } = await getSupabaseServer().storage.from(CBT_SET_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
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

// Columns added by migration 011 may not exist yet on a database that has not run it.
export function isMissingColumn(error) {
  return Boolean(error) && (error.code === "42703" || error.code === "PGRST204" || /column .* does not exist|could not find .* column/i.test(error.message || ""));
}

const TYPE_FIELDS = "type,marks,negative_marks,correct_keys,nat_min,nat_max";
const SET_FIELDS = "id,title,year,exam_id,branch_id,prep_exams(name,slug),prep_branches(name,slug),prep_subjects(name),cbt_questions(id,number,position,text,passage,explanation,has_figure,image_paths,correct_key,cbt_options(key,text,position))";

async function loadCbtSet(id, { publishedOnly }) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) return null;
  // Try the newest schema first, then fall back for databases that have not run migrations 011/012.
  const combos = [[true, true], [true, false], [false, true], [false, false]];
  for (const [withDuration, withTypes] of combos) {
    const fields = SET_FIELDS.replace("explanation,has_figure,image_paths,correct_key,", `explanation,has_figure,image_paths,correct_key,${withTypes ? `${TYPE_FIELDS},` : ""}`);
    let query = getPrepTable("cbt_sets").select(withDuration ? `${fields},duration_minutes` : fields).eq("id", id);
    if (publishedOnly) query = query.eq("is_published", true);
    const { data, error } = await query.maybeSingle();
    if (error) {
      if (isMissingColumn(error)) continue;
      throw error;
    }
    return data;
  }
  return null;
}

// includeKeys=false is what students receive: no answer keys and no explanations, only `hasKey`.
async function shapeCbtSet(data, { includeKeys, withImages = true }) {
  const questions = [...(data.cbt_questions || [])].sort((a, b) => a.position - b.position);
  const urls = !withImages ? new Map() : await signPaths([...new Set(questions.flatMap((question) => Array.isArray(question.image_paths) ? question.image_paths : []))]);
  return {
    id: data.id,
    title: data.title,
    year: data.year,
    examName: data.prep_exams?.name || null,
    examSlug: data.prep_exams?.slug || null,
    branchName: data.prep_branches?.name || null,
    branchSlug: data.prep_branches?.slug || null,
    subjectName: data.prep_subjects?.name || null,
    durationMinutes: data.duration_minutes || defaultDurationMinutes(questions.length),
    questions: questions.map((row) => {
      const type = normalizeType(row.type, 1);
      const graded = {
        id: row.id,
        number: row.number,
        type,
        marks: cleanMarks(row.marks, 1),
        negativeMarks: Number(row.negative_marks) || 0,
        correctKey: row.correct_key || "",
        correctKeys: Array.isArray(row.correct_keys) ? row.correct_keys : [],
        natMin: row.nat_min ?? null,
        natMax: row.nat_max ?? null,
        explanation: row.explanation
      };
      const question = {
        id: row.id,
        number: row.number,
        type,
        marks: graded.marks,
        negativeMarks: graded.negativeMarks,
        text: row.text,
        passage: row.passage,
        hasKey: hasAnswerKey(graded),
        images: (row.image_paths || []).map((path) => urls.get(path)).filter(Boolean),
        options: [...(row.cbt_options || [])].sort((a, b) => a.position - b.position).map(({ key, text }) => ({ key, text }))
      };
      return includeKeys ? { ...question, correctKey: graded.correctKey, correctKeys: graded.correctKeys, natMin: graded.natMin, natMax: graded.natMax, explanation: graded.explanation } : question;
    })
  };
}
// Loads a published set with options and signed figure URLs for the player.
export async function getPublishedCbtSet(id) {
  const data = await loadCbtSet(id, { publishedOnly: true });
  return data ? shapeCbtSet(data, { includeKeys: false }) : null;
}

// Server only: the same set with answer keys, for grading a submission.
export async function getPublishedCbtSetWithKeys(id) {
  const data = await loadCbtSet(id, { publishedOnly: true });
  return data ? shapeCbtSet(data, { includeKeys: true, withImages: false }) : null;
}

// Server only: one question with its key, for instant feedback in study mode.
export async function getQuestionForCheck(setId, questionId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(setId)) || !/^[0-9a-f-]{36}$/i.test(String(questionId))) return null;
  for (const withTypes of [true, false]) {
    const fields = `id,number,explanation,correct_key${withTypes ? `,${TYPE_FIELDS}` : ""},cbt_sets!inner(is_published)`;
    const { data, error } = await getPrepTable("cbt_questions").select(fields).eq("id", questionId).eq("set_id", setId).eq("cbt_sets.is_published", true).maybeSingle();
    if (error) {
      if (isMissingColumn(error)) continue;
      throw error;
    }
    if (!data) return null;
    return {
      id: data.id,
      number: data.number,
      type: normalizeType(data.type, 1),
      marks: cleanMarks(data.marks, 1),
      negativeMarks: Number(data.negative_marks) || 0,
      correctKey: data.correct_key || "",
      correctKeys: Array.isArray(data.correct_keys) ? data.correct_keys : [],
      natMin: data.nat_min ?? null,
      natMax: data.nat_max ?? null,
      explanation: data.explanation
    };
  }
  return null;
}

// Same shape, but without the published check, so a student can still review an old attempt.
export async function getCbtSetForReview(id) {
  const data = await loadCbtSet(id, { publishedOnly: false });
  return data ? shapeCbtSet(data, { includeKeys: true }) : null;
}

export async function listUserAttempts(userId, limit = 50) {
  const { data, error } = await getPrepTable("cbt_attempts")
    .select("*,cbt_sets(title,year)")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(mapAttempt);
}

export async function getUserAttempt(userId, attemptId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(attemptId))) return null;
  const { data, error } = await getPrepTable("cbt_attempts").select("*,cbt_sets(title,year)").eq("id", attemptId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data ? mapAttempt(data) : null;
}

function mapAttempt(row) {
  return {
    id: row.id,
    setId: row.set_id,
    setTitle: row.cbt_sets?.title || "Deleted set",
    year: row.cbt_sets?.year || null,
    mode: row.mode || "STUDY",
    answers: row.answers || {},
    correct: row.correct_count,
    attempted: row.attempted_count,
    total: row.total_count,
    score: row.score ?? null,
    maxScore: row.max_score ?? null,
    durationSeconds: row.duration_seconds ?? null,
    violations: row.violations || 0,
    completedAt: row.completed_at
  };
}
