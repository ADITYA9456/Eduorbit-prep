"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import LoadingExperience from "@/components/LoadingExperience";

export default function AdminLoginForm({ googleAuthenticated }) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to authenticate.");
      window.location.assign("/admin");
    } catch (error) {
      setMessage(error.message || "Unable to authenticate.");
      setPassword("");
    } finally {
      setSaving(false);
    }
  }

  if (!googleAuthenticated) {
    return <button className="button-google w-full" onClick={() => signIn("google", { callbackUrl: "/admin-login" })} type="button">Continue with Google</button>;
  }

  return <form className="space-y-4 text-left" onSubmit={submit}>
    <label className="block text-sm"><span className="mb-2 block text-slate-400">Admin password</span><input autoComplete="current-password" className="field" disabled={saving} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
    <button className="button-primary w-full" disabled={saving} type="submit">{saving ? "Verifying..." : "Verify admin access"}</button>
    {saving ? <LoadingExperience message="Checking admin credentials..." /> : null}
    {message ? <p className="text-sm text-red-300" role="alert">{message}</p> : null}
  </form>;
}
