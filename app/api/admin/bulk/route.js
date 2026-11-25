import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";
import { isUuid, readJson, tooLarge } from "@/lib/http";
import { logAdminAction } from "@/lib/audit";

const MAX_ROWS = 100;
const MAX_URL = 2000;
const MAX_SHIFT = 100;

function isUrl(value) {
  return typeof value === "string" && value.length <= MAX_URL && /^https?:\/\/\S+$/i.test(value);
}

export async function POST(request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await readJson(request, 512 * 1024);
  if (!body) return tooLarge();
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!isUuid(body.examId) || !isUuid(body.branchId) || !rows.length) {
    return NextResponse.json({ error: "Exam, branch and at least one paper are required" }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) return NextResponse.json({ error: `Add at most ${MAX_ROWS} papers at a time.` }, { status: 400 });

  const papers = [];
  for (const [index, row] of rows.entries()) {
    const [year, shift = "", officialPaperUrl = "", officialSolutionUrl = ""] = (typeof row === "string" ? row.slice(0, 5000) : "").split("|").map((value) => value.trim());
    if (!/^\d{4}$/.test(year) || !shift || shift.length > MAX_SHIFT || !isUrl(officialPaperUrl) || (officialSolutionUrl && !isUrl(officialSolutionUrl))) {
      return NextResponse.json({ error: `Invalid format on line ${index + 1}. Use: year | shift | paper URL | solution URL` }, { status: 400 });
    }
    papers.push({
      exam_id: body.examId,
      branch_id: body.branchId,
      year: Number(year),
      shift,
      title: `GATE CSE ${year} ${shift}`,
      question_count: 65,
      official_paper_url: officialPaperUrl,
      official_solution_url: officialSolutionUrl || null,
      is_published: true
    });
  }

  try {
    const saved = [];
    for (const paper of papers) {
      const { data: existing, error: findError } = await getPrepTable("prep_papers")
        .select("id")
        .eq("exam_id", paper.exam_id)
        .eq("branch_id", paper.branch_id)
        .eq("year", paper.year)
        .eq("shift", paper.shift)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (findError) throw findError;
      const query = existing
        ? getPrepTable("prep_papers").update(paper).eq("id", existing.id)
        : getPrepTable("prep_papers").insert(paper);
      const { data, error } = await query.select("id,year,shift,title,official_paper_url").single();
      if (error) throw error;
      saved.push(data);
    }
    await logAdminAction(admin, "content.bulk_import", { targetType: "prep_papers", targetId: body.branchId, metadata: { examId: body.examId, branchId: body.branchId, count: saved.length }, request });
    return NextResponse.json({ saved }, { status: 201 });
  } catch (error) {
    console.error("[admin bulk]", error?.message || error);
    return NextResponse.json({ error: "Could not save. Check the values and try again." }, { status: 400 });
  }
}
