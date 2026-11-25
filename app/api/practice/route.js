import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";
import { getPracticeTest, listPracticeTests } from "@/lib/practice";
import { scoreQuestions } from "@/lib/cbtScoring";

const DEFAULT_DURATIONS = { SUBJECT: 60 * 60, FULL_LENGTH: 3 * 60 * 60 };

function durationFor(test) {
  return Number.isInteger(test.duration_seconds) ? test.duration_seconds : DEFAULT_DURATIONS[test.test_type] || DEFAULT_DURATIONS.FULL_LENGTH;
}

const SUBMIT_GRACE_MS = 15 * 1000;

const withoutQuestions = (test) => ({ ...test, questions: [], questionCount: test.questions?.length || 0 });

async function loadAttempt(userId, testId) {
  const { data, error } = await getPrepTable("prep_practice_responses").select("*").eq("user_id", userId).eq("test_id", testId).maybeSingle();
  if (error) throw error;
  return data;
}

function remainingFor(response, test) {
  if (!response?.deadline_at) return durationFor(test);
  return Math.max(0, Math.ceil((new Date(response.deadline_at).getTime() - Date.now()) / 1000));
}

async function loadOrStartAttempt(userId, test) {
  const existing = await loadAttempt(userId, test.id);
  if (existing?.started_at) return existing;
  const startedAt = new Date();
  const timing = { started_at: startedAt.toISOString(), deadline_at: new Date(startedAt.getTime() + durationFor(test) * 1000).toISOString(), remaining_seconds: durationFor(test) };
  if (existing) {
    const { data: updated, error: updateError } = await getPrepTable("prep_practice_responses").update(timing).eq("user_id", userId).eq("test_id", test.id).is("started_at", null).select("*").maybeSingle();
    if (updateError) throw updateError;
    if (updated) return updated;
  } else {
    const { data: created, error: createError } = await getPrepTable("prep_practice_responses").insert({ user_id: userId, test_id: test.id, answers: {}, ...timing }).select("*").single();
    if (!createError) return created;
    const concurrentAfterError = await loadAttempt(userId, test.id).catch(() => null);
    if (!concurrentAfterError?.started_at) throw createError;
    return concurrentAfterError;
  }
  const concurrent = await loadAttempt(userId, test.id);
  if (!concurrent?.started_at) throw new Error("Unable to start the test.");
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
    if (!user) return NextResponse.json({ test: withoutQuestions(test), response: null, durationSeconds: durationFor(test) });
    const attempt = await loadAttempt(user.id, test.id);
    const serverNow = new Date().toISOString();
    const budget = test.questions?.length ? durationFor(test) / test.questions.length : null;
    // Questions stay hidden until the attempt has been started.
    if (!attempt?.started_at) return NextResponse.json({ test: withoutQuestions(test), questionCount: test.questions?.length || 0, response: null, serverNow, durationSeconds: durationFor(test), questionTimeBudgetSeconds: budget });
    const remainingSeconds = attempt.submitted_at ? attempt.remaining_seconds ?? 0 : remainingFor(attempt, test);
    return NextResponse.json({ test, response: { ...attempt, remaining_seconds: remainingSeconds }, serverNow, durationSeconds: durationFor(test), deadlineAt: attempt.deadline_at, questionTimeBudgetSeconds: budget });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    const { testId, answers = {}, submit, start } = await request.json();
    if (!testId || !answers || typeof answers !== "object" || Array.isArray(answers)) return NextResponse.json({ error: "Invalid Practice response." }, { status: 400 });
    const test = await getPracticeTest(testId, true);
    if (!test) return NextResponse.json({ error: "Practice test is unavailable." }, { status: 404 });
    if (start === true) {
      const attempt = await loadOrStartAttempt(user.id, test);
      const serverNow = new Date().toISOString();
      const publicTest = await getPracticeTest(testId);
      const budget = publicTest.questions?.length ? durationFor(test) / publicTest.questions.length : null;
      if (attempt.submitted_at) return NextResponse.json({ test: publicTest, response: attempt, result: attempt.result, serverNow });
      return NextResponse.json({ test: publicTest, response: { ...attempt, remaining_seconds: remainingFor(attempt, test) }, deadlineAt: attempt.deadline_at, serverNow, durationSeconds: durationFor(test), questionTimeBudgetSeconds: budget });
    }
    const existing = await loadAttempt(user.id, testId);
    if (existing?.submitted_at) return NextResponse.json({ response: existing, result: existing.result });
    if (!existing?.started_at) return NextResponse.json({ error: "Start the test first." }, { status: 409 });
    const deadlineMs = existing.deadline_at ? new Date(existing.deadline_at).getTime() : null;
    const expired = deadlineMs !== null && Date.now() >= deadlineMs;
    const effectiveAnswers = expired && Date.now() > deadlineMs + SUBMIT_GRACE_MS ? existing.answers || {} : answers;
    const shouldSubmit = Boolean(submit || expired);
    const result = shouldSubmit ? scoreQuestions(test.questions, effectiveAnswers, { defaultMarks: 0 }) : null;
    const remaining = expired ? 0 : remainingFor(existing, test);
    const { data, error } = await getPrepTable("prep_practice_responses").upsert({
      user_id: user.id, test_id: testId, answers: effectiveAnswers, remaining_seconds: remaining,
      started_at: existing.started_at, deadline_at: existing.deadline_at, submitted_at: shouldSubmit ? new Date().toISOString() : null, score: result?.score ?? null, result, updated_at: new Date().toISOString()
    }, { onConflict: "user_id,test_id" }).select("*").single();
    if (error) throw error;
    return NextResponse.json({ response: data, result, expired });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
