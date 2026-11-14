"use client";
import { useState } from "react";

export default function AdminForm({ type, fields, initialValues = {} }) {
  const [values, setValues] = useState(initialValues);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, ...values }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save.");
      setMessage("Saved.");
    } catch (saveError) {
      setMessage(saveError.message || "Unable to save.");
    } finally {
      setSaving(false);
    }
  }
  return <form className="panel max-w-2xl space-y-5 p-6" onSubmit={submit}>{fields.map(({ name, label, type: inputType = "text", required, options }) => <label className="block" key={name}><span className="field-label">{label}{required ? null : <span className="font-normal text-slate-400"> (optional)</span>}</span>{options ? <select className="field" required={required} value={values[name] || ""} onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}><option value="">Select {label}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input className="field" required={required} type={inputType} value={values[name] || ""} onChange={(event) => setValues((current) => ({ ...current, [name]: inputType === "number" ? Number(event.target.value) : event.target.value }))} />}</label>)}<button className="button-primary" disabled={saving} type="submit">{saving ? "Saving…" : "Save"}</button>{message && <p className={message === "Saved." ? "text-sm text-[color:var(--ok-fg)]" : "field-error"} role="status">{message === "Saved." ? message : `${message} Check the fields and try again.`}</p>}</form>;
}
