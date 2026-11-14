import Link from "next/link";
import { BookOpen, Database } from "lucide-react";
import { listExams } from "@/lib/data";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import GuestNotice from "@/components/GuestNotice";
import { getCurrentUser } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function ExamsPage() {
  let exams = []; let databaseError = false;
  try { exams = await listExams(); } catch (error) { databaseError = true; console.error("Unable to load examinations:", error); }
  const session = await getServerSession(authOptions);
  const user = session ? await getCurrentUser() : null;
  const selected = user ? await import("@/lib/preparation").then(({ getSelectedBranches }) => getSelectedBranches(user.id)) : [];
  const selectedIds = new Set(selected.map((branch) => branch.id));
  const visibleExams = user && selected.length ? exams.map((exam) => ({ ...exam, branches: exam.branches.filter((branch) => selectedIds.has(branch.id)) })).filter((exam) => exam.branches.length) : exams;
  return <section className="shell py-12 sm:py-16"><header className="max-w-2xl"><p className="eyebrow">Paper library</p><h1 className="page-title mt-3">Choose your examination</h1><p className="lede mt-4">Start with the examination you are preparing for. EDUorbit currently covers GATE.</p></header>{!session ? <GuestNotice /> : null}<div className="mt-10">{databaseError ? <div className="panel max-w-xl p-6" role="alert"><div className="flex items-center gap-2 font-medium"><Database aria-hidden="true" className="text-amber-300" size={18} />The library could not be loaded</div><p className="mt-2 text-sm leading-6 text-slate-400">Configure the Supabase credentials, apply the migrations and seed the catalogue, then reload this page.</p></div> : visibleExams.length ? <div className="rows">{visibleExams.map((exam) => <Link className="row group" href={`/exams/${exam.slug}`} key={exam.id}><BookOpen aria-hidden="true" className="shrink-0 text-electric" size={20} strokeWidth={1.75} /><div className="min-w-0"><h2 className="font-medium">{exam.name}</h2><p className="mt-0.5 text-sm text-slate-400">{exam.description || "Explore the previous-year paper library."}</p></div><span className="row-action">View branches</span></Link>)}</div> : <div className="empty-state max-w-xl"><p className="font-medium">No preparation branches selected yet</p><p className="mt-1 text-sm text-slate-400">Choose the GATE papers you are preparing for in your workspace.</p><Link className="button-secondary mt-5" href="/dashboard">Choose papers</Link></div>}</div></section>;
}
