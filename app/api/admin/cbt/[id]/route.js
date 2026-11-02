import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getPrepTable, getSupabaseServer } from "@/lib/supabase";
import { processImport } from "@/lib/cbt";

export async function PATCH(request, { params }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await request.json();
  if (!Array.isArray(body.questions)) return NextResponse.json({ error: "Questions are required." }, { status: 400 });
  const { data, error } = await getPrepTable("prep_cbt_imports").update({
    questions: body.questions,
    metadata: body.metadata || {},
    status: "REVIEW",
    updated_at: new Date().toISOString()
  }).eq("id", params.id).select("id,status,metadata,questions").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ import: data });
}

export async function POST(request, { params }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { data: item, error: loadError } = await getPrepTable("prep_cbt_imports").select("id,paper_id,questions,metadata,status").eq("id", params.id).maybeSingle();
  if (loadError || !item) return NextResponse.json({ error: loadError?.message || "Import not found." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  if (body.action === "retry") {
    const { data: source, error: sourceError } = await getPrepTable("prep_cbt_imports").select("question_pdf_path,answer_key_pdf_path,question_pdf_name,answer_key_pdf_name").eq("id", params.id).single();
    if (sourceError) return NextResponse.json({ error: sourceError.message }, { status: 400 });
    const storage = getSupabaseServer().storage.from("eduorbit-cbt-source-pdfs");
    const question = await storage.download(source.question_pdf_path);
    const answer = source.answer_key_pdf_path ? await storage.download(source.answer_key_pdf_path) : { data: null, error: null };
    if (question.error || answer.error) return NextResponse.json({ error: question.error?.message || answer.error?.message }, { status: 400 });
    try {
      const extraction = await processImport({ questionBuffer: Buffer.from(await question.data.arrayBuffer()), questionName: source.question_pdf_name, answerBuffer: answer.data ? Buffer.from(await answer.data.arrayBuffer()) : null, answerName: source.answer_key_pdf_name });
      const { data, error } = await getPrepTable("prep_cbt_imports").update({ status: extraction.questions.length ? "REVIEW" : "FAILED", metadata: { ...extraction.metadata, ...extraction.diagnostics, warnings: extraction.warnings }, questions: extraction.questions, answer_key: extraction.answerKey, error_message: extraction.questions.length ? null : extraction.warnings.join(" ") || "No questions were extracted.", updated_at: new Date().toISOString() }).eq("id", params.id).select("id,status,metadata,questions,error_message").single();
      if (error) throw error;
      return NextResponse.json({ import: data });
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }
  const incomplete = (item.questions || []).filter((question) => question.verificationStatus !== "VERIFIED" || !question.answer);
  if (!item.questions?.length || incomplete.length) {
    return NextResponse.json({ error: `${incomplete.length || "All"} question(s) must be verified and have an official answer before publishing.` }, { status: 400 });
  }
  const { data, error } = await getPrepTable("prep_cbt_imports").update({ status: "PUBLISHED", updated_at: new Date().toISOString() }).eq("id", params.id).select("id,status").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ import: data });
}
