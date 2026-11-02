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
    setMessage("Saving...");
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
  return <form className="card max-w-2xl space-y-4 p-6" onSubmit={submit}>{fields.map(({ name, label, type: inputType = "text", required, options }) => <label className="block text-sm" key={name}><span className="mb-2 block text-slate-400">{label}</span>{options ? <select className="field" required={required} value={values[name] || ""} onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}><option value="">Select {label}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input className="field" required={required} type={inputType} value={values[name] || ""} onChange={(event) => setValues((current) => ({ ...current, [name]: inputType === "number" ? Number(event.target.value) : event.target.value }))} />}</label>)}<button className="button-primary" disabled={saving} type="submit">{saving ? "Saving..." : "Save"}</button>{message && <p className="text-sm text-slate-400" role="status">{message}</p>}</form>;
}
