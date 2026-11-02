import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";
import { processStoredImport } from "@/lib/cbt";

export async function PATCH(request, { params }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await request.json();
  if (!Array.isArray(body.questions)) return NextResponse.json({ error: "Questions are required." }, { status: 400 });
  const updates = {
    questions: body.questions,
    metadata: body.metadata || {},
    updated_at: new Date().toISOString()
  };
  if (body.paperId) {
    updates.paper_id = body.paperId;
    updates.status = "REVIEW";
  }
  const { data, error } = await getPrepTable("prep_cbt_imports").update(updates).eq("id", params.id).select("id,status,paper_id,metadata,questions,error_message").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ import: data });
}

export async function POST(request, { params }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { data: item, error: loadError } = await getPrepTable("prep_cbt_imports").select("id,paper_id,questions,metadata,status").eq("id", params.id).maybeSingle();
  if (loadError || !item) return NextResponse.json({ error: loadError?.message || "Import not found." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  if (body.action === "process") {
    await getPrepTable("prep_cbt_imports").update({ status: "PROCESSING", error_message: null, metadata: { ...(item.metadata || {}), processingStage: "PROCESSING" }, updated_at: new Date().toISOString() }).eq("id", params.id);
    try {
      const result = await processStoredImport(params.id);
      return NextResponse.json(result);
    } catch (error) {
      const { data } = await getPrepTable("prep_cbt_imports").update({
        status: "FAILED",
        error_message: error.message || "Processing failed.",
        metadata: { ...(item.metadata || {}), processingStage: "PROCESSING_FAILED", manualReviewRequired: true },
        updated_at: new Date().toISOString()
      }).eq("id", params.id).select("id,status,metadata,error_message").single();
      return NextResponse.json({ import: data, error: data?.error_message }, { status: 200 });
    }
  }
  if (body.action === "retry") {
    const { data } = await getPrepTable("prep_cbt_imports").update({ status: "QUEUED", error_message: null, updated_at: new Date().toISOString() }).eq("id", params.id).select("id,status,metadata,questions,error_message").single();
    return NextResponse.json({ import: data });
  }
  if (body.paperId) {
    const { data, error } = await getPrepTable("prep_cbt_imports").update({ paper_id: body.paperId, status: "QUEUED", error_message: null, updated_at: new Date().toISOString() }).eq("id", params.id).select("id,status,paper_id,metadata,questions,error_message").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ import: data });
  }
  const incomplete = (item.questions || []).filter((question) => question.verificationStatus !== "VERIFIED" || !question.answer);
  if (!item.paper_id) return NextResponse.json({ error: "Pair this import with an existing paper before publishing." }, { status: 400 });
  if (!item.questions?.length || incomplete.length) {
    return NextResponse.json({ error: `${incomplete.length || "All"} question(s) must be verified and have an official answer before publishing.` }, { status: 400 });
  }
  const { data, error } = await getPrepTable("prep_cbt_imports").update({ status: "PUBLISHED", updated_at: new Date().toISOString() }).eq("id", params.id).select("id,status").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ import: data });
}
