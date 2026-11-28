import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getBranch, getExam } from "@/lib/data";
import { branchIsSelected, getSelectedBranches } from "@/lib/preparation";
import { listPublishedCbtSets } from "@/lib/cbtSets";
import SetFilterList from "@/components/SetFilterList";

export default async function CbtListingPage({ params }) {
  const { exam: examSlug, branch: branchSlug } = await params;
  const exam = await getExam(examSlug); if (!exam) notFound();
  const branch = await getBranch(exam.id, branchSlug); if (!branch) notFound();
  const user = await getCurrentUser(); const selected = user ? await getSelectedBranches(user.id) : [];
  if (user && !branchIsSelected(branch.id, selected)) redirect("/exams");
  const sets = await listPublishedCbtSets(branch.id);
  return <section className="shell py-12 sm:py-16"><nav aria-label="Breadcrumb" className="crumbs"><Link href={`/exams/${exam.slug}`}>{exam.name}</Link><span aria-hidden="true" className="sep">/</span><Link href={`/exams/${exam.slug}/${branch.slug}`}>{branch.name}</Link><span aria-hidden="true" className="sep">/</span><span aria-current="page" className="text-foreground">CBT sets</span></nav><header className="mt-8 max-w-2xl"><h1 className="page-title">CBT sets</h1><p className="lede mt-4">Practise in study mode with instant feedback, or take a timed exam and review every answer afterwards.</p></header><div className="mt-10">{sets.length ? <SetFilterList items={sets.map((set) => ({ id: set.id, href: `/cbt/${set.id}`, title: set.title, year: set.year, subjectName: set.subjectName, questionCount: set.questionCount }))} noun="CBT set" /> : <div className="empty-state max-w-xl"><p className="font-medium">No CBT sets published yet</p><p className="mt-1 text-sm text-slate-400">Previous-year papers for this branch are ready while sets are added.</p><Link className="button-secondary mt-5" href={`/exams/${exam.slug}/${branch.slug}`}>Browse papers</Link></div>}</div></section>;
}
