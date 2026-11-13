import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getExam, getBranch } from "@/lib/data";
import { getSelectedBranches, branchIsSelected } from "@/lib/preparation";
import { listPracticeTests } from "@/lib/practice";

export default async function PracticeListingPage({ params }) {
  const { exam: examSlug, branch: branchSlug } = await params;
  const exam = await getExam(examSlug); if (!exam) notFound();
  const branch = await getBranch(exam.id, branchSlug); if (!branch) notFound();
  const user = await getCurrentUser(); const selected = user ? await getSelectedBranches(user.id) : [];
  if (user && !branchIsSelected(branch.id, selected)) redirect("/exams");
  const tests = await listPracticeTests(branch.id);
  return <section className="mx-auto max-w-6xl px-6 py-12 sm:py-16"><Link className="text-sm text-slate-500 hover:text-electric" href={`/exams/${exam.slug}/${branch.slug}`}>← {branch.name}</Link><div className="mt-10"><p className="eyebrow">{exam.name} / {branch.name}</p><h1 className="mt-4 text-4xl font-bold tracking-tight">Practice tests.</h1><p className="mt-4 text-slate-400">All published tests for this branch, in one focused listing.</p></div><div className="mt-10 grid gap-4 md:grid-cols-2">{tests.length ? tests.map((test) => <div className="card p-6" key={test.id}><p className="text-xs uppercase tracking-[.2em] text-electric">{test.testType === "FULL_LENGTH" ? "Full Length Test" : "Subject Test"}</p><h2 className="mt-3 text-xl font-semibold">{test.title}</h2><p className="mt-2 text-sm text-slate-500">{test.subjectName ? `${test.subjectName} · ` : ""}{test.questionCount} questions</p><Link className="button-primary mt-6" href={`/practice/${test.id}`}>Start test</Link></div>) : <div className="card p-8 text-slate-400">No published Practice tests are available for this branch yet.</div>}</div></section>;
}
