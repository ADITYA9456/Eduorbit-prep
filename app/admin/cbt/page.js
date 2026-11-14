import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";
import { redirect } from "next/navigation";
import CbtConverter from "@/components/CbtConverter";

export const dynamic = "force-dynamic";

export default async function CbtPage() {
  if (!await requireAdmin()) redirect("/admin-login");
  const [{ data: papers }, { data: imports }] = await Promise.all([
    getPrepTable("prep_papers").select("id,title,year,shift,created_at,branch_id,prep_branches(name,slug),prep_exams(name)").eq("is_published", true).order("year", { ascending: false }).order("shift").order("created_at", { ascending: true }),
    getPrepTable("prep_cbt_imports").select("id,paper_id,status,question_pdf_name,answer_key_pdf_name,metadata,questions,error_message,created_at").order("created_at", { ascending: false }).limit(100)
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
  return <section className="shell py-12 sm:py-16"><nav aria-label="Breadcrumb" className="crumbs"><Link href="/admin">Admin</Link><span aria-hidden="true" className="sep">/</span><span aria-current="page" className="text-foreground">PDF to CBT converter</span></nav><h1 className="page-title mt-8">PDF to CBT converter</h1><p className="lede mt-3">Upload the question paper and official answer key. Processing creates an isolated draft linked to the selected existing paper; it never changes the original paper record or links.</p><CbtConverter papers={uniquePapers} initialImports={imports || []} /></section>;
}
