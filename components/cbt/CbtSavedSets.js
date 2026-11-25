"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { hasAnswerKey } from "@/lib/cbtSetShared";

async function request(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

function json(method, body) {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

function Editor({ setId, onClose, onSaved }) {
  const [draft, setDraft] = useState(null);
  const [message, setMessage] = useState("Loading…");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    request(`/api/admin/cbt-sets/${setId}`).then((payload) => {
      if (cancelled) return;
      setDraft({ ...payload.set, year: payload.set.year ?? "", durationMinutes: payload.set.durationMinutes ?? "" });
      setMessage("");
    }).catch((error) => { if (!cancelled) setMessage(error.message); });
    return () => { cancelled = true; };
  }, [setId]);

  function updateQuestion(id, patch) {
    setDraft((current) => ({ ...current, questions: current.questions.map((question) => question.id === id ? { ...question, ...patch } : question) }));
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const payload = await request(`/api/admin/cbt-sets/${setId}`, json("PATCH", {
        title: draft.title,
        year: draft.year === "" ? null : Number(draft.year),
        durationMinutes: draft.durationMinutes === "" ? null : Number(draft.durationMinutes),
        questions: draft.questions.map((question) => ({ id: question.id, correctKey: question.correctKey, correctKeys: question.correctKeys, natMin: question.natMin, natMax: question.natMax, explanation: question.explanation, marks: question.marks, negativeMarks: question.type === "MCQ" ? question.negativeMarks : 0 }))
      }));
      onSaved(payload.set);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  if (!draft) return <div className="panel p-5 text-sm text-slate-400" role="status">{message}</div>;
  const missing = draft.questions.filter((question) => !hasAnswerKey(question)).length;
  return <div className="panel space-y-5 p-5 sm:p-6">
    <div className="flex items-center justify-between gap-3"><h3 className="section-title">Edit set</h3><button className="button-ghost btn-sm" onClick={onClose} type="button">Close</button></div>
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="block text-sm sm:col-span-3"><span className="field-label">Title</span><input className="field" maxLength={250} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
      <label className="block text-sm"><span className="field-label">Year</span><input className="field" max="2200" min="1900" type="number" value={draft.year} onChange={(event) => setDraft({ ...draft, year: event.target.value })} /></label>
      <label className="block text-sm"><span className="field-label">Exam time limit (minutes)</span><input className="field" max="600" min="1" placeholder="Default: 2 per question" type="number" value={draft.durationMinutes} onChange={(event) => setDraft({ ...draft, durationMinutes: event.target.value })} /></label>
    </div>
    <div>
      <p className="field-label">Answer key and explanations</p>
      <p className="mb-3 text-sm text-slate-400">{draft.questions.length} questions{missing ? `, ${missing} without an answer key` : ", all have an answer key"}.</p>
      <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">{draft.questions.map((question) => <div className="rounded-[12px] border border-line bg-[color:var(--surface-sunken)] p-3" key={question.id}>
        <p className="line-clamp-2 text-sm"><span className="tabular font-medium">Q{question.number}.</span> {question.text}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="badge">{question.type}</span>
          <label className="flex items-center gap-2"><span className="text-slate-400">Marks</span><input aria-label={`Marks for question ${question.number}`} className="field w-20 py-1.5" min="0.5" step="0.5" type="number" value={question.marks} onChange={(event) => updateQuestion(question.id, { marks: event.target.value })} /></label>
          <label className="flex items-center gap-2"><span className="text-slate-400">Negative</span><input aria-label={`Negative marks for question ${question.number}`} className="field w-24 py-1.5" disabled={question.type !== "MCQ"} min="0" placeholder={question.type === "MCQ" ? "Auto" : "None"} step="any" type="number" value={question.type === "MCQ" ? question.negativeMarks : ""} onChange={(event) => updateQuestion(question.id, { negativeMarks: event.target.value })} /></label>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,240px)_1fr]">
          {question.type === "NAT" ? <div className="grid grid-cols-2 gap-2"><input aria-label={`Answer for question ${question.number}`} className="field py-2" placeholder="Answer" step="any" type="number" value={question.natMin} onChange={(event) => updateQuestion(question.id, { natMin: event.target.value })} /><input aria-label={`Range end for question ${question.number}`} className="field py-2" placeholder="Up to (optional)" step="any" type="number" value={question.natMax} onChange={(event) => updateQuestion(question.id, { natMax: event.target.value })} /></div>
          : question.type === "MSQ" ? <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"><legend className="sr-only">Correct options for question {question.number}</legend>{question.options.map((option) => <label className="flex min-h-[32px] items-center gap-1.5" key={option.key}><input checked={question.correctKeys.includes(option.key)} className="h-4 w-4" type="checkbox" onChange={() => updateQuestion(question.id, { correctKeys: question.correctKeys.includes(option.key) ? question.correctKeys.filter((key) => key !== option.key) : [...question.correctKeys, option.key].sort() })} />{option.key}</label>)}</fieldset>
          : <select aria-label={`Correct option for question ${question.number}`} className="field py-2" value={question.correctKey} onChange={(event) => updateQuestion(question.id, { correctKey: event.target.value })}><option value="">No key</option>{question.options.map((option) => <option key={option.key} value={option.key}>{option.key}</option>)}</select>}
          <input aria-label={`Explanation for question ${question.number}`} className="field py-2" placeholder="Explanation (optional)" value={question.explanation} onChange={(event) => updateQuestion(question.id, { explanation: event.target.value })} />
        </div>
      </div>)}</div>
    </div>
    {message ? <p className="text-sm text-[color:var(--bad-fg)]" role="alert">{message}</p> : null}
    <div className="flex justify-end gap-3"><button className="button-ghost" onClick={onClose} type="button">Cancel</button><button className="button-primary" disabled={saving} onClick={save} type="button">{saving ? <><Loader2 aria-hidden="true" className="animate-spin" size={16} />Saving…</> : "Save changes"}</button></div>
  </div>;
}

