import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";

async function context() {
  const user = await getCurrentUser();
  return user ? { user } : null;
}
export async function GET(request) {
  const ctx = await context(); if (!ctx) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const paperId = new URL(request.url).searchParams.get("paperId");
  const [paper, questions, notes] = await Promise.all([
    getPrepTable("prep_user_progress").select("*").eq("user_id", ctx.user.id).eq("paper_id", paperId).maybeSingle(),
    getPrepTable("prep_user_question_progress").select("*").eq("user_id", ctx.user.id).eq("paper_id", paperId),
    getPrepTable("prep_question_notes").select("*").eq("user_id", ctx.user.id).eq("paper_id", paperId)
  ]);
  if (paper.error || questions.error || notes.error) return NextResponse.json({ error: "Unable to load progress" }, { status: 500 });
  return NextResponse.json({ paper: paper.data, questions: questions.data, notes: notes.data });
}
export async function POST(request) {
  const ctx = await context(); if (!ctx) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json(); const { paperId, questionNumber, content, isCompleted } = body;
  if (!paperId || (content !== undefined && (!Number.isInteger(Number(questionNumber)) || Number(questionNumber) < 1))) return NextResponse.json({ error: "Invalid progress payload" }, { status: 400 });
  const normalizedQuestionNumber = questionNumber === undefined ? undefined : Number(questionNumber);
  let result;
  if (questionNumber !== undefined && content === undefined) {
    result = await getPrepTable("prep_user_question_progress").upsert({ user_id: ctx.user.id, paper_id: paperId, question_number: normalizedQuestionNumber, is_completed: Boolean(isCompleted), completed_at: isCompleted ? new Date().toISOString() : null }, { onConflict: "user_id,paper_id,question_number" });
  } else if (content !== undefined) {
    const query = getPrepTable("prep_question_notes").delete().eq("user_id", ctx.user.id).eq("paper_id", paperId).eq("question_number", normalizedQuestionNumber);
    result = String(content).trim() ? await getPrepTable("prep_question_notes").upsert({ user_id: ctx.user.id, paper_id: paperId, question_number: normalizedQuestionNumber, content: String(content).trim() }, { onConflict: "user_id,paper_id,question_number" }) : await query;
  } else {
    result = await getPrepTable("prep_user_progress").upsert({ user_id: ctx.user.id, paper_id: paperId, is_completed: Boolean(isCompleted), completed_at: isCompleted ? new Date().toISOString() : null }, { onConflict: "user_id,paper_id" });
  }
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
