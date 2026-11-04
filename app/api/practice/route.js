import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";
import { getPracticeTest, listPracticeTests } from "@/lib/practice";

const DEFAULT_DURATIONS = { SUBJECT: 60 * 60, FULL_LENGTH: 3 * 60 * 60 };

function durationFor(test) {
  return Number.isInteger(test.duration_seconds) ? test.duration_seconds : DEFAULT_DURATIONS[test.test_type] || DEFAULT_DURATIONS.FULL_LENGTH;
}

async function loadOrStartAttempt(userId, test) {
  const { data: existing, error } = await getPrepTable("prep_practice_responses").select("*").eq("user_id", userId).eq("test_id", test.id).maybeSingle();
  if (error) throw error;
  if (existing?.started_at) return existing;
  const startedAt = new Date();
  const deadlineAt = new Date(startedAt.getTime() + durationFor(test) * 1000);
  const { data: created, error: createError } = await getPrepTable("prep_practice_responses").insert({
    user_id: userId, test_id: test.id, answers: existing?.answers || {}, started_at: startedAt.toISOString(), deadline_at: deadlineAt.toISOString(),
    remaining_seconds: durationFor(test)
  }).select("*").single();
  if (!createError) return created;
  const { data: concurrent, error: concurrentError } = await getPrepTable("prep_practice_responses").select("*").eq("user_id", userId).eq("test_id", test.id).single();
  if (concurrentError) throw createError;
  return concurrent;
}

export async function GET(request) {
  const url = new URL(request.url);
  const testId = url.searchParams.get("testId");
  const branchId = url.searchParams.get("branchId");
  try {
    if (branchId) return NextResponse.json({ tests: await listPracticeTests(branchId) });
    if (!testId) return NextResponse.json({ error: "Test is required." }, { status: 400 });
    const test = await getPracticeTest(testId);
    if (!test) return NextResponse.json({ error: "Practice test is unavailable." }, { status: 404 });
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ test, response: null, durationSeconds: durationFor(test) });
    const response = await loadOrStartAttempt(user.id, test);
    const remainingSeconds = response.deadline_at ? Math.max(0, Math.ceil((new Date(response.deadline_at).getTime() - Date.now()) / 1000)) : durationFor(test);
    return NextResponse.json({ test, response: { ...response, remaining_seconds: remainingSeconds }, durationSeconds: durationFor(test), deadlineAt: response.deadline_at, questionTimeBudgetSeconds: test.questions?.length ? durationFor(test) / test.questions.length : null });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { testId, answers = {}, submit } = await request.json();
  if (!testId || typeof answers !== "object") return NextResponse.json({ error: "Invalid Practice response." }, { status: 400 });
  const test = await getPracticeTest(testId, true);
  if (!test) return NextResponse.json({ error: "Practice test is unavailable." }, { status: 404 });
  const attempt = await loadOrStartAttempt(user.id, test);
  const existing = attempt;
  if (existing?.submitted_at) return NextResponse.json({ response: existing, result: existing.result });
  const expired = existing.deadline_at && Date.now() >= new Date(existing.deadline_at).getTime();
  const shouldSubmit = Boolean(submit || expired);
  const result = shouldSubmit ? score(test.questions, answers) : null;
  const remaining = expired ? 0 : Math.max(0, Math.ceil((new Date(existing.deadline_at).getTime() - Date.now()) / 1000));
  const { data, error } = await getPrepTable("prep_practice_responses").upsert({
    user_id: user.id, test_id: testId, answers, remaining_seconds: remaining,
    started_at: existing.started_at, deadline_at: existing.deadline_at, submitted_at: shouldSubmit ? new Date().toISOString() : null, score: result?.score ?? null, result, updated_at: new Date().toISOString()
  }, { onConflict: "user_id,test_id" }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ response: data, result, expired });
}

function score(questions, answers) {
  let scoreValue = 0; let correct = 0; let incorrect = 0; let attempted = 0; let notEvaluated = 0;
  const details = questions.map((question) => {
    const raw = answers[question.number];
    const actual = Array.isArray(raw) ? raw.join("").toUpperCase() : String(raw || "").replace(/\s+/g, "").toUpperCase();
    const isAttempted = Boolean(actual); if (isAttempted) attempted += 1;
    if (!question.answerVerified || question.answer === undefined || question.answer === null) {
      notEvaluated += 1;
      return { number: question.number, studentAnswer: raw ?? null, correctAnswer: null, status: "NOT_EVALUATED" };
    }
    if (!isAttempted) return { number: question.number, studentAnswer: null, correctAnswer: question.answer, status: "UNATTEMPTED" };
    const expected = Array.isArray(question.answer) ? question.answer.join("").toUpperCase() : String(question.answer).replace(/\s+/g, "").toUpperCase();
    const isCorrect = question.type === "NAT"
      ? Number(raw) === Number(question.answer)
      : actual === expected;
    if (isCorrect) { correct += 1; scoreValue += Number.isFinite(Number(question.marks)) ? Number(question.marks) : 0; }
    else { incorrect += 1; scoreValue -= Number.isFinite(Number(question.negativeMarks)) ? Number(question.negativeMarks) : 0; }
    return { number: question.number, studentAnswer: raw, correctAnswer: question.answer, status: isCorrect ? "CORRECT" : "INCORRECT" };
  });
  return { score: Math.max(0, scoreValue), correct, incorrect, attempted, unattempted: questions.length - attempted - notEvaluated, notEvaluated, total: questions.length, details };
}
