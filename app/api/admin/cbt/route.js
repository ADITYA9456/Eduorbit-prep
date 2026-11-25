import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";
import { sha256, uploadSource } from "@/lib/cbt";
import crypto from "node:crypto";
import { isUuid, serverError } from "@/lib/http";
import { saveFailed } from "@/lib/adminHttp";
import { limitRequest } from "@/lib/rateLimit";
import { safeFileName, validateUpload } from "@/lib/uploadSafety";
import { logAdminAction } from "@/lib/audit";

const MAX_PDF_BYTES = 25 * 1024 * 1024;

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const limited = limitRequest(request, "admin-upload", { limit: 60, userId: admin.id }); if (limited) return limited;
  let form;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "The upload could not be read." }, { status: 400 }); }
  const questionPdf = form.get("questionPdf");
  const answerKeyPdf = form.get("answerKeyPdf");
  const paperId = String(form.get("paperId") || "") || null;
  if (paperId && !isUuid(paperId)) return NextResponse.json({ error: "Paper is invalid." }, { status: 400 });
  const queue = form.get("queue") === "true";
  if (!questionPdf || typeof questionPdf.arrayBuffer !== "function") {
    return NextResponse.json({ error: "A question PDF is required." }, { status: 400 });
  }
  if (answerKeyPdf && typeof answerKeyPdf.arrayBuffer !== "function") {
    return NextResponse.json({ error: "Answer key must be a PDF." }, { status: 400 });
  }
  if (questionPdf.size > MAX_PDF_BYTES || (answerKeyPdf && answerKeyPdf.size > MAX_PDF_BYTES)) return NextResponse.json({ error: "Each PDF must be 25 MB or smaller." }, { status: 413 });
  const questionBuffer = Buffer.from(await questionPdf.arrayBuffer());
  const answerBuffer = answerKeyPdf ? Buffer.from(await answerKeyPdf.arrayBuffer()) : null;
  const questionProblem = validateUpload(questionBuffer, "application/pdf", ["application/pdf"], MAX_PDF_BYTES);
  if (questionProblem) return NextResponse.json({ error: `Question PDF: ${questionProblem}` }, { status: 400 });
  const answerProblem = answerBuffer ? validateUpload(answerBuffer, "application/pdf", ["application/pdf"], MAX_PDF_BYTES) : null;
  if (answerProblem) return NextResponse.json({ error: `Answer key PDF: ${answerProblem}` }, { status: 400 });
  const questionName = safeFileName(questionPdf.name, "question.pdf");
  const answerName = answerKeyPdf ? safeFileName(answerKeyPdf.name, "answer-key.pdf") : null;
  const id = crypto.randomUUID();
  const batchId = String(form.get("batchId") || "").slice(0, 100) || null;
  const base = `${admin.id}/${id}`;
  try {
    const questionHash = sha256(questionBuffer);
    const { data: duplicate } = await getPrepTable("prep_cbt_imports").select("id,status,question_pdf_name").eq("question_sha256", questionHash).maybeSingle();
    if (duplicate) return NextResponse.json({ error: `Duplicate question PDF already imported as ${duplicate.question_pdf_name}.`, duplicate: { id: duplicate.id, status: duplicate.status } }, { status: 409 });
    await uploadSource(`${base}/question.pdf`, questionBuffer);
    if (answerBuffer) await uploadSource(`${base}/answer-key.pdf`, answerBuffer);
    if (queue) {
      const { data, error } = await getPrepTable("prep_cbt_imports").insert({
        id, batch_id: batchId, paper_id: paperId, created_by: admin.id, status: "QUEUED",
        question_pdf_name: questionName, answer_key_pdf_name: answerName,
        question_pdf_path: `${base}/question.pdf`, answer_key_pdf_path: answerBuffer ? `${base}/answer-key.pdf` : null,
        question_sha256: questionHash, answer_key_sha256: answerBuffer ? sha256(answerBuffer) : null,
        metadata: { processingStage: "QUEUED", manualReviewRequired: true }
      }).select("id,paper_id,status,question_pdf_name,answer_key_pdf_name,metadata,questions,error_message,created_at").single();
      if (error) throw error;
      await logAdminAction(admin, "cbt_import.upload", { targetType: "prep_cbt_imports", targetId: id, metadata: { questionPdf: questionName, hasAnswerKey: Boolean(answerBuffer), paperId }, request });
      return NextResponse.json({ import: data }, { status: 201 });
    }
    return NextResponse.json({ error: "Legacy single-file processing is no longer supported. Queue the job first." }, { status: 400 });
  } catch (error) {
    return saveFailed(error, "admin cbt upload");
  }
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { data, error } = await getPrepTable("prep_cbt_imports").select("id,paper_id,status,question_pdf_name,answer_key_pdf_name,metadata,questions,error_message,created_at").order("created_at", { ascending: false }).limit(50);
  if (error) return serverError(error, "admin cbt list");
  return NextResponse.json({ imports: data || [] });
}
