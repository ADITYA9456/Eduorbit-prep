"use client";
import { useState } from "react";

export default function AdminForm({ type, fields, initialValues = {} }) {
  const [values, setValues] = useState(initialValues); const [message, setMessage] = useState("");
  async function submit(event) {
    event.preventDefault(); setMessage("Saving…");
    const response = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, ...values }) });
    const result = await response.json(); setMessage(response.ok ? "Saved." : result.error || "Unable to save.");
  }
  return <form className="card max-w-2xl space-y-4 p-6" onSubmit={submit}>{fields.map(({ name, label, type: inputType = "text", required, options }) => <label className="block text-sm" key={name}><span className="mb-2 block text-slate-400">{label}</span>{options ? <select className="field" required={required} value={values[name] || ""} onChange={(event) => setValues({ ...values, [name]: event.target.value })}><option value="">Select {label}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input className="field" required={required} type={inputType} value={values[name] || ""} onChange={(event) => setValues({ ...values, [name]: inputType === "number" ? Number(event.target.value) : event.target.value })} />}</label>)}<button className="button-primary" type="submit">Save</button>{message && <p className="text-sm text-slate-400">{message}</p>}</form>;
}
