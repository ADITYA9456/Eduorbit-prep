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
  return <section className="mx-auto max-w-6xl px-6 py-12 sm:py-16"><Link className="text-sm text-slate-500 hover:text-electric" href={`/exams/${exam.slug}/${branch.slug}`}>← {branch.name}</Link><div className="mt-10"><p className="eyebrow">{exam.name} / {branch.name}</p><h1 className="mt-4 text-4xl font-bold tracking-tight">CBT sets.</h1><p className="mt-4 text-slate-400">Answer one question at a time and see right away whether you were correct.</p></div><div className="mt-10 grid gap-4 md:grid-cols-2">{sets.length ? sets.map((set) => <div className="card p-6" key={set.id}><p className="text-xs uppercase tracking-[.2em] text-electric">{[set.year, set.subjectName].filter(Boolean).join(" · ") || "CBT set"}</p><h2 className="mt-3 text-xl font-semibold">{set.title}</h2><p className="mt-2 text-sm text-slate-500">{set.questionCount} questions</p><Link className="button-primary mt-6" href={`/cbt/${set.id}`}>Start</Link></div>) : <div className="card p-8 text-slate-400">No CBT sets are published for this branch yet.</div>}</div></section>;
}
