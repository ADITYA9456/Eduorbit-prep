import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";
import { sha256, uploadSource } from "@/lib/cbt";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const form = await request.formData();
  const questionPdf = form.get("questionPdf");
  const answerKeyPdf = form.get("answerKeyPdf");
  const paperId = String(form.get("paperId") || "") || null;
  const queue = form.get("queue") === "true";
  if (!questionPdf || typeof questionPdf.arrayBuffer !== "function") {
    return NextResponse.json({ error: "A question PDF is required." }, { status: 400 });
  }
  if (answerKeyPdf && typeof answerKeyPdf.arrayBuffer !== "function") {
    return NextResponse.json({ error: "Answer key must be a PDF." }, { status: 400 });
  }
  const questionBuffer = Buffer.from(await questionPdf.arrayBuffer());
  const answerBuffer = answerKeyPdf ? Buffer.from(await answerKeyPdf.arrayBuffer()) : null;
  const id = crypto.randomUUID();
  const batchId = String(form.get("batchId") || "") || null;
  const base = `${admin.id}/${id}`;
  try {
    const questionHash = sha256(questionBuffer);
    const { data: duplicate } = await getPrepTable("prep_cbt_imports").select("id,status,question_pdf_name").eq("question_sha256", questionHash).maybeSingle();
    if (duplicate) return NextResponse.json({ error: `Duplicate question PDF already imported as ${duplicate.question_pdf_name}.`, duplicate }, { status: 409 });
    await uploadSource(`${base}/question.pdf`, questionBuffer);
    if (answerBuffer) await uploadSource(`${base}/answer-key.pdf`, answerBuffer);
    if (queue) {
      const { data, error } = await getPrepTable("prep_cbt_imports").insert({
        id, batch_id: batchId, paper_id: paperId, created_by: admin.id, status: "QUEUED",
        question_pdf_name: questionPdf.name, answer_key_pdf_name: answerKeyPdf?.name || null,
        question_pdf_path: `${base}/question.pdf`, answer_key_pdf_path: answerBuffer ? `${base}/answer-key.pdf` : null,
        question_sha256: questionHash, answer_key_sha256: answerBuffer ? sha256(answerBuffer) : null,
        metadata: { processingStage: "QUEUED", manualReviewRequired: true }
      }).select("id,paper_id,status,question_pdf_name,answer_key_pdf_name,metadata,questions,error_message,created_at").single();
      if (error) throw error;
      return NextResponse.json({ import: data }, { status: 201 });
    }
    return NextResponse.json({ error: "Legacy single-file processing is no longer supported. Queue the job first." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "PDF processing failed." }, { status: 400 });
  }
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { data, error } = await getPrepTable("prep_cbt_imports").select("id,paper_id,status,question_pdf_name,answer_key_pdf_name,metadata,questions,error_message,created_at").order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ imports: data || [] });
}
