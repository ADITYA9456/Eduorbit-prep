import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";
function validUrl(value) { return !value || /^https?:\/\/\S+$/i.test(value); }
export async function POST(request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await request.json();
  if (!["exam", "branch", "paper"].includes(body.type)) return NextResponse.json({ error: "Unsupported content type" }, { status: 400 });
  if ([body.officialPaperUrl, body.officialSolutionUrl, body.externalPdfUrl].some((url) => !validUrl(url))) return NextResponse.json({ error: "URLs must use http or https" }, { status: 400 });
  const table = { exam: "prep_exams", branch: "prep_branches", paper: "prep_papers" }[body.type];
  const mapping = { isActive: "is_active", isPublished: "is_published", examId: "exam_id", branchId: "branch_id", questionCount: "question_count", officialPaperUrl: "official_paper_url", officialSolutionUrl: "official_solution_url", externalPdfUrl: "external_pdf_url" };
  const data = Object.fromEntries(Object.entries(body).filter(([key]) => key !== "type").map(([key, value]) => [mapping[key] || key, value]));
  const query = body.type === "paper"
    ? getPrepTable(table).select("id").eq("exam_id", data.exam_id).eq("branch_id", data.branch_id).eq("year", data.year).eq("shift", data.shift).order("created_at", { ascending: true }).limit(1).maybeSingle()
    : null;
  const { data: existing, error: findError } = query ? await query : { data: null, error: null };
  if (findError) return NextResponse.json({ error: findError.message }, { status: 400 });
  const branchQuery = body.type === "branch"
    ? getPrepTable(table).select("id").eq("exam_id", data.exam_id).eq("slug", data.slug).limit(1).maybeSingle()
    : null;
  const { data: existingBranch, error: branchFindError } = branchQuery ? await branchQuery : { data: null, error: null };
  if (branchFindError) return NextResponse.json({ error: branchFindError.message }, { status: 400 });
  const saveQuery = existing || existingBranch
    ? getPrepTable(table).update(data).eq("id", (existing || existingBranch).id)
    : getPrepTable(table).insert(data);
  const { data: document, error } = await saveQuery.select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ document }, { status: 201 });
}
