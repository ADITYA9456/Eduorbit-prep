"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, Search } from "lucide-react";
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

const NO_BRANCH = "__none";
const NO_SUBJECT = "__none";

function questionTotal(set) {
  return set.questionCount ?? set.cbt_questions?.[0]?.count ?? 0;
}

export default function CbtSavedSets({ sets, setSets }) {
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [branch, setBranch] = useState("");
  const [subject, setSubject] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState({});

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

  const branchOf = (set) => set.prep_branches?.name || "";
  const subjectOf = (set) => set.prep_subjects?.name || "";

  const branchCounts = useMemo(() => {
    const counts = new Map();
    for (const set of sets) counts.set(branchOf(set) || NO_BRANCH, (counts.get(branchOf(set) || NO_BRANCH) || 0) + 1);
    const named = [...counts.entries()].filter(([name]) => name !== NO_BRANCH).sort((a, b) => a[0].localeCompare(b[0]));
    return counts.has(NO_BRANCH) ? [...named, [NO_BRANCH, counts.get(NO_BRANCH)]] : named;
  }, [sets]);

  const subjectOptions = useMemo(() => {
    const names = new Set();
    let hasNone = false;
    for (const set of sets) {
      if (branch && (branchOf(set) || NO_BRANCH) !== branch) continue;
      if (subjectOf(set)) names.add(subjectOf(set)); else hasNone = true;
    }
    return { names: [...names].sort((a, b) => a.localeCompare(b)), hasNone };
  }, [sets, branch]);

  const needle = query.trim().toLowerCase();
  const filtering = Boolean(branch || subject || status || needle);
  const visible = sets.filter((set) => {
    if (branch && (branchOf(set) || NO_BRANCH) !== branch) return false;
    if (subject && (subjectOf(set) || NO_SUBJECT) !== subject) return false;
    if (status === "published" && !set.is_published) return false;
    if (status === "draft" && set.is_published) return false;
    if (needle && !`${set.title} ${subjectOf(set)} ${set.year || ""}`.toLowerCase().includes(needle)) return false;
    return true;
  });

  const groups = useMemo(() => {
    const map = new Map();
    for (const set of visible) {
      const key = branchOf(set) || NO_BRANCH;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(set);
    }
    return [...map.entries()].sort((a, b) => a[0] === NO_BRANCH ? 1 : b[0] === NO_BRANCH ? -1 : a[0].localeCompare(b[0]));
  }, [visible]);

  const publishedCount = sets.filter((set) => set.is_published).length;
  const branchLabel = (name) => name === NO_BRANCH ? "No branch" : name;
  const isOpen = (name) => filtering || groups.length === 1 || Boolean(openGroups[name]);
  const clearFilters = () => { setBranch(""); setSubject(""); setStatus(""); setQuery(""); };

  function renderSet(set) {
    return <div key={set.id}>
      <div className="row flex-wrap"><div className="min-w-0 flex-1"><p className="truncate font-medium">{set.title}</p><p className="mt-1 flex flex-wrap gap-1.5">{subjectOf(set) ? <span className="badge">{subjectOf(set)}</span> : null}{set.year ? <span className="badge tabular">{set.year}</span> : null}<span className="badge tabular">{questionTotal(set)} questions</span><span className={`badge ${set.is_published ? "badge-success" : ""}`}>{set.is_published ? "Published" : "Draft"}</span></p></div>
        <div className="flex flex-wrap gap-2">{set.is_published ? <a className="button-ghost btn-sm" href={`/cbt/${set.id}`}>Open</a> : null}<button className="button-secondary btn-sm" onClick={() => setEditingId(editingId === set.id ? null : set.id)} type="button">{editingId === set.id ? "Close" : "Edit"}</button><button className="button-secondary btn-sm" onClick={() => togglePublish(set)} type="button">{set.is_published ? "Unpublish" : "Publish"}</button><button className="button-danger btn-sm" onClick={() => remove(set)} type="button">Delete</button></div>
      </div>
      {editingId === set.id ? <div className="p-3"><Editor onClose={() => setEditingId(null)} onSaved={saved} setId={set.id} /></div> : null}
    </div>;
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="section-title">Saved sets</h2>
      <p className="tabular text-sm text-slate-400">{sets.length} total, {publishedCount} published, {sets.length - publishedCount} draft</p>
    </div>
    {branchCounts.length > 1 ? <p className="flex flex-wrap gap-1.5">{branchCounts.map(([name, count]) => <button aria-pressed={branch === name} className={`badge tabular cursor-pointer ${branch === name ? "badge-accent" : ""}`} key={name} onClick={() => { setBranch(branch === name ? "" : name); setSubject(""); }} type="button">{branchLabel(name)}: {count}</button>)}</p> : null}
    {message ? <p className="text-sm text-[color:var(--bad-fg)]" role="alert">{message}</p> : null}
    {sets.length ? <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm"><span className="field-label">Branch</span><select className="field" value={branch} onChange={(event) => { setBranch(event.target.value); setSubject(""); }}><option value="">All branches ({sets.length})</option>{branchCounts.map(([name, count]) => <option key={name} value={name}>{branchLabel(name)} ({count})</option>)}</select></label>
        <label className="block text-sm"><span className="field-label">Subject</span><select className="field" value={subject} onChange={(event) => setSubject(event.target.value)}><option value="">All subjects</option>{subjectOptions.names.map((name) => <option key={name} value={name}>{name}</option>)}{subjectOptions.hasNone ? <option value={NO_SUBJECT}>No subject</option> : null}</select></label>
        <label className="block text-sm"><span className="field-label">Status</span><select className="field" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="published">Published</option><option value="draft">Draft</option></select></label>
        <label className="block text-sm"><span className="field-label">Search</span><span className="relative block"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input className="field pl-9" placeholder="Title or year" type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></span></label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400"><p aria-live="polite" className="tabular">{filtering ? `Showing ${visible.length} of ${sets.length} sets` : `${sets.length} sets in ${groups.length} ${groups.length === 1 ? "branch" : "branches"}`}</p>{filtering ? <button className="button-ghost btn-sm" onClick={clearFilters} type="button">Clear filters</button> : null}</div>
      {groups.length ? <div className="space-y-3">{groups.map(([name, items]) => {
        const open = isOpen(name);
        const forced = filtering || groups.length === 1;
        return <div className="rows" key={name}>
          <button aria-expanded={open} className="row w-full cursor-pointer text-left disabled:cursor-default" disabled={forced} onClick={() => setOpenGroups((current) => ({ ...current, [name]: !current[name] }))} type="button">
            <span className="font-medium">{branchLabel(name)}</span>
            <span className="tabular text-sm text-slate-400">{items.length} {items.length === 1 ? "set" : "sets"}, {items.filter((set) => set.is_published).length} published</span>
            {forced ? null : <ChevronDown aria-hidden="true" className={`ml-auto shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} size={18} />}
          </button>
          {open ? items.map(renderSet) : null}
        </div>;
      })}</div> : <div className="empty-state"><p className="font-medium">No sets match these filters</p><p className="mt-1 text-sm text-slate-400">Try a different branch or subject, or clear the filters.</p></div>}
    </> : <div className="empty-state"><p className="font-medium">No sets saved yet</p><p className="mt-1 text-sm text-slate-400">Add question images above, review them, then save the set.</p></div>}
  </div>;
}
