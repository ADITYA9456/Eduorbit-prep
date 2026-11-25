import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import CountdownCard from "@/components/CountdownCard";
import BranchLogo from "@/components/BranchLogo";
import { branchCode, preparationLabel } from "@/lib/preparation";
import { getPrepTable } from "@/lib/supabase";
import DashboardControls from "@/components/DashboardControls";
import { listUserAttempts } from "@/lib/cbtSets";
import AccountDataControls from "@/components/AccountDataControls";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [{ data: completed }, { data: exam }, { data: selectedRows }, { data: countdown }, recentAttempts] = await Promise.all([
    getPrepTable("prep_user_progress").select("id, paper_id, completed_at, prep_papers(title, year, shift)").eq("user_id", user.id).eq("is_completed", true).order("completed_at", { ascending: false }),
    getPrepTable("prep_exams").select("id").eq("slug", "gate").eq("is_active", true).maybeSingle(),
    getPrepTable("prep_user_preparation_branches").select("branch_id, position, prep_branches(id, name, slug, prep_exams(slug))").eq("user_id", user.id).order("position"),
    getPrepTable("prep_user_countdowns").select("exam_date").eq("user_id", user.id).maybeSingle(),
    listUserAttempts(user.id, 5).catch(() => [])
  ]);
  const { data: branches } = exam ? await getPrepTable("prep_branches").select("id, name, slug").eq("exam_id", exam.id).eq("is_active", true).order("name") : { data: [] };
  const selectedBranches = (selectedRows || []).map((row) => row.prep_branches).filter(Boolean);
  const initialSetup = selectedBranches.length === 0;
  return <section className="shell dash py-12 sm:py-16">
    <header className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div className="flex items-center gap-4"><span className="dash-avatar"><UserAvatar image={user.image} name={user.name} size={56} /></span><div><p className="eyebrow">Workspace</p><h1 className="page-title mt-1">Good to see you, <span className="grad-text">{user.name?.split(" ")[0] || "there"}</span></h1></div></div><Link className="button-primary btn-lg btn-arrow" href="/exams">Browse papers<ArrowRight aria-hidden="true" size={16} /></Link></header>
    <div className="mt-10 grid gap-4 lg:grid-cols-2"><CountdownCard initialDate={countdown?.exam_date || ""} /><DashboardControls branches={branches || []} selectedBranches={selectedBranches} initialSetup={initialSetup} /></div>
    {!initialSetup ? <>
      <div className="mt-14"><div className="flex flex-wrap items-baseline justify-between gap-3"><h2 className="section-title">{preparationLabel(selectedBranches)}</h2><div className="flex gap-5"><Link className="text-sm text-slate-400 transition-colors hover:text-foreground" href="/cbt/attempts">CBT attempts</Link><Link className="text-sm text-slate-400 transition-colors hover:text-foreground" href="/notes">My notes</Link></div></div><div className="tile-grid tile-grid-wide mt-4">{selectedBranches.map((branch) => <div className="spot tile" key={branch.id}><div className="flex items-center gap-4"><BranchLogo name={branch.name} slug={branch.slug} size={48} className="shrink-0" /><div className="min-w-0"><p className="font-medium leading-snug">{branch.name}</p><p className="mt-0.5 text-sm text-slate-400">{branchCode(branch)}</p></div></div><div className="mt-auto flex flex-wrap gap-2 pt-6"><Link className="button-primary btn-sm" href={`/exams/${branch.prep_exams?.slug || "gate"}/${branch.slug}`}>Papers</Link><Link className="button-secondary btn-sm" href={`/exams/${branch.prep_exams?.slug || "gate"}/${branch.slug}/cbt`}>CBT sets</Link><Link className="button-secondary btn-sm" href={`/exams/${branch.prep_exams?.slug || "gate"}/${branch.slug}/practice`}>Practice</Link></div></div>)}</div></div>
      {recentAttempts.length ? <div className="mt-14"><div className="flex flex-wrap items-baseline justify-between gap-3"><h2 className="section-title">Recent CBT attempts</h2><Link className="text-sm text-slate-400 transition-colors hover:text-foreground" href="/cbt/attempts">View all</Link></div><div className="rows mt-4">{recentAttempts.map((attempt) => <Link className="row group" href={`/cbt/attempts/${attempt.id}`} key={attempt.id}><div className="min-w-0"><p className="truncate font-medium">{attempt.setTitle}</p><p className="mt-0.5 text-sm text-slate-400"><span className="tabular">{attempt.score !== null && attempt.maxScore ? `${attempt.score} / ${attempt.maxScore} marks` : `${attempt.correct} / ${attempt.total} correct`}</span>, {attempt.mode === "EXAM" ? "exam mode" : "study mode"}</p></div><span className="row-action">Review</span></Link>)}</div></div> : null}
      <div className="mt-14"><div className="flex flex-wrap items-baseline justify-between gap-3"><h2 className="section-title">Completed papers</h2><p className="tabular text-sm text-slate-400">{completed?.length || 0} completed</p></div>{completed?.length ? <div className="rows mt-4">{completed.map((item) => <Link className="row group" href={`/papers/${item.paper_id}`} key={item.id}><CheckCircle2 aria-hidden="true" className="shrink-0 text-mint" size={18} strokeWidth={1.75} /><div className="min-w-0"><p className="truncate font-medium">{item.prep_papers?.title}</p><p className="mt-0.5 text-sm text-slate-400"><span className="tabular">{item.prep_papers?.year}</span>{item.prep_papers?.shift ? `, ${item.prep_papers.shift}` : ""}</p></div><span className="row-action">Review</span></Link>)}</div> : <div className="empty-state mt-4 max-w-xl"><FileText aria-hidden="true" className="text-slate-400" size={20} strokeWidth={1.75} /><p className="mt-4 font-medium">No completed papers yet</p><p className="mt-1 text-sm text-slate-400">Open a paper and mark it complete. It will be listed here.</p><Link className="button-secondary mt-5" href="/exams">Find a paper</Link></div>}</div>
    </> : null}
    <AccountDataControls />
  </section>;
}
