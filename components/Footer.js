import Link from "next/link";
import { BrandWordmark } from "@/components/BrandLogo";

const columns = [
  { title: "Explore", links: [{ href: "/exams", label: "GATE PYQs" }, { href: "/dashboard", label: "Workspace" }] },
  { title: "Account", links: [{ href: "/login", label: "Sign in" }, { href: "/notes", label: "My Notes" }] }
];

export default function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="shell grid gap-10 py-12 sm:grid-cols-[1fr_auto_auto] sm:gap-16">
        <div className="max-w-xs">
          <Link aria-label="EDUorbit home" className="inline-flex rounded-full" href="/"><BrandWordmark size={22} /></Link>
          <p className="mt-4 text-sm leading-6 text-slate-400">GATE previous-year papers, computer-based tests and private notes in one place.</p>
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <p className="text-sm font-medium">{column.title}</p>
            <ul className="mt-3 grid gap-1">
              {column.links.map((link) => <li key={link.href}><Link className="inline-flex min-h-[32px] items-center text-sm text-slate-400 transition-colors hover:text-foreground" href={link.href}>{link.label}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="shell flex flex-wrap items-center justify-between gap-2 border-t border-line py-5 text-xs text-slate-500">
        <span>© {new Date().getFullYear()} EDUorbit</span>
      </div>
    </footer>
  );
}
