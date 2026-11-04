import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";

export async function PATCH(request, { params }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await request.json();
  if (!Array.isArray(body.questions)) return NextResponse.json({ error: "Questions are required." }, { status: 400 });
  const { data, error } = await getPrepTable("prep_practice_tests").update({
    questions: body.questions,
    metadata: body.metadata || {},
    updated_at: new Date().toISOString()
  }).eq("id", params.id).eq("status", "DRAFT").select("id,status,title,questions,metadata").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ test: data });
}

export async function POST(request, { params }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { data: test, error: loadError } = await getPrepTable("prep_practice_tests").select("id,status,questions").eq("id", params.id).maybeSingle();
  if (loadError || !test) return NextResponse.json({ error: loadError?.message || "Practice test not found." }, { status: 404 });
  if (!test.questions?.length) return NextResponse.json({ error: "At least one extracted question is required before publishing." }, { status: 400 });
  const incomplete = test.questions.filter((question) => !String(question.text || "").trim() || (question.type !== "NAT" && !question.options?.length));
  if (incomplete.length) return NextResponse.json({ error: `${incomplete.length} question(s) need text and options before publishing.` }, { status: 400 });
  const { data, error } = await getPrepTable("prep_practice_tests").update({ status: "PUBLISHED", updated_at: new Date().toISOString() }).eq("id", params.id).select("id,status").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ test: data });
}
