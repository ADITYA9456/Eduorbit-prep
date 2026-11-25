// Pure helpers shared by the CBT builder routes, the student routes and the UI. No server imports.
//
// Question model (GATE style):
//   MCQ  one correct option      answer stored as correctKey  "B"
//   MSQ  one or more options     answer stored as correctKeys ["A", "C"]  (all-or-nothing, no negative marks)
//   NAT  numerical answer        answer stored as natMin/natMax (equal for an exact value)
// A student's answer is a letter (MCQ), a sorted array of letters (MSQ) or a numeric string (NAT).

export const MAX_IMAGES_PER_RUN = 20;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // stay under Vercel's ~4.5 MB request cap
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const QUESTION_TYPES = ["MCQ", "MSQ", "NAT"];
export const TYPE_LABEL = { MCQ: "Multiple choice (one answer)", MSQ: "Multiple select (one or more)", NAT: "Numerical answer" };
const KEY_PATTERN = /^[A-Z]$/;
const OPTION_LETTERS = "ABCDEFGHIJ";
const NUMBER = "-?\\d+(?:\\.\\d+)?";
const NUMBER_PATTERN = new RegExp(`^${NUMBER}$`);
const RANGE_PATTERN = new RegExp(`^(${NUMBER})\\s*(?:to|\\.\\.|~|–|—|-)\\s*(${NUMBER})$`, "i");

function cleanText(value, max) {
  return typeof value === "string" ? value.replace(/\u0000/g, "").trim().slice(0, max) : null;
}

export function normalizeType(value, optionCount = 4) {
  const type = String(value || "").toUpperCase();
  if (QUESTION_TYPES.includes(type)) return type;
  return optionCount ? "MCQ" : "NAT";
}

export function usesOptions(type) {
  return type === "MCQ" || type === "MSQ";
}

// MCQ marks 1 or 2 carry 1/3 or 2/3 negative marking in GATE. MSQ and NAT carry none.
export function defaultNegativeMarks(type, marks) {
  if (type !== "MCQ") return 0;
  return Math.round((Number(marks) || 0) / 3 * 10000) / 10000;
}

export function cleanMarks(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= 100 ? Math.round(number * 100) / 100 : fallback;
}

// ---------- Extraction validation ----------

// Validates the vision-model payload against the extraction contract.
// Returns { ok: true, questions } or { ok: false, error }.
export function validateExtraction(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.questions)) {
    return { ok: false, error: "Response has no questions array." };
  }
  if (payload.questions.length > 200) return { ok: false, error: "Response has too many questions." };
  const questions = [];
  for (const [index, raw] of payload.questions.entries()) {
    const where = `Question ${index + 1}`;
    if (!raw || typeof raw !== "object") return { ok: false, error: `${where} is not an object.` };
    if (!Number.isInteger(raw.number) || raw.number < 0 || raw.number > 999) return { ok: false, error: `${where} has an invalid number.` };
    const text = cleanText(raw.text, 20000);
    if (text === null) return { ok: false, error: `${where} has no text field.` };
    if (!Array.isArray(raw.options)) return { ok: false, error: `${where} has no options array.` };
    const options = [];
    for (const option of raw.options) {
      const key = typeof option?.key === "string" ? option.key.trim().replace(/[().]/g, "").toUpperCase() : "";
      const optionText = cleanText(option?.text, 5000);
      if (!KEY_PATTERN.test(key) || optionText === null) return { ok: false, error: `${where} has an invalid option.` };
      options.push({ key, text: optionText });
    }
    if (raw.passage !== null && typeof raw.passage !== "string") return { ok: false, error: `${where} has an invalid passage.` };
    if (typeof raw.has_figure !== "boolean") return { ok: false, error: `${where} has an invalid has_figure flag.` };
    const type = normalizeType(raw.type, options.length);
    if (type === "NAT") options.length = 0;
    const marks = raw.marks === null || raw.marks === undefined ? null : cleanMarks(raw.marks, null);
    questions.push({ number: raw.number, type, marks, text, options, passage: raw.passage ? cleanText(raw.passage, 20000) : null, has_figure: raw.has_figure });
  }
  return { ok: true, questions };
}

// ---------- Answer key parsing ----------

// Turns "B", "A;C", "A, C", "AC", "4.5", "4.5 to 4.6" into { keys } or { min, max }. Returns null if unreadable.
export function parseAnswerValue(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  if (NUMBER_PATTERN.test(text)) {
    const value = Number(text);
    return { min: value, max: value };
  }
  const range = text.match(RANGE_PATTERN);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  const cleaned = text.replace(/\(|\)/g, "").replace(/\band\b/gi, ";");
  const parts = cleaned.split(/[;,/&|\s]+/).filter(Boolean);
  const keys = [];
  for (const part of parts) {
    const upper = part.toUpperCase();
    if (!new RegExp(`^[${OPTION_LETTERS}]{1,${OPTION_LETTERS.length}}$`).test(upper)) return null;
    keys.push(...upper.split(""));
  }
  const unique = [...new Set(keys)].sort();
  return unique.length ? { keys: unique } : null;
}

