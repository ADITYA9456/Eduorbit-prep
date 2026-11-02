import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginButton from "@/components/LoginButton";
import Link from "next/link";
export const dynamic = "force-dynamic";

export default async function LoginPage() { if (await getCurrentUser()) redirect("/dashboard"); return <section className="mx-auto flex min-h-[75vh] max-w-md items-center px-6"><div className="card w-full p-8 text-center"><p className="text-sm uppercase tracking-[.2em] text-electric">Welcome to EDUorbit</p><h1 className="mt-5 text-3xl font-bold">Keep your progress in orbit.</h1><p className="mt-3 text-sm leading-6 text-slate-400">Sign in to save completion and private question notes across devices.</p><div className="mt-8"><LoginButton /></div><Link className="mt-5 inline-block text-sm text-slate-400 underline decoration-slate-600 underline-offset-4 hover:text-electric" href="/admin-login">Admin Login</Link></div></section>; }
