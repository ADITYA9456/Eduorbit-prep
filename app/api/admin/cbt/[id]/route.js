import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";
import { processStoredImport } from "@/lib/cbt";
import { isUuid, readJson, serverError, tooLarge } from "@/lib/http";
import { saveFailed } from "@/lib/adminHttp";
import { logAdminAction } from "@/lib/audit";

const IMPORT_FIELDS = "id,status,paper_id,metadata,questions,error_message";

export async function PATCH(request, { params }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid import id." }, { status: 400 });
  const body = await readJson(request, 4 * 1024 * 1024);
  if (!body) return tooLarge();
  if (!Array.isArray(body.questions) || body.questions.length > 500) return NextResponse.json({ error: "Questions are required." }, { status: 400 });
  if (body.paperId && !isUuid(body.paperId)) return NextResponse.json({ error: "Paper is invalid." }, { status: 400 });
  const updates = {
    questions: body.questions,
    metadata: body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {},
    updated_at: new Date().toISOString()
  };
  if (body.paperId) {
    updates.paper_id = body.paperId;
    updates.status = "REVIEW";
  }
  const { data, error } = await getPrepTable("prep_cbt_imports").update(updates).eq("id", id).select(IMPORT_FIELDS).single();
  if (error) return saveFailed(error, "admin cbt review save");
  await logAdminAction(admin, "cbt_import.review_save", { targetType: "prep_cbt_imports", targetId: id, metadata: { questionCount: body.questions.length, paperId: body.paperId || null }, request });
  return NextResponse.json({ import: data });
}

export async function POST(request, { params }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid import id." }, { status: 400 });
  const { data: item, error: loadError } = await getPrepTable("prep_cbt_imports").select("id,paper_id,questions,metadata,status").eq("id", id).maybeSingle();
  if (loadError) return serverError(loadError, "admin cbt load");
  if (!item) return NextResponse.json({ error: "Import not found." }, { status: 404 });
  const body = (await readJson(request, 64 * 1024)) || {};
  if (body.paperId && !isUuid(body.paperId)) return NextResponse.json({ error: "Paper is invalid." }, { status: 400 });
  if (body.action === "process") {
    await getPrepTable("prep_cbt_imports").update({ status: "PROCESSING", error_message: null, metadata: { ...(item.metadata || {}), processingStage: "PROCESSING" }, updated_at: new Date().toISOString() }).eq("id", id);
    try {
      const result = await processStoredImport(id);
      await logAdminAction(admin, "cbt_import.process", { targetType: "prep_cbt_imports", targetId: id, request });
      return NextResponse.json(result);
    } catch (error) {
      console.error("[admin cbt process]", error?.message || error);
      const { data } = await getPrepTable("prep_cbt_imports").update({
        status: "FAILED",
        error_message: "Processing failed. Retry, or review the file manually.",
        metadata: { ...(item.metadata || {}), processingStage: "PROCESSING_FAILED", manualReviewRequired: true },
        updated_at: new Date().toISOString()
      }).eq("id", id).select("id,status,metadata,error_message").single();
      return NextResponse.json({ import: data, error: data?.error_message }, { status: 200 });
    }
  }
  if (body.action === "retry") {
    const { data } = await getPrepTable("prep_cbt_imports").update({ status: "QUEUED", error_message: null, updated_at: new Date().toISOString() }).eq("id", id).select("id,status,metadata,questions,error_message").single();
    await logAdminAction(admin, "cbt_import.retry", { targetType: "prep_cbt_imports", targetId: id, request });
    return NextResponse.json({ import: data });
  }
  if (body.paperId) {
    const { data, error } = await getPrepTable("prep_cbt_imports").update({ paper_id: body.paperId, status: "QUEUED", error_message: null, updated_at: new Date().toISOString() }).eq("id", id).select(IMPORT_FIELDS).single();
    if (error) return saveFailed(error, "admin cbt pair");
    await logAdminAction(admin, "cbt_import.pair", { targetType: "prep_cbt_imports", targetId: id, metadata: { paperId: body.paperId }, request });
    return NextResponse.json({ import: data });
  }
  const incomplete = (item.questions || []).filter((question) => question.verificationStatus !== "VERIFIED" || !question.answer);
  if (!item.paper_id) return NextResponse.json({ error: "Pair this import with an existing paper before publishing." }, { status: 400 });
  if (!item.questions?.length || incomplete.length) {
    return NextResponse.json({ error: `${incomplete.length || "All"} question(s) must be verified and have an official answer before publishing.` }, { status: 400 });
  }
  const { data, error } = await getPrepTable("prep_cbt_imports").update({ status: "PUBLISHED", updated_at: new Date().toISOString() }).eq("id", id).select("id,status").single();
  if (error) return saveFailed(error, "admin cbt publish");
  await logAdminAction(admin, "cbt_import.publish", { targetType: "prep_cbt_imports", targetId: id, metadata: { paperId: item.paper_id }, request });
  return NextResponse.json({ import: data });
}
