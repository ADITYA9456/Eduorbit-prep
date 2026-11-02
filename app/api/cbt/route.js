import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";

const EXAM_SECONDS = 3 * 60 * 60;

async function load(paperId) {
  const { data, error } = await getPrepTable("prep_cbt_imports").select("questions,metadata").eq("paper_id", paperId).eq("status", "PUBLISHED").limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const url = new URL(request.url);
  const paperId = url.searchParams.get("paperId");
  const mode = url.searchParams.get("mode") === "EXAM" ? "EXAM" : "PRACTICE";
  if (!paperId) return NextResponse.json({ error: "Paper is required." }, { status: 400 });
  try {
    const cbt = await load(paperId);
    if (!cbt) return NextResponse.json({ error: "CBT is unavailable." }, { status: 404 });
    const { data: response, error } = await getPrepTable("prep_cbt_responses").select("*").eq("user_id", user.id).eq("paper_id", paperId).eq("mode", mode).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ questions: cbt.questions, metadata: cbt.metadata, response, serverNow: new Date().toISOString(), durationSeconds: EXAM_SECONDS });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json();
  const { paperId, mode = "PRACTICE", answers = {}, remainingSeconds, submit } = body;
  if (!paperId || !["PRACTICE", "EXAM"].includes(mode) || typeof answers !== "object") return NextResponse.json({ error: "Invalid CBT response." }, { status: 400 });
  try {
    const cbt = await load(paperId);
    if (!cbt) return NextResponse.json({ error: "CBT is unavailable." }, { status: 404 });
    const result = submit ? score(cbt.questions, answers) : null;
    const payload = {
      user_id: user.id,
      paper_id: paperId,
      mode,
      answers,
      remaining_seconds: Number.isInteger(remainingSeconds) ? Math.max(0, remainingSeconds) : null,
      submitted_at: submit ? new Date().toISOString() : null,
      score: result?.score ?? null,
      result
    };
    const { data, error } = await getPrepTable("prep_cbt_responses").upsert(payload, { onConflict: "user_id,paper_id,mode" }).select("*").single();
    if (error) throw error;
    return NextResponse.json({ response: data, result });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function score(questions, answers) {
  let scoreValue = 0;
  let correct = 0;
  let attempted = 0;
  const details = questions.map((question) => {
    const answer = answers[question.number];
    const expected = String(question.answer || "").replace(/\s+/g, "").toUpperCase();
    const actual = Array.isArray(answer) ? answer.join("").toUpperCase() : String(answer || "").replace(/\s+/g, "").toUpperCase();
    const isAttempted = Boolean(actual);
    if (isAttempted) attempted += 1;
    const isCorrect = Boolean(expected && actual === expected);
    if (isCorrect) {
      correct += 1;
      scoreValue += Number(question.marks || 1);
    } else if (isAttempted) {
      scoreValue -= Number(question.negativeMarks || 0);
    }
    return { number: question.number, correct: isCorrect, attempted: isAttempted };
  });
  return { score: Math.max(0, scoreValue), correct, attempted, total: questions.length, details };
}
