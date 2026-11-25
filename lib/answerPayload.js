export const MAX_ANSWER_KEYS = 500;
export const MAX_ANSWER_TEXT = 64;
export const MAX_MSQ_CHOICES = 10;

// Returns an error message when an answers object is oversized or has odd values, otherwise null.
export function validateAnswers(answers) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return "Answers are invalid.";
  const keys = Object.keys(answers);
  if (keys.length > MAX_ANSWER_KEYS) return "Too many answers.";
  for (const key of keys) {
    if (key.length > MAX_ANSWER_TEXT) return "Answers are invalid.";
    const value = answers[key];
    if (value === null || value === undefined || typeof value === "boolean") continue;
    if (typeof value === "number") { if (!Number.isFinite(value)) return "Answers are invalid."; continue; }
    if (typeof value === "string") { if (value.length > MAX_ANSWER_TEXT) return "Answers are invalid."; continue; }
    if (Array.isArray(value)) {
      if (value.length > MAX_MSQ_CHOICES || value.some((item) => typeof item !== "string" || item.length > MAX_ANSWER_TEXT)) return "Answers are invalid.";
      continue;
    }
    return "Answers are invalid.";
  }
  return null;
}
