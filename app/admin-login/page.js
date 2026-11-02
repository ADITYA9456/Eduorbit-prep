import { getCurrentUser } from "@/lib/auth";
import AdminLoginForm from "@/components/AdminLoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const user = await getCurrentUser();
  if (user?.isAdmin) {
    return <section className="mx-auto flex min-h-[75vh] max-w-md items-center px-6"><div className="card w-full p-8 text-center"><p className="eyebrow">Admin verification</p><h1 className="mt-4 text-3xl font-bold">Unlock admin access.</h1><p className="mt-3 text-sm leading-6 text-slate-400">Your Google account is recognized. Enter the server-configured admin password to continue.</p><div className="mt-8"><AdminLoginForm googleAuthenticated /></div></div></section>;
  }
  return <section className="mx-auto flex min-h-[75vh] max-w-md items-center px-6"><div className="card w-full p-8 text-center"><p className="eyebrow">Restricted area</p><h1 className="mt-4 text-3xl font-bold">Admin login.</h1><p className="mt-3 text-sm leading-6 text-slate-400">First authenticate with the authorized Google account.</p><div className="mt-8"><AdminLoginForm googleAuthenticated={false} /></div><p className="mt-4 text-xs text-slate-600">Only the configured admin email can continue.</p></div></section>;
}
