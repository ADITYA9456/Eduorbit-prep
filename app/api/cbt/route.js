import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";
import { scoreQuestions } from "@/lib/cbtScoring";
import { isUuid, readJson, serverError, tooLarge } from "@/lib/http";
import { limitRequest } from "@/lib/rateLimit";
import { validateAnswers } from "@/lib/answerPayload";

const EXAM_SECONDS = 3 * 60 * 60;
const SUBMIT_GRACE_MS = 15 * 1000;

async function load(paperId) {
  const { data, error } = await getPrepTable("prep_cbt_imports").select("questions,metadata").eq("paper_id", paperId).eq("status", "PUBLISHED").limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

const publicQuestions = (questions) => questions.map(({ answer, verificationStatus, tolerance, ...publicQuestion }) => publicQuestion);

async function loadResponse(userId, paperId, mode) {
  const { data, error } = await getPrepTable("prep_cbt_responses").select("*").eq("user_id", userId).eq("paper_id", paperId).eq("mode", mode).maybeSingle();
  if (error) throw error;
  return data;
}

function remainingFor(response) {
  if (!response?.deadline_at) return EXAM_SECONDS;
  return Math.max(0, Math.ceil((new Date(response.deadline_at).getTime() - Date.now()) / 1000));
}

function withTiming(response) {
  if (!response?.started_at) return response;
  return { ...response, remaining_seconds: response.submitted_at ? response.remaining_seconds ?? 0 : remainingFor(response) };
}

async function startExamAttempt(userId, paperId) {
  const existing = await loadResponse(userId, paperId, "EXAM");
  if (existing?.started_at) return existing;
  const startedAt = new Date();
  const timing = { started_at: startedAt.toISOString(), deadline_at: new Date(startedAt.getTime() + EXAM_SECONDS * 1000).toISOString(), remaining_seconds: EXAM_SECONDS };
  if (existing) {
    const { data: updated, error: updateError } = await getPrepTable("prep_cbt_responses").update(timing).eq("user_id", userId).eq("paper_id", paperId).eq("mode", "EXAM").is("started_at", null).select("*").maybeSingle();
    if (updateError) throw updateError;
    if (updated) return updated;
  } else {
    const { data: created, error: createError } = await getPrepTable("prep_cbt_responses").insert({ user_id: userId, paper_id: paperId, mode: "EXAM", answers: {}, ...timing }).select("*").single();
    if (!createError) return created;
    const concurrent = await loadResponse(userId, paperId, "EXAM").catch(() => null);
    if (!concurrent?.started_at) throw createError;
    return concurrent;
  }
  const concurrent = await loadResponse(userId, paperId, "EXAM");
  if (!concurrent?.started_at) throw new Error("Unable to start the exam.");
  return concurrent;
}

export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const url = new URL(request.url);
  const paperId = url.searchParams.get("paperId");
  const mode = url.searchParams.get("mode") === "EXAM" ? "EXAM" : "PRACTICE";
  if (!isUuid(paperId)) return NextResponse.json({ error: "Paper is required." }, { status: 400 });
  try {
    const cbt = await load(paperId);
    if (!cbt) return NextResponse.json({ error: "CBT is unavailable." }, { status: 404 });
    const response = await loadResponse(user.id, paperId, mode);
    // An exam is not readable until it has been started, so the questions cannot be peeked at through this API.
    const hidden = mode === "EXAM" && !response?.started_at && !response?.submitted_at;
    const body = { questions: hidden ? [] : publicQuestions(cbt.questions), questionCount: cbt.questions.length, metadata: cbt.metadata, response, serverNow: new Date().toISOString(), durationSeconds: EXAM_SECONDS };
    if (mode === "EXAM" && response?.started_at) {
      body.response = withTiming(response);
      body.deadlineAt = response.deadline_at;
    }
    return NextResponse.json(body);
  } catch (error) {
    return serverError(error, "cbt GET");
  }
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const limited = limitRequest(request, "cbt-write", { limit: 120, userId: user.id }); if (limited) return limited;
  const body = await readJson(request, 512 * 1024);
  if (!body) return tooLarge();
  try {
    const { paperId, mode = "PRACTICE", answers = {}, submit, start } = body;
    if (!isUuid(paperId) || !["PRACTICE", "EXAM"].includes(mode) || !answers || typeof answers !== "object" || Array.isArray(answers) || validateAnswers(answers)) return NextResponse.json({ error: "Invalid CBT response." }, { status: 400 });
    if (start && mode !== "EXAM") return NextResponse.json({ error: "Only exam mode has a start step." }, { status: 400 });
    const cbt = await load(paperId);
    if (!cbt) return NextResponse.json({ error: "CBT is unavailable." }, { status: 404 });

    if (start === true) {
      const attempt = await startExamAttempt(user.id, paperId);
      if (attempt.submitted_at) return NextResponse.json({ response: attempt, result: attempt.result, questions: publicQuestions(cbt.questions), questionCount: cbt.questions.length, serverNow: new Date().toISOString() });
      return NextResponse.json({ response: withTiming(attempt), questions: publicQuestions(cbt.questions), questionCount: cbt.questions.length, deadlineAt: attempt.deadline_at, serverNow: new Date().toISOString(), durationSeconds: EXAM_SECONDS });
    }

    const existing = await loadResponse(user.id, paperId, mode);
    if (existing?.submitted_at) return NextResponse.json({ response: existing, result: existing.result });
    if (mode === "EXAM" && !existing?.started_at) return NextResponse.json({ error: "Start the test first." }, { status: 409 });

    const deadlineMs = mode === "EXAM" ? new Date(existing.deadline_at).getTime() : null;
    const expired = deadlineMs !== null && Date.now() >= deadlineMs;
    const effectiveAnswers = expired && Date.now() > deadlineMs + SUBMIT_GRACE_MS ? existing.answers || {} : answers;
    const shouldSubmit = Boolean(submit || expired);
    const result = shouldSubmit ? scoreQuestions(cbt.questions, effectiveAnswers, { defaultMarks: 1 }) : null;
    const payload = {
      user_id: user.id,
      paper_id: paperId,
      mode,
      answers: effectiveAnswers,
      remaining_seconds: mode === "EXAM" ? (expired ? 0 : remainingFor(existing)) : null,
      submitted_at: shouldSubmit ? new Date().toISOString() : null,
      score: result?.score ?? null,
      result,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await getPrepTable("prep_cbt_responses").upsert(payload, { onConflict: "user_id,paper_id,mode" }).select("*").single();
    if (error) throw error;
    return NextResponse.json({ response: data, result, expired });
  } catch (error) {
    return serverError(error, "cbt POST");
  }
}
