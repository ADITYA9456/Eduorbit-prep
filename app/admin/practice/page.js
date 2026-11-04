import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";
import { signedImages } from "@/lib/practice";
import PracticeForm from "@/components/PracticeForm";
import PracticeReview from "@/components/PracticeReview";

export const dynamic = "force-dynamic";
export default async function AdminPracticePage() {
  if (!await requireAdmin()) redirect("/admin-login");
  const [{ data: branches }, { data: subjects }, { data: tests }] = await Promise.all([
    getPrepTable("prep_branches").select("id,name").eq("is_active", true).order("name"),
    getPrepTable("prep_branch_subjects").select("branch_id,prep_subjects(id,name)").order("branch_id"),
    getPrepTable("prep_practice_tests").select("id,title,status,questions,metadata").order("created_at", { ascending: false }).limit(50)
  ]);
  const mappedSubjects = (subjects || []).map((item) => ({ branch_id: item.branch_id, ...(item.prep_subjects || {}) })).filter((item) => item.id);
  const hydratedTests = await Promise.all((tests || []).map(async (test) => ({ ...test, questions: await Promise.all((test.questions || []).map(async (question) => ({ ...question, images: await signedImages(question.images) }))) })));
  return <section className="mx-auto max-w-6xl px-6 py-12 sm:py-16"><p className="eyebrow">Content operations</p><h1 className="mt-4 text-4xl font-bold tracking-tight">Create Practice test.</h1><p className="mt-4 max-w-2xl leading-7 text-slate-400">Titles and counters are allocated atomically per branch. Review deterministic extraction before publishing.</p><div className="mt-10"><PracticeForm branches={branches || []} subjects={mappedSubjects} /></div><PracticeReview initialTests={hydratedTests} /></section>;
}
