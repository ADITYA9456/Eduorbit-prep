"use client";

import { useState } from "react";

function daysRemaining(examDate) {
  if (!examDate) return null;
  const today = new Date();
  const current = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const target = Date.parse(`${examDate}T00:00:00Z`);
  return Math.ceil((target - current) / 86400000);
}

export default function CountdownCard({ initialDate }) {
  const [examDate, setExamDate] = useState(initialDate || "");
  const [draftDate, setDraftDate] = useState(initialDate || "");
  const [editing, setEditing] = useState(!initialDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const days = daysRemaining(examDate);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/countdown", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ examDate: draftDate }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save exam date.");
      setExamDate(result.examDate);
      setDraftDate(result.examDate);
      setEditing(false);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return <div className="panel p-6"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">GATE 2027 countdown</p>{days === null ? <p className="mt-3 text-sm text-slate-400">Set your exam date to keep your preparation on track.</p> : days > 0 ? <p className="mt-2 flex items-baseline gap-2"><span className="tabular text-5xl font-medium tracking-tight">{days}</span><span className="text-slate-400">{days === 1 ? "day left" : "days left"}</span></p> : <p className="mt-3 text-xl font-semibold text-slate-400">Exam date has passed.</p>}</div>{!editing ? <button className="button-ghost btn-sm" onClick={() => setEditing(true)} type="button">Edit date</button> : null}</div>{editing ? <div className="mt-5"><label className="field-label" htmlFor="gate-exam-date">GATE exam date</label><div className="flex flex-col gap-3 sm:flex-row"><input aria-describedby={error ? "gate-exam-date-error" : undefined} aria-invalid={Boolean(error)} className="field tabular" id="gate-exam-date" type="date" value={draftDate} onChange={(event) => setDraftDate(event.target.value)} /><button className="button-primary" disabled={saving || !draftDate} onClick={save} type="button">{saving ? "Saving…" : "Save date"}</button></div></div> : <p className="mt-3 text-sm text-slate-400">Exam date <span className="tabular text-foreground">{examDate}</span></p>}{error ? <p className="field-error" id="gate-exam-date-error" role="alert">{error} Check the date and try again.</p> : null}</div>;
}
