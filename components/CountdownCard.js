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

  return <div className="card p-6"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">GATE 2027 countdown</p>{days === null ? <p className="mt-3 text-sm text-slate-400">Set your exam date to keep your preparation on track.</p> : days > 0 ? <p className="mt-3 text-4xl font-bold">{days} <span className="text-base font-medium text-slate-500">days left</span></p> : <p className="mt-3 text-xl font-semibold text-slate-400">Exam date has passed.</p>}</div>{!editing ? <button className="button-secondary px-3 py-2 text-sm" onClick={() => setEditing(true)} type="button">Edit exam date</button> : null}</div>{editing ? <div className="mt-5 flex flex-col gap-3 sm:flex-row"><input aria-label="GATE exam date" className="field" type="date" value={draftDate} onChange={(event) => setDraftDate(event.target.value)} /><button className="button-primary" disabled={saving || !draftDate} onClick={save} type="button">{saving ? "Saving..." : "Save date"}</button></div> : <p className="mt-3 text-xs text-slate-500">Exam date: {examDate}</p>}{error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}</div>;
}
