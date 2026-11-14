import { getCurrentUser } from "@/lib/auth";
import AdminLoginForm from "@/components/AdminLoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const user = await getCurrentUser();
  if (user?.isAdmin) {
    return <section className="shell flex min-h-[calc(100dvh-var(--header-h)-1px)] items-center justify-center py-16"><div className="w-full max-w-sm"><p className="eyebrow">Admin</p><h1 className="page-title mt-3">Enter the admin password</h1><p className="mt-3 text-slate-400">Your Google account is recognised. Enter the admin password to continue.</p><div className="mt-8"><AdminLoginForm googleAuthenticated /></div></div></section>;
  }
  return <section className="shell flex min-h-[calc(100dvh-var(--header-h)-1px)] items-center justify-center py-16"><div className="w-full max-w-sm"><p className="eyebrow">Admin</p><h1 className="page-title mt-3">Admin login</h1><p className="mt-3 text-slate-400">Sign in with the authorised Google account first. Only the configured admin email can continue.</p><div className="mt-8"><AdminLoginForm googleAuthenticated={false} /></div></div></section>;
}
