import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";
import { processImport, uploadSource } from "@/lib/cbt";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const form = await request.formData();
  const questionPdf = form.get("questionPdf");
  const answerKeyPdf = form.get("answerKeyPdf");
  const paperId = String(form.get("paperId") || "");
  if (!questionPdf || typeof questionPdf.arrayBuffer !== "function" || !paperId) {
    return NextResponse.json({ error: "A question PDF and existing paper are required." }, { status: 400 });
  }
  if (answerKeyPdf && typeof answerKeyPdf.arrayBuffer !== "function") {
    return NextResponse.json({ error: "Answer key must be a PDF." }, { status: 400 });
  }
  const questionBuffer = Buffer.from(await questionPdf.arrayBuffer());
  const answerBuffer = answerKeyPdf ? Buffer.from(await answerKeyPdf.arrayBuffer()) : null;
  const id = crypto.randomUUID();
  const base = `${admin.id}/${id}`;
  try {
    const extraction = await processImport({
      questionBuffer,
      questionName: questionPdf.name,
      answerBuffer,
      answerName: answerKeyPdf?.name
    });
    await uploadSource(`${base}/question.pdf`, questionBuffer);
    if (answerBuffer) await uploadSource(`${base}/answer-key.pdf`, answerBuffer);
    const { data, error } = await getPrepTable("prep_cbt_imports").insert({
      id,
      paper_id: paperId,
      created_by: admin.id,
      status: extraction.questions.length ? "REVIEW" : "FAILED",
      question_pdf_name: questionPdf.name,
      answer_key_pdf_name: answerKeyPdf?.name || null,
      question_pdf_path: `${base}/question.pdf`,
      answer_key_pdf_path: answerBuffer ? `${base}/answer-key.pdf` : null,
      metadata: { ...extraction.metadata, warnings: extraction.warnings },
      questions: extraction.questions,
      answer_key: extraction.answerKey,
      error_message: extraction.questions.length ? null : "No questions were extracted."
    }).select("id,status,metadata,questions").single();
    if (error) throw error;
    return NextResponse.json({ import: data }, { status: 201 });
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
