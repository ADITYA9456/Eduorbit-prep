import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";
import { isUuid, readJson, serverError, tooLarge } from "@/lib/http";
import { limitRequest } from "@/lib/rateLimit";

const DURATION_SECONDS = 3 * 60 * 60;

async function context() {
  const user = await getCurrentUser();
  return user ? { user } : null;
}

async function expireIfNeeded(attempt) {
  if (!attempt || attempt.status !== "ACTIVE" || new Date(attempt.expires_at).getTime() > Date.now()) return attempt;
  const { data, error } = await getPrepTable("prep_exam_attempts")
    .update({ status: "EXPIRED" })
    .eq("id", attempt.id)
    .eq("status", "ACTIVE")
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function getAttempt(request) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const paperId = new URL(request.url).searchParams.get("paperId");
  if (!paperId || !isUuid(paperId)) return NextResponse.json({ error: "Paper is required" }, { status: 400 });
  const { data, error } = await getPrepTable("prep_exam_attempts")
    .select("*")
    .eq("user_id", ctx.user.id)
    .eq("paper_id", paperId)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return serverError(error, "exam-attempts GET");
  const attempt = await expireIfNeeded(data);
  return NextResponse.json({ attempt: attempt?.status === "ACTIVE" ? attempt : null, expired: attempt?.status === "EXPIRED", serverNow: new Date().toISOString() });
}

async function createAttempt(request) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const limited = limitRequest(request, "exam-attempts-write", { limit: 20, userId: ctx.user.id }); if (limited) return limited;
  const body = await readJson(request, 64 * 1024);
  if (!body) return tooLarge();
  const { paperId } = body;
  if (!isUuid(paperId)) return NextResponse.json({ error: "Paper is required" }, { status: 400 });
  const { data: paper, error: paperError } = await getPrepTable("prep_papers").select("id").eq("id", paperId).eq("is_published", true).maybeSingle();
  if (paperError) return serverError(paperError, "exam-attempts POST");
  if (!paper) return NextResponse.json({ error: "Paper is unavailable." }, { status: 404 });

  const { data: existing, error: existingError } = await getPrepTable("prep_exam_attempts")
    .select("*")
    .eq("user_id", ctx.user.id)
    .eq("paper_id", paperId)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) return serverError(existingError, "exam-attempts POST");
  const active = await expireIfNeeded(existing);
  if (active?.status === "ACTIVE") return NextResponse.json({ attempt: active, serverNow: new Date().toISOString(), restored: true });

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + DURATION_SECONDS * 1000);
  const { data: attempt, error } = await getPrepTable("prep_exam_attempts")
    .insert({ user_id: ctx.user.id, paper_id: paperId, started_at: startedAt.toISOString(), expires_at: expiresAt.toISOString(), status: "ACTIVE" })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") {
      const { data: concurrent } = await getPrepTable("prep_exam_attempts").select("*").eq("user_id", ctx.user.id).eq("paper_id", paperId).eq("status", "ACTIVE").limit(1).maybeSingle();
      if (concurrent) return NextResponse.json({ attempt: concurrent, serverNow: new Date().toISOString(), restored: true });
    }
    return serverError(error, "exam-attempts POST");
  }
  return NextResponse.json({ attempt, serverNow: startedAt.toISOString(), restored: false }, { status: 201 });
}

export async function GET(request) {
  try { return await getAttempt(request); } catch (error) { return serverError(error, "exam-attempts GET"); }
}

export async function POST(request) {
  try { return await createAttempt(request); } catch (error) { return serverError(error, "exam-attempts POST"); }
}
