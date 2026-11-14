"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, Lock, Save, StickyNote } from "lucide-react";
import dynamic from "next/dynamic";
import LoadingExperience from "@/components/LoadingExperience";

// Only one of these renders per paper, so load whichever is needed on demand.
const ExamMode = dynamic(() => import("@/components/ExamMode"), { loading: () => <LoadingExperience message="Loading exam mode…" /> });
const CBTWorkspace = dynamic(() => import("@/components/CBTWorkspace"), { loading: () => <LoadingExperience message="Loading the test…" /> });

export default function PaperWorkspace({ paper, authenticated }) {
  const [state, setState] = useState({ paper: null, questions: [], notes: [] });
  const [saving, setSaving] = useState(false);
  const [savingMessage, setSavingMessage] = useState("Saving your progress…");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(authenticated);
  const [questionSaveState, setQuestionSaveState] = useState("");
  const questionQueue = useRef(new Map());
  const questionSaving = useRef(false);
  const retryTimeout = useRef(null);

  useEffect(() => () => {
    if (retryTimeout.current) window.clearTimeout(retryTimeout.current);
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    fetch(`/api/progress?paperId=${paper.id}`)
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load progress");
        return response.json();
      })
      .then(setState)
      .catch(() => setError("Your saved progress could not be loaded. Reload the page to try again."))
      .finally(() => setLoading(false));
  }, [authenticated, paper.id]);

  const completed = state.paper?.is_completed;

  async function save(payload) {
    if (saving) return;
    setSavingMessage(payload.content !== undefined ? "Saving your notes…" : "Saving your progress…");
    setSaving(true);
    setError("");
    try {
      const result = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId: paper.id, ...payload })
      });
      if (!result.ok) throw new Error("Unable to save progress");
      setState((current) => {
        if (payload.content !== undefined) {
          const nextNotes = current.notes.filter((note) => note.question_number !== Number(payload.questionNumber));
          if (String(payload.content).trim()) {
            nextNotes.push({
              question_number: Number(payload.questionNumber),
              content: String(payload.content).trim()
            });
          }
          return { ...current, notes: nextNotes };
        }
        return {
          ...current,
          paper: { ...current.paper, is_completed: Boolean(payload.isCompleted) }
        };
      });
    } catch {
      setError("That change was not saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function saveQuestion(number, isCompleted) {
    if (!authenticated) return;
    setState((current) => {
      const questions = current.questions.filter((question) => question.question_number !== number);
      return { ...current, questions: [...questions, { question_number: number, is_completed: isCompleted }] };
    });
    questionQueue.current.set(number, isCompleted);
    setQuestionSaveState("Saving changes…");
    flushQuestionQueue();
  }

  async function flushQuestionQueue() {
    if (questionSaving.current || !questionQueue.current.size) return;
    questionSaving.current = true;
    const pending = new Map(questionQueue.current);
    questionQueue.current.clear();
    try {
      await Promise.all([...pending.entries()].map(async ([questionNumber, isCompleted]) => {
        const response = await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paperId: paper.id, questionNumber, isCompleted })
        });
        if (!response.ok) throw new Error("Unable to save question progress");
      }));
      setQuestionSaveState(questionQueue.current.size ? "Saving changes…" : "Saved");
    } catch {
      for (const [questionNumber, isCompleted] of pending) questionQueue.current.set(questionNumber, isCompleted);
      setQuestionSaveState("Could not save, retrying…");
    } finally {
      questionSaving.current = false;
      if (questionQueue.current.size && !retryTimeout.current) {
        retryTimeout.current = window.setTimeout(() => {
          retryTimeout.current = null;
          flushQuestionQueue();
        }, 1200);
      }
    }
  }

  const isQuestionDone = (number) => state.questions.some((question) => question.question_number === number && question.is_completed);

  const doneCount = state.questions.filter((question) => question.is_completed).length;
  return (
    <section className="shell py-10 sm:py-14">
      <nav aria-label="Breadcrumb" className="crumbs"><Link href="/exams">Paper library</Link><span aria-hidden="true" className="sep">/</span><span aria-current="page" className="truncate text-foreground">{paper.title}</span></nav>
      <header className="mt-8 flex flex-col justify-between gap-6 border-b border-line pb-8 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow"><span className="tabular">{paper.year}</span>{paper.shift ? `, ${paper.shift}` : ""}</p>
          <h1 className="page-title mt-2 max-w-3xl">{paper.title}</h1>
          <p className="lede mt-3">{paper.description || "Work through this paper at your own pace. Your progress stays private to your account."}</p>
        </div>
        {authenticated ? <button aria-pressed={Boolean(completed)} className={completed ? "button-secondary shrink-0 border-[color:var(--ok-border)] text-[color:var(--ok-fg)]" : "button-primary shrink-0"} disabled={saving} onClick={() => save({ isCompleted: !completed })} type="button">{completed ? <Check aria-hidden="true" size={16} /> : null}{completed ? "Completed" : "Mark as completed"}</button> : <Link className="button-secondary shrink-0" href="/login"><Lock aria-hidden="true" size={15} /> Sign in to track progress</Link>}
      </header>
      {loading ? <div aria-busy="true" aria-label="Loading your progress" className="mt-6 flex gap-3"><span className="skeleton h-10 w-36" /><span className="skeleton h-10 w-36" /><span className="skeleton h-10 w-28" /></div> : null}
      {error ? <div className="notice-error mt-6 flex flex-wrap items-center justify-between gap-3" role="alert"><span>{error}</span><button className="button-danger btn-sm" onClick={() => window.location.reload()} type="button">Reload</button></div> : null}
      <div className="mt-6 flex flex-wrap gap-2">{[["Official paper", paper.officialPaperUrl], ["Official solution", paper.officialSolutionUrl], ["PDF link", paper.externalPdfUrl]].map(([label, url]) => url ? <a className="button-secondary" href={url} target="_blank" rel="noopener noreferrer" key={label}>{label} <ExternalLink aria-hidden="true" size={14} /><span className="sr-only">(opens in a new tab)</span></a> : <span className="badge h-10 px-4 text-slate-400" key={label}>{label} not available</span>)}</div>
      {saving ? <p className="mt-3 text-sm text-slate-400" role="status">{savingMessage}</p> : null}
      {paper.cbt ? <CBTWorkspace paper={paper} authenticated={authenticated} /> : <><ExamMode paper={paper} authenticated={authenticated} />{paper.questionCount ? <div className="mt-14"><div className="flex flex-wrap items-baseline justify-between gap-3"><h2 className="section-title">Question checklist</h2><p className="text-sm text-slate-400"><span className="tabular text-foreground">{doneCount} of {paper.questionCount}</span> done{questionSaveState ? <span role="status">, {questionSaveState.toLowerCase()}</span> : null}</p></div>{!authenticated ? <p className="mt-2 text-sm text-slate-400">Sign in to tick off questions as you finish them.</p> : null}<div className="mt-5 grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10">{Array.from({ length: paper.questionCount }, (_, index) => index + 1).map((number) => { const done = isQuestionDone(number); return <label className={`relative flex h-11 cursor-pointer select-none items-center justify-center rounded-[10px] border text-sm transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color:var(--accent)] ${done ? "border-[color:var(--ok-border)] bg-[color:var(--ok-bg)] text-[color:var(--ok-fg)]" : "border-line hover:border-[color:var(--border-strong)]"} ${authenticated ? "" : "cursor-not-allowed opacity-60"}`} key={number}><input aria-label={`Question ${number} done`} className="sr-only" type="checkbox" checked={done} disabled={!authenticated} onChange={(event) => saveQuestion(number, event.target.checked)} /><span className="tabular">{number}</span>{done ? <Check aria-hidden="true" className="absolute right-1 top-1" size={10} strokeWidth={2.5} /> : null}</label>; })}</div></div> : <div className="empty-state mt-14 max-w-xl"><p className="font-medium">Question checklist not set up</p><p className="mt-1 text-sm text-slate-400">It appears once an administrator adds the question count for this paper.</p></div>}</>}
      <div className="panel mt-14 p-6 sm:p-8"><div className="flex items-start gap-3"><StickyNote aria-hidden="true" className="mt-0.5 text-slate-400" size={18} strokeWidth={1.75} /><div><h2 className="section-title">My notes</h2><p className="mt-1 text-sm text-slate-400">Private notes attached to a question in this paper.</p></div></div>{authenticated && paper.questionCount ? <NoteEditor questionCount={paper.questionCount} notes={state.notes} save={save} saving={saving} /> : <p className="mt-5 text-sm text-slate-400">{authenticated ? "Notes become available once this paper has a question count." : "Sign in to keep notes beside each question."}</p>}</div>
    </section>
  );
}

function NoteEditor({ questionCount, notes, save, saving }) {
  const [questionNumber, setQuestionNumber] = useState(1);
  const current = notes.find((note) => note.question_number === Number(questionNumber));
  const [content, setContent] = useState(current?.content || "");
  useEffect(() => setContent(current?.content || ""), [questionNumber, current?.content]);
  return <div className="mt-6 flex flex-col gap-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="block sm:w-48"><span className="field-label">Question</span><select className="field" value={questionNumber} onChange={(event) => setQuestionNumber(event.target.value)}>{Array.from({ length: questionCount }, (_, index) => <option key={index + 1} value={index + 1}>Question {index + 1}</option>)}</select></label><button className="button-secondary" disabled={saving} onClick={() => save({ questionNumber: Number(questionNumber), content })} type="button"><Save aria-hidden="true" size={15} /> Save note</button></div><label className="block"><span className="sr-only">Note for question {questionNumber}</span><textarea className="field min-h-32" maxLength={5000} value={content} onChange={(event) => setContent(event.target.value)} placeholder="What did you learn, or want to revisit?" /></label><p className="tabular text-right text-xs text-slate-400">{content.length} / 5000</p></div>;
}