export function validateAnswerPairs(payload) {
  if (!payload || !Array.isArray(payload.answers)) return { ok: false, error: "Response has no answers array." };
  const pairs = [];
  for (const item of payload.answers) {
    if (!Number.isInteger(item?.number) || item.number < 1 || item.number > 999) {
      return { ok: false, error: "Response has an invalid answer row." };
    }
    const value = parseAnswerValue(item.answer);
    if (value) pairs.push({ number: item.number, value });
  }
  return { ok: true, pairs };
}

// Parses pasted keys like "1-B, 2-C", "3 A;C", "4: 12.5", "5 4.5 to 4.6", one per line or comma-separated.
export function parseAnswerKeyText(input) {
  const pairs = [];
  const value = `(?:${NUMBER}\\s*(?:to|\\.\\.|~|-)\\s*${NUMBER}|${NUMBER}|\\(?[A-Ja-j]\\)?(?:\\s*[;&]\\s*\\(?[A-Ja-j]\\)?)*)`;
  const pattern = new RegExp(`(?:^|[^\\dA-Za-z.])(?:Q(?:uestion)?\\.?\\s*)?(\\d{1,3})\\s*(?:[-–:.)=]|\\s)\\s*(${value})(?![A-Za-z\\d.])`, "g");
  for (const match of String(input || "").matchAll(pattern)) {
    const parsed = parseAnswerValue(match[2]);
    if (parsed) pairs.push({ number: Number(match[1]), value: parsed });
  }
  return pairs;
}

export function formatValue(value) {
  if (!value) return "";
  if (value.keys) return value.keys.join(", ");
  return value.min === value.max ? String(value.min) : `${value.min} to ${value.max}`;
}

function sameValue(a, b) {
  return formatValue(a) === formatValue(b);
}

function optionKeysOf(question) {
  return new Set((question.options || []).filter((option) => String(option.text || "").trim() || option.key).map((option) => option.key));
}

// Editable (builder) question -> answer value, or null when not set.
export function editableValue(question) {
  if (question.type === "NAT") {
    const min = Number(question.natMin);
    const max = Number(question.natMax);
    if (question.natMin === "" || question.natMin === null || question.natMin === undefined) return null;
    if (!Number.isFinite(min)) return null;
    return { min, max: question.natMax === "" || question.natMax === null || question.natMax === undefined || !Number.isFinite(max) ? min : max };
  }
  if (question.type === "MSQ") return question.correctKeys?.length ? { keys: [...question.correctKeys].sort() } : null;
  return question.correctKey ? { keys: [question.correctKey] } : null;
}

function withValue(question, value) {
  if (question.type === "NAT") return { ...question, natMin: String(value.min), natMax: String(value.max) };
  if (question.type === "MSQ") return { ...question, correctKeys: value.keys };
  return { ...question, correctKey: value.keys[0] };
}

function clearValue(question) {
  return { ...question, correctKey: "", correctKeys: [], natMin: "", natMax: "" };
}

// Applies number->value pairs to builder questions. A question is "conflicting" when the source
// lists different answers for its number, or the answer does not fit the question's type/options.
// A multi-letter answer on an MCQ promotes it to MSQ, because the key is the authority.
export function applyAnswerKey(questions, pairs) {
  const byNumber = new Map();
  for (const { number, value } of pairs) {
    if (!byNumber.has(number)) byNumber.set(number, []);
    const list = byNumber.get(number);
    if (!list.some((existing) => sameValue(existing, value))) list.push(value);
  }
  const counts = { matched: 0, unmatched: 0, conflicting: 0, unusedKeys: 0 };
  const questionNumbers = new Set(questions.map((question) => question.number));
  for (const number of byNumber.keys()) if (!questionNumbers.has(number)) counts.unusedKeys += 1;
  const next = questions.map((question) => {
    const values = byNumber.get(question.number);
    if (!values) {
      counts.unmatched += 1;
      return { ...clearValue(question), keyStatus: "unmatched" };
    }
    let target = question;
    const [value] = values;
    if (values.length === 1 && value.keys && value.keys.length > 1 && question.type === "MCQ") target = { ...question, type: "MSQ" };
    const known = optionKeysOf(target);
    let fits = false;
    if (target.type === "NAT") fits = Boolean(value.min !== undefined);
    else if (target.type === "MSQ") fits = Boolean(value.keys) && value.keys.every((key) => known.has(key));
    else fits = Boolean(value.keys) && value.keys.length === 1 && known.has(value.keys[0]);
    if (values.length > 1 || !fits) {
      counts.conflicting += 1;
      return { ...clearValue(target), keyStatus: "conflicting", keyCandidates: values.map(formatValue) };
    }
    counts.matched += 1;
    return { ...withValue(clearValue(target), value), keyStatus: "matched", keyCandidates: undefined };
  });
  return { questions: next, counts };
}

