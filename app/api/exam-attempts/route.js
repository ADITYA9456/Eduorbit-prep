import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";

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

export async function GET(request) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const paperId = new URL(request.url).searchParams.get("paperId");
  if (!paperId) return NextResponse.json({ error: "Paper is required" }, { status: 400 });
  const { data, error } = await getPrepTable("prep_exam_attempts")
    .select("*")
    .eq("user_id", ctx.user.id)
    .eq("paper_id", paperId)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const attempt = await expireIfNeeded(data);
  return NextResponse.json({ attempt: attempt?.status === "ACTIVE" ? attempt : null, expired: attempt?.status === "EXPIRED", serverNow: new Date().toISOString() });
}

export async function POST(request) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { paperId } = await request.json();
  if (!paperId) return NextResponse.json({ error: "Paper is required" }, { status: 400 });
  const { data: paper, error: paperError } = await getPrepTable("prep_papers").select("id").eq("id", paperId).eq("is_published", true).maybeSingle();
  if (paperError) return NextResponse.json({ error: paperError.message }, { status: 500 });
  if (!paper) return NextResponse.json({ error: "Paper is unavailable." }, { status: 404 });

  const { data: existing, error: existingError } = await getPrepTable("prep_exam_attempts")
    .select("*")
    .eq("user_id", ctx.user.id)
    .eq("paper_id", paperId)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ attempt, serverNow: startedAt.toISOString(), restored: false }, { status: 201 });
}
