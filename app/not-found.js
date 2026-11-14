import Link from "next/link";

export default function NotFound() {
  return (
    <section className="shell flex min-h-[60dvh] items-center py-24">
      <div className="max-w-md">
        <p className="tabular text-sm text-slate-400">404</p>
        <h1 className="page-title mt-3">This page isn&apos;t here</h1>
        <p className="mt-3 text-slate-400">The page or paper may have moved. Start again from the paper library.</p>
        <div className="mt-8 flex flex-wrap gap-3"><Link className="button-primary" href="/exams">Open the paper library</Link><Link className="button-ghost" href="/">Go home</Link></div>
      </div>
    </section>
  );
}
