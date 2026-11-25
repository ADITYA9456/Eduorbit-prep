"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Check, CircleHelp, Minus, X } from "lucide-react";
import { formatMarks } from "@/lib/cbtSetShared";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "wrong", label: "Wrong" },
  { id: "skipped", label: "Skipped" },
  { id: "correct", label: "Correct" }
];

const STATUS_BADGE = {
  correct: { label: "Correct", className: "badge-success", icon: Check },
  wrong: { label: "Wrong", className: "badge-danger", icon: X },
  skipped: { label: "Skipped", className: "", icon: Minus },
  unscored: { label: "No answer key", className: "", icon: CircleHelp }
};

function rowClass(isCorrect, isChosen) {
  if (isCorrect) return "border-[color:var(--ok-border)] bg-[color:var(--ok-bg)]";
  if (isChosen) return "border-[color:var(--bad-border)] bg-[color:var(--bad-bg)]";
  return "border-line bg-panel";
}

function letterClass(isCorrect, isChosen) {
  if (isCorrect) return "border-transparent bg-mint text-[color:var(--background)]";
  if (isChosen) return "border-transparent bg-danger text-[color:var(--background)]";
  return "border-[color:var(--border-strong)] text-slate-300";
}

const TYPE_NAME = { MCQ: "Multiple choice", MSQ: "Multiple select", NAT: "Numerical answer" };

// `results` is the server's per-question evaluation: { [questionId]: { status, earned, marks, answer, correct, correctText, explanation } }.
export default function CbtReview({ questions, answers, results }) {
  const [filter, setFilter] = useState("all");
  const rows = useMemo(() => questions.map((question) => {
    const result = results?.[question.id];
    return { question, result, answer: result?.answer ?? answers?.[question.id] ?? null, status: result?.status || "skipped" };
  }), [questions, answers, results]);
  const counts = useMemo(() => ({
    all: rows.length,
    wrong: rows.filter((row) => row.status === "wrong").length,
    skipped: rows.filter((row) => row.status === "skipped").length,
    correct: rows.filter((row) => row.status === "correct").length
  }), [rows]);
  const visible = rows.filter((row) => filter === "all" || row.status === filter);

  return <section aria-labelledby="cbt-review-heading" className="mt-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="section-title" id="cbt-review-heading">Review answers</h2>
      <div aria-label="Filter questions" className="flex flex-wrap gap-2" role="group">
        {FILTERS.map((item) => <button aria-pressed={filter === item.id} className={filter === item.id ? "button-primary btn-sm" : "button-secondary btn-sm"} key={item.id} onClick={() => setFilter(item.id)} type="button">{item.label} <span className="tabular opacity-80">{counts[item.id]}</span></button>)}
      </div>
    </div>
    {visible.length ? <div className="mt-4 space-y-4">{visible.map(({ question, result, answer, status }) => {
      const badge = STATUS_BADGE[status];
      const Icon = badge.icon;
      const picked = Array.isArray(answer) ? answer : answer ? [answer] : [];
      const correctKeys = result?.correct?.keys || [];
      return <article className="panel p-5 sm:p-6" key={question.id}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="tabular text-sm font-medium text-slate-400">Question {question.number} <span className="ml-2 font-normal">{TYPE_NAME[question.type] || ""}, {formatMarks(question.marks)} {question.marks === 1 ? "mark" : "marks"}</span></h3>
          <span className="flex items-center gap-2">
            {result && status !== "skipped" && status !== "unscored" ? <span className={`tabular text-sm font-medium ${result.earned < 0 ? "text-[color:var(--bad-fg)]" : "text-[color:var(--ok-fg)]"}`}>{result.earned > 0 ? "+" : ""}{formatMarks(result.earned)}</span> : null}
            <span className={`badge ${badge.className}`}><Icon aria-hidden="true" size={11} strokeWidth={2.5} />{badge.label}</span>
          </span>
        </div>
        {question.passage ? <div className="panel-sunken mt-4 whitespace-pre-wrap p-4 text-[15px] leading-7 text-slate-300">{question.passage}</div> : null}
        <p className="mt-4 max-w-[70ch] whitespace-pre-wrap text-[16px] leading-[1.7]">{question.text}</p>
        {question.images.map((url, index) => <div className="relative mt-4 h-64 w-full overflow-hidden rounded-[12px] border border-line bg-white" key={url}><Image alt={`Figure ${index + 1} for question ${question.number}`} className="object-contain" fill sizes="(min-width: 1024px) 720px, 100vw" src={url} unoptimized /></div>)}
        {question.type === "NAT" ? <dl className="mt-5 grid max-w-md grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-line bg-line text-sm">
          <div className={`p-3 ${status === "wrong" ? "bg-[color:var(--bad-bg)]" : status === "correct" ? "bg-[color:var(--ok-bg)]" : "bg-panel"}`}><dt className="text-slate-400">Your answer</dt><dd className="tabular mt-1 text-lg font-medium">{answer ?? "Not answered"}</dd></div>
          <div className="bg-panel p-3"><dt className="text-slate-400">Correct answer</dt><dd className="tabular mt-1 text-lg font-medium">{result?.correctText || "No answer key"}</dd></div>
        </dl> : <ul className="mt-5 space-y-2">{question.options.map((option) => {
          const isCorrect = correctKeys.includes(option.key);
          const isChosen = picked.includes(option.key);
          return <li className={`flex items-center gap-3 rounded-[12px] border px-3 py-2.5 ${rowClass(isCorrect, isChosen)}`} key={option.key}>
            <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${letterClass(isCorrect, isChosen)}`}>{option.key}</span>
            <span className="min-w-0 flex-1 whitespace-pre-wrap text-[15px] leading-6">{option.text}</span>
            {isCorrect ? <span className="shrink-0 text-sm font-semibold text-[color:var(--ok-fg)]">Correct answer</span> : null}
            {isChosen && !isCorrect ? <span className="shrink-0 text-sm font-semibold text-[color:var(--bad-fg)]">Your answer</span> : null}
            {isChosen && isCorrect ? <span className="shrink-0 text-sm text-slate-400">(your answer)</span> : null}
          </li>;
        })}</ul>}
        {result?.explanation ? <div className="panel-sunken mt-4 p-4 text-sm leading-6"><p className="font-medium">Explanation</p><p className="mt-1 whitespace-pre-wrap text-slate-300">{result.explanation}</p></div> : null}
      </article>;
    })}</div> : <div className="empty-state mt-4"><p className="font-medium">Nothing in this filter</p></div>}
  </section>;
}
