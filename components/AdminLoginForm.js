"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

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
    <label className="block"><span className="field-label">Admin password</span><input aria-invalid={Boolean(message)} autoComplete="current-password" className="field" disabled={saving} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
    <button className="button-primary w-full" disabled={saving} type="submit">{saving ? "Verifying…" : "Verify admin access"}</button>
        {message ? <p className="field-error" role="alert">{message} Check the password and try again.</p> : null}
  </form>;
}
