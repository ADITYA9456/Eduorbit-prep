import Link from "next/link";
import { Orbit } from "lucide-react";

export default function Footer() {
  return <footer className="border-t border-line"><div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-[1.4fr_.6fr_.6fr]"><div><Link className="flex items-center gap-2 font-bold" href="/"><span className="rounded-lg bg-electric p-1.5 text-ink"><Orbit size={16} /></span>EDU<span className="text-electric">orbit</span></Link><p className="mt-4 max-w-xs text-sm leading-6 text-slate-500">A focused workspace for GATE CSE preparation, built around real papers and meaningful progress.</p></div><div><p className="text-sm font-semibold">Explore</p><div className="mt-4 grid gap-3 text-sm text-slate-500"><Link href="/exams">GATE PYQs</Link><Link href="/dashboard">Workspace</Link></div></div><div><p className="text-sm font-semibold">Account</p><div className="mt-4 grid gap-3 text-sm text-slate-500"><Link href="/login">Sign in</Link><Link href="/notes">My Notes</Link></div></div></div><div className="mx-auto max-w-6xl border-t border-line px-6 py-5 text-xs text-slate-600">© {new Date().getFullYear()} EDUorbit. Prepare with intention.</div></footer>;
}
