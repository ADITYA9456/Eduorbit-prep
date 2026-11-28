import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getExam, getBranch } from "@/lib/data";
import { getSelectedBranches, branchIsSelected } from "@/lib/preparation";
import { listPracticeTests } from "@/lib/practice";
import SetFilterList from "@/components/SetFilterList";

export default async function PracticeListingPage({ params }) {
  const { exam: examSlug, branch: branchSlug } = await params;
  const exam = await getExam(examSlug); if (!exam) notFound();
  const branch = await getBranch(exam.id, branchSlug); if (!branch) notFound();
  const user = await getCurrentUser(); const selected = user ? await getSelectedBranches(user.id) : [];
  if (user && !branchIsSelected(branch.id, selected)) redirect("/exams");
  const tests = await listPracticeTests(branch.id);
  return <section className="shell py-12 sm:py-16"><nav aria-label="Breadcrumb" className="crumbs"><Link href={`/exams/${exam.slug}`}>{exam.name}</Link><span aria-hidden="true" className="sep">/</span><Link href={`/exams/${exam.slug}/${branch.slug}`}>{branch.name}</Link><span aria-hidden="true" className="sep">/</span><span aria-current="page" className="text-foreground">Practice tests</span></nav><header className="mt-8 max-w-2xl"><h1 className="page-title">Practice tests</h1><p className="lede mt-4">Every published subject and full-length test for this branch.</p></header><div className="mt-10">{tests.length ? <SetFilterList items={tests.map((test) => ({ id: test.id, href: `/practice/${test.id}`, title: test.title, subjectName: test.subjectName || null, kindLabel: test.testType === "FULL_LENGTH" ? "Full length" : "Subject test", questionCount: test.questionCount }))} noun="practice test" /> : <div className="empty-state max-w-xl"><p className="font-medium">No practice tests published yet</p><p className="mt-1 text-sm text-slate-400">Previous-year papers for this branch are ready while tests are added.</p><Link className="button-secondary mt-5" href={`/exams/${exam.slug}/${branch.slug}`}>Browse papers</Link></div>}</div></section>;
}
