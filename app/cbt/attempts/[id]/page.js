import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCbtSetForReview, getUserAttempt } from "@/lib/cbtSets";
import { evaluateSet, formatDuration, formatMarks } from "@/lib/cbtSetShared";
import CbtReview from "@/components/cbt/CbtReview";

export const dynamic = "force-dynamic";

export default async function CbtAttemptPage({ params }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const attempt = await getUserAttempt(user.id, id);
  if (!attempt) notFound();
  const set = await getCbtSetForReview(attempt.setId);
  if (!set) notFound();
  const summary = evaluateSet(set.questions, attempt.answers);
  const date = new Date(attempt.completedAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
  return <section className="shell pb-16 pt-8 sm:pt-10">
    <nav aria-label="Breadcrumb" className="crumbs"><Link href="/cbt/attempts">CBT attempts</Link><span aria-hidden="true" className="sep">/</span><span aria-current="page" className="truncate text-foreground">{set.title}</span></nav>
    <h1 className="mt-6 text-xl font-medium tracking-tight sm:text-2xl">{set.title}</h1>
    <p className="mt-1.5 flex flex-wrap gap-1.5"><span className="badge">{attempt.mode === "EXAM" ? "Exam mode" : "Study mode"}</span>{set.year ? <span className="badge tabular">{set.year}</span> : null}<span className="text-sm text-slate-400">{date}</span></p>
    <div className="panel mt-8 overflow-hidden">
      <div className="grid gap-8 p-6 sm:grid-cols-[auto_1fr] sm:items-end sm:p-8">
        <div><p className="eyebrow">Score</p><p className="mt-2 flex items-baseline gap-2"><span className="tabular text-6xl font-medium tracking-tight">{formatMarks(summary.score)}</span><span className="tabular text-2xl text-slate-400">/ {formatMarks(summary.maxScore)} marks</span></p></div>
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-[12px] border border-line bg-line text-sm">
          <div className="bg-panel p-3"><dt className="text-slate-400">Correct</dt><dd className="tabular mt-1 text-lg font-medium text-[color:var(--ok-fg)]">{summary.correct}</dd></div>
          <div className="bg-panel p-3"><dt className="text-slate-400">Wrong</dt><dd className="tabular mt-1 text-lg font-medium text-[color:var(--bad-fg)]">{summary.wrong}</dd></div>
          <div className="bg-panel p-3"><dt className="text-slate-400">Skipped</dt><dd className="tabular mt-1 text-lg font-medium">{summary.skipped}</dd></div>
        </dl>
      </div>
      <div aria-hidden="true" className="h-1 overflow-hidden bg-line"><div className="h-full w-full origin-left bg-electric" style={{ transform: `scaleX(${summary.percent / 100})` }} /></div>
      <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <p className="text-sm text-slate-400"><span className="tabular">{summary.percent}%</span>{attempt.durationSeconds !== null ? <> in <span className="tabular">{formatDuration(attempt.durationSeconds)}</span></> : null}. <span className="tabular">{summary.attempted} of {set.questions.length}</span> attempted.{attempt.violations ? <span className="text-[color:var(--warn-fg)]"> Left the tab {attempt.violations} {attempt.violations === 1 ? "time" : "times"}.</span> : null}</p>
        <div className="flex flex-wrap gap-3"><Link className="button-primary" href={`/cbt/${set.id}`}>Retake this set</Link><Link className="button-ghost" href="/cbt/attempts">All attempts</Link></div>
      </div>
    </div>
    <CbtReview answers={attempt.answers} questions={set.questions} results={summary.perQuestion} />
  </section>;
}
