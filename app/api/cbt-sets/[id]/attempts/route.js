import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";
import { scoreAnswers } from "@/lib/cbtSetShared";

// Saves a finished attempt for a signed-in student. The score is recomputed from stored keys.
export async function POST(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const answers = body?.answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return NextResponse.json({ error: "Answers are required." }, { status: 400 });
  const { data: set, error } = await getPrepTable("cbt_sets").select("id,cbt_questions(id,correct_key)").eq("id", id).eq("is_published", true).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!set) return NextResponse.json({ error: "Set not found." }, { status: 404 });
  const questions = set.cbt_questions || [];
  const validIds = new Set(questions.map((question) => question.id));
  const cleanAnswers = Object.fromEntries(Object.entries(answers).filter(([questionId, key]) => validIds.has(questionId) && typeof key === "string" && /^[A-Z]$/.test(key)));
  const score = scoreAnswers(questions, cleanAnswers);
  const { data, error: insertError } = await getPrepTable("cbt_attempts").insert({
    set_id: set.id,
    user_id: user.id,
    answers: cleanAnswers,
    correct_count: score.correct,
    attempted_count: score.attempted,
    total_count: score.total
  }).select("id,correct_count,attempted_count,total_count,completed_at").single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ attempt: data }, { status: 201 });
}
