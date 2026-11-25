import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";
import { badRequest, isUuid, readJson, serverError, tooLarge } from "@/lib/http";
import { limitRequest } from "@/lib/rateLimit";

const MAX_NOTE_LENGTH = 5000;
const MAX_QUESTION_NUMBER = 500;

async function context() {
  const user = await getCurrentUser();
  return user ? { user } : null;
}
export async function GET(request) {
  const ctx = await context(); if (!ctx) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const paperId = new URL(request.url).searchParams.get("paperId");
  if (!isUuid(paperId)) return badRequest("Invalid progress payload");
  const [paper, questions, notes] = await Promise.all([
    getPrepTable("prep_user_progress").select("*").eq("user_id", ctx.user.id).eq("paper_id", paperId).maybeSingle(),
    getPrepTable("prep_user_question_progress").select("*").eq("user_id", ctx.user.id).eq("paper_id", paperId),
    getPrepTable("prep_question_notes").select("*").eq("user_id", ctx.user.id).eq("paper_id", paperId)
  ]);
  if (paper.error || questions.error || notes.error) return serverError(paper.error || questions.error || notes.error, "progress GET");
  return NextResponse.json({ paper: paper.data, questions: questions.data, notes: notes.data });
}
export async function POST(request) {
  const ctx = await context(); if (!ctx) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const limited = limitRequest(request, "progress-write", { limit: 120, userId: ctx.user.id }); if (limited) return limited;
  const body = await readJson(request, 64 * 1024); if (!body) return tooLarge();
  const { paperId, questionNumber, content, isCompleted } = body;
  if (!isUuid(paperId)) return badRequest("Invalid progress payload");
  if (questionNumber !== undefined && (!Number.isInteger(Number(questionNumber)) || Number(questionNumber) < 1 || Number(questionNumber) > MAX_QUESTION_NUMBER)) return badRequest("Invalid progress payload");
  if (content !== undefined && (questionNumber === undefined || typeof content !== "string")) return badRequest("Invalid progress payload");
  if (typeof content === "string" && content.length > MAX_NOTE_LENGTH) return badRequest(`Notes can be up to ${MAX_NOTE_LENGTH} characters.`);
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
  if (result.error) return serverError(result.error, "progress POST");
  return NextResponse.json({ ok: true });
}