export default function CbtSavedSets({ sets, setSets }) {
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");

  async function togglePublish(set) {
    try {
      const payload = await request(`/api/admin/cbt-sets/${set.id}`, json("PATCH", { isPublished: !set.is_published }));
      setSets((current) => current.map((item) => item.id === set.id ? { ...item, is_published: payload.set.is_published } : item));
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function remove(set) {
    if (!window.confirm(`Delete "${set.title}"? Its questions and every student attempt on it are removed. This cannot be undone.`)) return;
    try {
      await request(`/api/admin/cbt-sets/${set.id}`, { method: "DELETE" });
      setSets((current) => current.filter((item) => item.id !== set.id));
      if (editingId === set.id) setEditingId(null);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  }

  function saved(updated) {
    setSets((current) => current.map((item) => item.id === updated.id ? { ...item, title: updated.title, year: updated.year } : item));
    setEditingId(null);
  }

  return <div className="space-y-3">
    <h2 className="section-title">Saved sets</h2>
    {message ? <p className="text-sm text-[color:var(--bad-fg)]" role="alert">{message}</p> : null}
    {sets.length ? <div className="space-y-3">{sets.map((set) => <div key={set.id}>
      <div className="rows"><div className="row flex-wrap"><div className="min-w-0 flex-1"><p className="truncate font-medium">{set.title}</p><p className="mt-1 flex flex-wrap gap-1.5">{set.year ? <span className="badge tabular">{set.year}</span> : null}<span className="badge tabular">{set.questionCount ?? set.cbt_questions?.[0]?.count ?? 0} questions</span><span className={`badge ${set.is_published ? "badge-success" : ""}`}>{set.is_published ? "Published" : "Draft"}</span></p></div>
        <div className="flex flex-wrap gap-2">{set.is_published ? <a className="button-ghost btn-sm" href={`/cbt/${set.id}`}>Open</a> : null}<button className="button-secondary btn-sm" onClick={() => setEditingId(editingId === set.id ? null : set.id)} type="button">{editingId === set.id ? "Close" : "Edit"}</button><button className="button-secondary btn-sm" onClick={() => togglePublish(set)} type="button">{set.is_published ? "Unpublish" : "Publish"}</button><button className="button-danger btn-sm" onClick={() => remove(set)} type="button">Delete</button></div>
      </div></div>
      {editingId === set.id ? <div className="mt-3"><Editor onClose={() => setEditingId(null)} onSaved={saved} setId={set.id} /></div> : null}
    </div>)}</div> : <div className="empty-state"><p className="font-medium">No sets saved yet</p><p className="mt-1 text-sm text-slate-400">Add question images above, review them, then save the set.</p></div>}
  </div>;
}
