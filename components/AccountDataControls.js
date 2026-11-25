"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Download, Loader2, Trash2 } from "lucide-react";

export default function AccountDataControls() {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function exportData() {
    setBusy("export");
    setMessage("");
    try {
      const response = await fetch("/api/account");
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Could not export your data.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "eduorbit-my-data.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy("");
    }
  }

  async function deleteAccount() {
    const typed = window.prompt("This permanently deletes your account, notes, progress and test attempts. Type DELETE to confirm.");
    if (typed !== "DELETE") return;
    setBusy("delete");
    setMessage("");
    try {
      const response = await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not delete your account.");
      await signOut({ callbackUrl: "/" });
    } catch (error) {
      setMessage(error.message);
      setBusy("");
    }
  }

  return <div className="mt-14">
    <h2 className="section-title">Your data</h2>
    <p className="mt-2 max-w-xl text-sm text-slate-400">Download a copy of what EDUorbit stores about you, or delete your account and everything linked to it. Deletion cannot be undone.</p>
    <div className="mt-4 flex flex-wrap gap-3">
      <button className="button-secondary btn-sm" disabled={Boolean(busy)} onClick={exportData} type="button">{busy === "export" ? <Loader2 aria-hidden="true" className="animate-spin" size={14} /> : <Download aria-hidden="true" size={14} />}Download my data</button>
      <button className="button-danger btn-sm" disabled={Boolean(busy)} onClick={deleteAccount} type="button">{busy === "delete" ? <Loader2 aria-hidden="true" className="animate-spin" size={14} /> : <Trash2 aria-hidden="true" size={14} />}Delete my account</button>
    </div>
    {message ? <p className="mt-3 text-sm text-[color:var(--bad-fg)]" role="alert">{message}</p> : null}
  </div>;
}
