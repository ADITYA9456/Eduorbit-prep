import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listUserAttempts } from "@/lib/cbtSets";
import { formatDuration, formatMarks } from "@/lib/cbtSetShared";

export const dynamic = "force-dynamic";

export const metadata = { title: "My CBT attempts" };

function when(value) {
  return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function CbtAttemptsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const attempts = await listUserAttempts(user.id);
  return <section className="shell py-12 sm:py-16">
    <nav aria-label="Breadcrumb" className="crumbs"><Link href="/dashboard">Dashboard</Link><span aria-hidden="true" className="sep">/</span><span aria-current="page" className="text-foreground">CBT attempts</span></nav>
    <header className="mt-8 max-w-2xl"><h1 className="page-title">My CBT attempts</h1><p className="lede mt-4">Every finished test you took while signed in. Open one to review each question and the correct answer.</p></header>
    <div className="mt-10">{attempts.length ? <div className="rows">{attempts.map((attempt) => {
      const hasMarks = attempt.score !== null && attempt.maxScore;
      const percent = hasMarks ? Math.max(0, Math.round((attempt.score / attempt.maxScore) * 100)) : attempt.total ? Math.round((attempt.correct / attempt.total) * 100) : 0;
      return <Link className="row group" href={`/cbt/attempts/${attempt.id}`} key={attempt.id}>
        <div className="min-w-0">
          <p className="truncate font-medium">{attempt.setTitle}</p>
          <p className="mt-1 flex flex-wrap gap-1.5 text-sm text-slate-400">
            <span className="badge">{attempt.mode === "EXAM" ? "Exam mode" : "Study mode"}</span>
            <span className="badge tabular">{hasMarks ? `${formatMarks(attempt.score)} / ${formatMarks(attempt.maxScore)} marks` : `${attempt.correct} / ${attempt.total} correct`} ({percent}%)</span>
            {attempt.durationSeconds !== null ? <span className="badge tabular">{formatDuration(attempt.durationSeconds)}</span> : null}
            {attempt.violations ? <span className="badge badge-danger">{attempt.violations} tab {attempt.violations === 1 ? "switch" : "switches"}</span> : null}
            <span>{when(attempt.completedAt)}</span>
          </p>
        </div>
        <span className="row-action">Review</span>
      </Link>;
    })}</div> : <div className="empty-state max-w-xl"><p className="font-medium">No attempts yet</p><p className="mt-1 text-sm text-slate-400">Finish a CBT set while signed in and it will show up here.</p><Link className="button-secondary mt-5" href="/dashboard">Back to dashboard</Link></div>}</div>
  </section>;
}
