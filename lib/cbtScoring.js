function letters(value) {
  const list = Array.isArray(value) ? value : String(value ?? "").split(/[^A-Za-z0-9]+/);
  return [...new Set(list.flatMap((item) => String(item).toUpperCase().split("")).filter(Boolean))].sort().join("");
}

function hasAnswer(raw) {
  if (Array.isArray(raw)) return raw.length > 0;
  return raw !== undefined && raw !== null && String(raw).trim() !== "";
}

function isVerified(question) {
  if (question.answer === undefined || question.answer === null || question.answer === "") return false;
  return question.answerVerified === true || question.verificationStatus === "VERIFIED";
}

function matches(question, raw) {
  if (question.type === "NAT") {
    const given = Number(raw);
    const expected = Number(question.answer);
    if (!Number.isFinite(given) || !Number.isFinite(expected)) return false;
    const tolerance = Number.isFinite(Number(question.tolerance)) ? Math.abs(Number(question.tolerance)) : 0;
    return Math.abs(given - expected) <= tolerance + 1e-9;
  }
  return letters(raw) === letters(question.answer);
}

function finite(value, fallback) {
  return value !== undefined && value !== null && value !== "" && Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export function scoreQuestions(questions, answers, { defaultMarks = 1 } = {}) {
  let score = 0;
  let correct = 0;
  let incorrect = 0;
  let attempted = 0;
  let notEvaluated = 0;
  const details = questions.map((question) => {
    const raw = answers?.[question.number];
    const isAttempted = hasAnswer(raw);
    if (isAttempted) attempted += 1;
    if (!isVerified(question)) {
      notEvaluated += 1;
      return { number: question.number, studentAnswer: isAttempted ? raw : null, correctAnswer: null, status: "NOT_EVALUATED" };
    }
    if (!isAttempted) return { number: question.number, studentAnswer: null, correctAnswer: question.answer, status: "UNATTEMPTED" };
    if (matches(question, raw)) {
      correct += 1;
      score += finite(question.marks, defaultMarks);
      return { number: question.number, studentAnswer: raw, correctAnswer: question.answer, status: "CORRECT" };
    }
    incorrect += 1;
    score -= Math.abs(finite(question.negativeMarks, 0));
    return { number: question.number, studentAnswer: raw, correctAnswer: question.answer, status: "INCORRECT" };
  });
  return {
    score: Math.round(score * 100) / 100,
    correct,
    incorrect,
    attempted,
    unattempted: details.filter((detail) => detail.status === "UNATTEMPTED").length,
    notEvaluated,
    total: questions.length,
    details
  };
}
