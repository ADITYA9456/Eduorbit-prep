import Link from "next/link";
export default function NotFound() { return <section className="mx-auto max-w-xl px-6 py-32 text-center"><p className="text-sm text-electric">404</p><h1 className="mt-4 text-4xl font-bold">Orbit not found.</h1><p className="mt-4 text-slate-400">That page or paper may have moved.</p><Link className="button-primary mt-8" href="/">Return home</Link></section>; }
