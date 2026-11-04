import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";
import { getPracticeTest, listPracticeTests } from "@/lib/practice";

const DURATION_SECONDS = 3 * 60 * 60;

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
    if (!user) return NextResponse.json({ test, response: null, durationSeconds: DURATION_SECONDS });
    const { data: response, error } = await getPrepTable("prep_practice_responses").select("*").eq("user_id", user.id).eq("test_id", testId).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ test, response, durationSeconds: DURATION_SECONDS });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { testId, answers = {}, remainingSeconds, submit } = await request.json();
  if (!testId || typeof answers !== "object") return NextResponse.json({ error: "Invalid Practice response." }, { status: 400 });
  const test = await getPracticeTest(testId);
  if (!test) return NextResponse.json({ error: "Practice test is unavailable." }, { status: 404 });
  const result = submit ? score(test.questions, answers) : null;
  const { data, error } = await getPrepTable("prep_practice_responses").upsert({
    user_id: user.id, test_id: testId, answers, remaining_seconds: Number.isInteger(remainingSeconds) ? Math.max(0, remainingSeconds) : null,
    submitted_at: submit ? new Date().toISOString() : null, score: result?.score ?? null, result, updated_at: new Date().toISOString()
  }, { onConflict: "user_id,test_id" }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ response: data, result });
}

function score(questions, answers) {
  let scoreValue = 0; let correct = 0; let attempted = 0;
  const details = questions.map((question) => {
    const raw = answers[question.number];
    const actual = Array.isArray(raw) ? raw.join("").toUpperCase() : String(raw || "").replace(/\s+/g, "").toUpperCase();
    const expected = String(question.answer || "").replace(/\s+/g, "").toUpperCase();
    const isAttempted = Boolean(actual); if (isAttempted) attempted += 1;
    const isCorrect = Boolean(expected && actual === expected);
    if (isCorrect) { correct += 1; scoreValue += Number(question.marks || 1); } else if (isAttempted) scoreValue -= Number(question.negativeMarks || 0);
    return { number: question.number, correct: isCorrect, attempted: isAttempted };
  });
  return { score: Math.max(0, scoreValue), correct, attempted, total: questions.length, details };
}
