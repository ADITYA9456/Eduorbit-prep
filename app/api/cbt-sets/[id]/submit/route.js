import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";
import { getPublishedCbtSetWithKeys, isMissingColumn } from "@/lib/cbtSets";
import { evaluateSet, normalizeAnswer } from "@/lib/cbtSetShared";

function clampInt(value, max) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(max, Math.max(0, number)) : null;
}

// Grades a finished attempt on the server and returns the full result with answers and explanations.
// Signed-in students also get the attempt saved. Guests only get the result.
export async function POST(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const answers = body?.answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return NextResponse.json({ error: "Answers are required." }, { status: 400 });
  try {
    const set = await getPublishedCbtSetWithKeys(id);
    if (!set) return NextResponse.json({ error: "Set not found." }, { status: 404 });
    const clean = {};
    for (const question of set.questions) {
      const answer = normalizeAnswer(question.type, answers[question.id]);
      if (answer) clean[question.id] = answer;
    }
    const result = evaluateSet(set.questions, clean);
    const user = await getCurrentUser();
    let attemptId = null;
    if (user && result.attempted > 0) {
      const base = { set_id: set.id, user_id: user.id, answers: clean, correct_count: result.correct, attempted_count: result.attempted, total_count: result.total };
      const withMode = { mode: body?.mode === "EXAM" ? "EXAM" : "STUDY", duration_seconds: clampInt(body?.durationSeconds, 86400), violations: clampInt(body?.violations, 999) ?? 0 };
      const withScore = { score: result.score, max_score: result.maxScore };
      // Newest schema first; fall back for databases that have not run migrations 011/012 so the attempt is never lost.
      const variants = [{ ...base, ...withMode, ...withScore }, { ...base, ...withMode }, { ...base, ...withScore }, base];
      let lastError = null;
      for (const row of variants) {
        const { data, error } = await getPrepTable("cbt_attempts").insert(row).select("id").single();
        if (!error) { attemptId = data.id; lastError = null; break; }
        lastError = error;
        if (!isMissingColumn(error)) break;
      }
      if (lastError) console.warn("CBT attempt was not saved:", lastError.message);
    }
    return NextResponse.json({ result, attemptId, saved: Boolean(attemptId) }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not submit this attempt." }, { status: 500 });
  }
}
