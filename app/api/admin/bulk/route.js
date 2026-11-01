import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";

function isUrl(value) {
  return /^https?:\/\/\S+$/i.test(value);
}

export async function POST(request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await request.json();
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!body.examId || !body.branchId || !rows.length) {
    return NextResponse.json({ error: "Exam, branch and at least one paper are required" }, { status: 400 });
  }

  const papers = rows.map((row, index) => {
    const [year, shift, officialPaperUrl, officialSolutionUrl = ""] = String(row).split("|").map((value) => value.trim());
    if (!/^\d{4}$/.test(year) || !shift || !isUrl(officialPaperUrl) || (officialSolutionUrl && !isUrl(officialSolutionUrl))) {
      throw new Error(`Invalid format on line ${index + 1}. Use: year | shift | paper URL | solution URL`);
    }
    return {
      exam_id: body.examId,
      branch_id: body.branchId,
      year: Number(year),
      shift,
      title: `GATE CSE ${year} ${shift}`,
      question_count: 65,
      official_paper_url: officialPaperUrl,
      official_solution_url: officialSolutionUrl || null,
      is_published: true
    };
  });

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
    return NextResponse.json({ saved }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
