import { requireAdmin } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";
import { redirect } from "next/navigation";
import CbtConverter from "@/components/CbtConverter";

export const dynamic = "force-dynamic";

export default async function CbtPage() {
  if (!await requireAdmin()) redirect("/admin-login");
  const [{ data: papers }, { data: imports }] = await Promise.all([
    getPrepTable("prep_papers").select("id,title,year,shift,created_at,branch_id,prep_branches(name,slug),prep_exams(name)").eq("is_published", true).order("year", { ascending: false }).order("shift").order("created_at", { ascending: true }),
    getPrepTable("prep_cbt_imports").select("id,paper_id,status,question_pdf_name,answer_key_pdf_name,metadata,questions,error_message,created_at").order("created_at", { ascending: false }).limit(50)
  ]);
  const uniquePapers = [];
  const seen = new Set();
  for (const paper of papers || []) {
    const key = `${paper.branch_id}:${paper.year}:${String(paper.shift).trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniquePapers.push({
      id: paper.id,
      title: paper.title,
      year: paper.year,
      shift: paper.shift,
      branchName: paper.prep_branches?.name || "Unknown branch",
      examName: paper.prep_exams?.name || "Unknown exam"
    });
  }
  return <section className="mx-auto max-w-6xl px-6 py-12 sm:py-16"><p className="eyebrow">Content operations</p><h1 className="mt-4 text-4xl font-bold tracking-tight">PDF to CBT Converter</h1><p className="mt-4 max-w-3xl leading-7 text-slate-400">Upload the question paper and official answer key. Processing creates an isolated draft linked to the selected existing paper; it never changes the original paper record or links.</p><CbtConverter papers={uniquePapers} initialImports={imports || []} /></section>;
}
