import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginButton from "@/components/LoginButton";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
export const dynamic = "force-dynamic";

export default async function LoginPage() { if (await getCurrentUser()) redirect("/dashboard"); return <section className="shell flex min-h-[calc(100dvh-var(--header-h)-1px)] items-center justify-center py-16"><div className="w-full max-w-sm"><BrandLogo size={36} title="" /><h1 className="page-title mt-8">Sign in to EDUorbit</h1><p className="mt-3 text-slate-400">Save completed papers and private question notes across your devices.</p><div className="mt-8 [&_.button-google]:w-full"><LoginButton /></div><p className="mt-6 text-sm text-slate-400">Browsing papers works without an account.</p><div className="divider mt-10" /><Link className="mt-5 inline-flex min-h-[44px] items-center text-sm text-slate-400 underline decoration-[color:var(--border-strong)] underline-offset-4 transition-colors hover:text-foreground" href="/admin-login">Admin login</Link></div></section>; }
