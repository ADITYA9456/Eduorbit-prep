// Pure helpers shared by the CBT builder routes and the admin UI. No server imports.

export const MAX_IMAGES_PER_RUN = 20;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // stay under Vercel's ~4.5 MB request cap
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const KEY_PATTERN = /^[A-Z]$/;

function cleanText(value, max) {
  return typeof value === "string" ? value.replace(/\u0000/g, "").trim().slice(0, max) : null;
}

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
    questions.push({ number: raw.number, text, options, passage: raw.passage ? cleanText(raw.passage, 20000) : null, has_figure: raw.has_figure });
  }
  return { ok: true, questions };
}

export function validateAnswerPairs(payload) {
  if (!payload || !Array.isArray(payload.answers)) return { ok: false, error: "Response has no answers array." };
  const pairs = [];
  for (const item of payload.answers) {
    const key = typeof item?.key === "string" ? item.key.trim().replace(/[().]/g, "").toUpperCase() : "";
    if (!Number.isInteger(item?.number) || item.number < 1 || item.number > 999 || !KEY_PATTERN.test(key)) {
      return { ok: false, error: "Response has an invalid answer row." };
    }
    pairs.push({ number: item.number, key });
  }
  return { ok: true, pairs };
}

// Parses pasted keys like "1-B, 2-C, 3-A", "1.B", "1) b", "Q4: (d)", one per line or comma-separated.
export function parseAnswerKeyText(input) {
  const pairs = [];
  const pattern = /(?:^|[^\dA-Za-z])(?:Q(?:uestion)?\s*)?(\d{1,3})\s*(?:[-–:.)=]|\s)\s*\(?([A-Za-z])\)?(?![A-Za-z])/g;
  for (const match of String(input || "").matchAll(pattern)) {
    pairs.push({ number: Number(match[1]), key: match[2].toUpperCase() });
  }
  return pairs;
}

// Applies number->key pairs to questions. A question is "conflicting" when the
// source lists different keys for its number, or the key is not one of its options.
export function applyAnswerKey(questions, pairs) {
  const byNumber = new Map();
  for (const { number, key } of pairs) {
    if (!byNumber.has(number)) byNumber.set(number, new Set());
    byNumber.get(number).add(key);
  }
  const counts = { matched: 0, unmatched: 0, conflicting: 0, unusedKeys: 0 };
  const questionNumbers = new Set(questions.map((question) => question.number));
  for (const number of byNumber.keys()) if (!questionNumbers.has(number)) counts.unusedKeys += 1;
  const next = questions.map((question) => {
    const keys = byNumber.get(question.number);
    if (!keys) {
      counts.unmatched += 1;
      return { ...question, correctKey: "", keyStatus: "unmatched" };
    }
    const [key] = keys;
    const known = question.options.some((option) => option.key === key);
    if (keys.size > 1 || !known) {
      counts.conflicting += 1;
      return { ...question, correctKey: "", keyStatus: "conflicting", keyCandidates: [...keys] };
    }
    counts.matched += 1;
    return { ...question, correctKey: key, keyStatus: "matched", keyCandidates: undefined };
  });
  return { questions: next, counts };
}

export function questionFlags(question, duplicateNumbers) {
  const flags = [];
  if (!String(question.text || "").trim()) flags.push("Empty text");
  if ((question.options || []).filter((option) => String(option.text || "").trim()).length < 2) flags.push("Missing options");
  if (!Number.isInteger(question.number) || question.number < 1) flags.push("Invalid number");
  else if (duplicateNumbers.has(question.number)) flags.push("Duplicate number");
  if (!question.correctKey) flags.push("No answer key");
  return flags;
}

export function scoreAnswers(questions, answers) {
  let correct = 0;
  let attempted = 0;
  for (const question of questions) {
    const chosen = answers?.[question.id];
    if (typeof chosen !== "string" || !chosen) continue;
    attempted += 1;
    if (question.correct_key && chosen === question.correct_key) correct += 1;
  }
  return { correct, attempted, total: questions.length };
}
