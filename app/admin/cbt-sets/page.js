import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";
import CbtSetBuilderLoader from "@/components/cbt/CbtSetBuilderLoader";

export const dynamic = "force-dynamic";

export default async function CbtSetsAdminPage() {
  if (!await requireAdmin()) redirect("/admin-login");
  const [{ data: exams }, { data: branches }, { data: subjects }, { data: sets }] = await Promise.all([
    getPrepTable("prep_exams").select("id,name").eq("is_active", true).order("name"),
    getPrepTable("prep_branches").select("id,name,exam_id").eq("is_active", true).order("name"),
    getPrepTable("prep_branch_subjects").select("branch_id,prep_subjects(id,name)"),
    getPrepTable("cbt_sets").select("id,title,year,is_published,created_at,cbt_questions(count)").order("created_at", { ascending: false }).limit(50)
  ]);
  const mappedSubjects = (subjects || []).map((item) => ({ branch_id: item.branch_id, ...(item.prep_subjects || {}) })).filter((item) => item.id).sort((a, b) => a.name.localeCompare(b.name));
  return <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16"><p className="eyebrow">Content operations</p><h1 className="mt-4 text-4xl font-bold tracking-tight">CBT test builder</h1><p className="mt-4 max-w-3xl leading-7 text-slate-400">Upload question images, review the extracted questions, add an answer key, then save the set. This is separate from PYQ papers and the PDF to CBT converter.</p><CbtSetBuilderLoader branches={branches || []} exams={exams || []} initialSets={sets || []} subjects={mappedSubjects} /></section>;
}
