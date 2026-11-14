import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getBranch, getExam } from "@/lib/data";
import { branchIsSelected, getSelectedBranches } from "@/lib/preparation";
import { listPublishedCbtSets } from "@/lib/cbtSets";

export default async function CbtListingPage({ params }) {
  const { exam: examSlug, branch: branchSlug } = await params;
  const exam = await getExam(examSlug); if (!exam) notFound();
  const branch = await getBranch(exam.id, branchSlug); if (!branch) notFound();
  const user = await getCurrentUser(); const selected = user ? await getSelectedBranches(user.id) : [];
  if (user && !branchIsSelected(branch.id, selected)) redirect("/exams");
  const sets = await listPublishedCbtSets(branch.id);
  return <section className="shell py-12 sm:py-16"><nav aria-label="Breadcrumb" className="crumbs"><Link href={`/exams/${exam.slug}`}>{exam.name}</Link><span aria-hidden="true" className="sep">/</span><Link href={`/exams/${exam.slug}/${branch.slug}`}>{branch.name}</Link><span aria-hidden="true" className="sep">/</span><span aria-current="page" className="text-foreground">CBT sets</span></nav><header className="mt-8 max-w-2xl"><h1 className="page-title">CBT sets</h1><p className="lede mt-4">Answer one question at a time and see straight away whether you were right.</p></header><div className="mt-10">{sets.length ? <div className="rows">{sets.map((set) => <Link className="row group" href={`/cbt/${set.id}`} key={set.id}><div className="min-w-0"><p className="truncate font-medium">{set.title}</p><p className="mt-1 flex flex-wrap gap-1.5 text-sm text-slate-400">{set.year ? <span className="badge tabular">{set.year}</span> : null}{set.subjectName ? <span className="badge">{set.subjectName}</span> : null}<span className="badge tabular">{set.questionCount} questions</span></p></div><span className="row-action">Start test</span></Link>)}</div> : <div className="empty-state max-w-xl"><p className="font-medium">No CBT sets published yet</p><p className="mt-1 text-sm text-slate-400">Previous-year papers for this branch are ready while sets are added.</p><Link className="button-secondary mt-5" href={`/exams/${exam.slug}/${branch.slug}`}>Browse papers</Link></div>}</div></section>;
}