export function questionFlags(question, duplicateNumbers) {
  const flags = [];
  if (!String(question.text || "").trim()) flags.push("Empty text");
  if (usesOptions(question.type) && (question.options || []).filter((option) => String(option.text || "").trim()).length < 2) flags.push("Missing options");
  if (!Number.isInteger(question.number) || question.number < 1) flags.push("Invalid number");
  else if (duplicateNumbers.has(question.number)) flags.push("Duplicate number");
  if (question.type === "NAT" && Number.isFinite(Number(question.natMin)) && Number.isFinite(Number(question.natMax)) && question.natMax !== "" && Number(question.natMin) > Number(question.natMax)) flags.push("Invalid range");
  if (!editableValue(question)) flags.push("No answer key");
  return flags;
}

// ---------- Grading (server and review pages; also safe in the browser) ----------

// Question shape used for grading: { id, number, type, marks, negativeMarks, correctKey, correctKeys, natMin, natMax, explanation }.
export function hasAnswerKey(question) {
  if (question.type === "NAT") return Number.isFinite(Number(question.natMin)) && question.natMin !== null && question.natMin !== "";
  if (question.type === "MSQ") return Array.isArray(question.correctKeys) && question.correctKeys.length > 0;
  return Boolean(question.correctKey);
}

export function correctValue(question) {
  if (!hasAnswerKey(question)) return null;
  if (question.type === "NAT") {
    const min = Number(question.natMin);
    const max = question.natMax === null || question.natMax === undefined || question.natMax === "" ? min : Number(question.natMax);
    return { min, max: Number.isFinite(max) ? max : min };
  }
  if (question.type === "MSQ") return { keys: [...question.correctKeys].sort() };
  return { keys: [question.correctKey] };
}

// Cleans a raw student answer for a question type. Returns null when empty or invalid.
export function normalizeAnswer(type, raw) {
  if (type === "NAT") {
    const text = String(raw ?? "").trim();
    return NUMBER_PATTERN.test(text) && text.length <= 24 ? text : null;
  }
  if (type === "MSQ") {
    const list = Array.isArray(raw) ? raw : [];
    const keys = [...new Set(list.filter((key) => typeof key === "string" && KEY_PATTERN.test(key)))].sort();
    return keys.length ? keys : null;
  }
  return typeof raw === "string" && KEY_PATTERN.test(raw) ? raw : null;
}

export function isAnswered(answer) {
  return Array.isArray(answer) ? answer.length > 0 : answer !== undefined && answer !== null && String(answer).trim() !== "";
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

// status: "correct" | "wrong" | "skipped" | "unscored" (answered but the question has no answer key).
export function gradeQuestion(question, rawAnswer) {
  const marks = cleanMarks(question.marks, 1);
  const answer = normalizeAnswer(question.type, rawAnswer);
  const value = correctValue(question);
  if (!answer) return { status: "skipped", earned: 0, marks, answer: null, correct: value };
  if (!value) return { status: "unscored", earned: 0, marks, answer, correct: null };
  let right;
  if (question.type === "NAT") right = Number(answer) >= value.min - 1e-9 && Number(answer) <= value.max + 1e-9;
  else right = answer.length === value.keys.length && [].concat(answer).sort().join("") === value.keys.join("");
  if (right) return { status: "correct", earned: marks, marks, answer, correct: value };
  const negative = question.type === "MCQ" ? Math.max(0, Number(question.negativeMarks) || 0) : 0;
  return { status: "wrong", earned: -negative, marks, answer, correct: value };
}

export function evaluateSet(questions, answers) {
  const summary = { score: 0, maxScore: 0, correct: 0, wrong: 0, skipped: 0, unscored: 0, attempted: 0, scored: 0, total: questions.length, percent: 0, perQuestion: {} };
  for (const question of questions) {
    const graded = gradeQuestion(question, answers?.[question.id]);
    summary[graded.status] += 1;
    if (graded.status !== "skipped") summary.attempted += 1;
    if (hasAnswerKey(question)) {
      summary.scored += 1;
      summary.maxScore += graded.marks;
    }
    summary.score += graded.earned;
    summary.perQuestion[question.id] = {
      status: graded.status,
      earned: graded.earned,
      marks: graded.marks,
      answer: graded.answer,
      correct: graded.correct,
      correctText: formatValue(graded.correct),
      explanation: question.explanation || null
    };
  }
  summary.score = round2(summary.score);
  summary.maxScore = round2(summary.maxScore);
  summary.percent = summary.maxScore ? Math.max(0, Math.round((summary.score / summary.maxScore) * 100)) : 0;
  return summary;
}

export function formatMarks(value) {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function defaultDurationMinutes(questionCount) {
  return Math.max(10, Math.round(questionCount * 2));
}

export function formatDuration(total) {
  const seconds = Math.max(0, Math.floor(Number(total) || 0));
  const h = Math.floor(seconds / 3600);
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
