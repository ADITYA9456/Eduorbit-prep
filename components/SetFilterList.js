"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

const NO_SUBJECT = "__none";

export default function SetFilterList({ items, noun = "set", emptyHref, emptyLabel }) {
  const [subject, setSubject] = useState("");
  const [kind, setKind] = useState("");
  const [query, setQuery] = useState("");

  const subjects = useMemo(() => {
    const counts = new Map();
    for (const item of items) counts.set(item.subjectName || NO_SUBJECT, (counts.get(item.subjectName || NO_SUBJECT) || 0) + 1);
    const named = [...counts.entries()].filter(([name]) => name !== NO_SUBJECT).sort((a, b) => a[0].localeCompare(b[0]));
    return counts.has(NO_SUBJECT) ? [...named, [NO_SUBJECT, counts.get(NO_SUBJECT)]] : named;
  }, [items]);
  const kinds = useMemo(() => [...new Set(items.map((item) => item.kindLabel).filter(Boolean))], [items]);

  const needle = query.trim().toLowerCase();
  const visible = items.filter((item) => {
    if (subject && (item.subjectName || NO_SUBJECT) !== subject) return false;
    if (kind && item.kindLabel !== kind) return false;
    if (needle && !`${item.title} ${item.subjectName || ""} ${item.year || ""}`.toLowerCase().includes(needle)) return false;
    return true;
  });
  const filtering = Boolean(subject || kind || needle);
  const plural = (count) => `${count} ${noun}${count === 1 ? "" : "s"}`;

  return <div>
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="block min-w-0 text-sm sm:w-64"><span className="field-label">Subject</span><select className="field" value={subject} onChange={(event) => setSubject(event.target.value)}><option value="">All subjects ({items.length})</option>{subjects.map(([name, count]) => <option key={name} value={name}>{name === NO_SUBJECT ? "Full length / no subject" : name} ({count})</option>)}</select></label>
      {kinds.length > 1 ? <label className="block min-w-0 text-sm sm:w-48"><span className="field-label">Type</span><select className="field" value={kind} onChange={(event) => setKind(event.target.value)}><option value="">All types</option>{kinds.map((label) => <option key={label} value={label}>{label}</option>)}</select></label> : null}
      <label className="block min-w-0 text-sm sm:min-w-[14rem] sm:flex-1"><span className="field-label">Search</span><span className="relative block"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input className="field pl-9" placeholder="Search by title or year" type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></span></label>
      {filtering ? <button className="button-ghost btn-sm mb-1.5 self-start sm:self-end" onClick={() => { setSubject(""); setKind(""); setQuery(""); }} type="button">Clear filters</button> : null}
    </div>
    <p aria-live="polite" className="tabular mt-4 text-sm text-slate-400">{filtering ? `Showing ${visible.length} of ${plural(items.length)}` : `${plural(items.length)} available`}</p>
    {visible.length ? <div className="rows mt-3">{visible.map((item) => <Link className="row group" href={item.href} key={item.id}><div className="min-w-0"><p className="truncate font-medium">{item.title}</p><p className="mt-1 flex flex-wrap gap-1.5 text-sm text-slate-400">{item.kindLabel ? <span className="badge">{item.kindLabel}</span> : null}{item.year ? <span className="badge tabular">{item.year}</span> : null}{item.subjectName ? <span className="badge">{item.subjectName}</span> : null}<span className="badge tabular">{item.questionCount} questions</span></p></div><span className="row-action">Start test</span></Link>)}</div> : <div className="empty-state mt-3 max-w-xl"><p className="font-medium">No {noun}s match these filters</p><p className="mt-1 text-sm text-slate-400">Try a different subject or clear the filters.</p>{emptyHref ? <Link className="button-secondary mt-5" href={emptyHref}>{emptyLabel}</Link> : null}</div>}
  </div>;
}
