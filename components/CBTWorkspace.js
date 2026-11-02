"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Flag, RotateCcw, Send } from "lucide-react";

const DURATION_SECONDS = 3 * 60 * 60;

export default function CBTWorkspace({ paper, authenticated }) {
  const [mode, setMode] = useState("PRACTICE");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [review, setReview] = useState({});
  const [current, setCurrent] = useState(0);
  const [seconds, setSeconds] = useState(DURATION_SECONDS);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("Loading CBT...");
  const [saving, setSaving] = useState(false);
  const answersRef = useRef({});

  const question = questions[current];
  const answered = useMemo(() => Object.keys(answers).filter((key) => answers[key]?.length || answers[key] === 0).length, [answers]);

  async function load(nextMode = mode) {
    setStatus("Loading CBT...");
    const response = await fetch(`/api/cbt?paperId=${paper.id}&mode=${nextMode}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Unable to load CBT.");
    setQuestions(payload.questions || []);
    const localAnswers = window.localStorage.getItem(`eduorbit-cbt-${paper.id}-${nextMode}`);
    let restoredAnswers = payload.response?.answers || {};
    if (!payload.response?.answers && localAnswers) {
      try { restoredAnswers = JSON.parse(localAnswers); } catch { restoredAnswers = {}; }
    }
    setAnswers(restoredAnswers);
    answersRef.current = restoredAnswers;
    setSeconds(payload.response?.remaining_seconds ?? payload.durationSeconds ?? DURATION_SECONDS);
    setResult(payload.response?.result || null);
    setStatus("");
  }

  useEffect(() => {
    if (!authenticated) {
      setStatus("Sign in to solve this CBT.");
      return;
    }
    load().catch((error) => setStatus(error.message));
  }, [authenticated, paper.id]);

  useEffect(() => {
    if (mode !== "EXAM" || result || !questions.length) return undefined;
    const timer = window.setInterval(() => setSeconds((value) => {
      if (value <= 1) {
        window.clearInterval(timer);
        save(true, answersRef.current, 0);
        return 0;
      }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [mode, result, questions.length]);

  async function save(submit = false, answerOverride = answers, remainingOverride = seconds) {
    setSaving(true);
    try {
      const response = await fetch("/api/cbt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paperId: paper.id, mode, answers: answerOverride, remainingSeconds: remainingOverride, submit }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save CBT response.");
      if (submit) setResult(payload.result);
      setStatus(submit ? "Submitted." : "Response saved.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSaving(false);
    }
  }

  function choose(value) {
    setAnswers((currentAnswers) => {
      const next = { ...currentAnswers, [question.number]: value };
      answersRef.current = next;
      window.localStorage.setItem(`eduorbit-cbt-${paper.id}-${mode}`, JSON.stringify(next));
      return next;
    });
  }

  function toggle(value) {
    const selected = Array.isArray(answers[question.number]) ? answers[question.number] : [];
    choose(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value].sort());
  }

  if (!authenticated || status === "Sign in to solve this CBT.") return <div className="card mt-8 p-6 text-slate-400">{status}</div>;
  if (status === "Loading CBT...") return <div className="card mt-8 p-6 text-slate-400">{status}</div>;
  if (!question) return <div className="card mt-8 p-6 text-amber-200">No extracted questions are available.</div>;
  const time = `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return <div className="mt-10">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Interactive CBT · {questions.length} questions</p><p className="mt-2 text-sm text-slate-500">{answered} answered · {Object.values(review).filter(Boolean).length} marked for review</p></div><div className="flex gap-2"><button className={mode === "PRACTICE" ? "button-primary" : "button-secondary"} onClick={() => { setMode("PRACTICE"); load("PRACTICE").catch((error) => setStatus(error.message)); }} type="button">Practice Mode</button><button className={mode === "EXAM" ? "button-primary" : "button-secondary"} onClick={() => { setMode("EXAM"); load("EXAM").catch((error) => setStatus(error.message)); }} type="button">Exam Mode</button></div></div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_220px]"><div className="card p-6"><div className="flex items-center justify-between border-b border-line pb-4"><h3 className="text-xl font-semibold">Question {question.number} <span className="text-sm font-normal text-slate-500">({question.type} · {question.marks || 1} mark)</span></h3>{mode === "EXAM" ? <span className="font-mono text-electric">{time}</span> : null}</div><div className="prose prose-invert mt-6 max-w-none whitespace-pre-wrap text-slate-200">{question.text}</div>{question.imageUrl ? <img className="mt-5 max-h-80 rounded-xl object-contain" src={question.imageUrl} alt={`Figure for question ${question.number}`} /> : null}<div className="mt-7 space-y-3">{question.type === "NAT" ? <input className="field" type="number" value={answers[question.number] || ""} onChange={(event) => choose(event.target.value)} placeholder="Enter numerical answer" /> : question.options.map((option) => <label className="flex cursor-pointer gap-3 rounded-xl border border-line p-4 hover:border-electric/60" key={option.label}><input checked={question.type === "MSQ" ? (answers[question.number] || []).includes(option.label) : answers[question.number] === option.label} onChange={() => question.type === "MSQ" ? toggle(option.label) : choose(option.label)} type={question.type === "MSQ" ? "checkbox" : "radio"} name={`question-${question.number}`} /><span><b>{option.label}.</b> {option.text}</span></label>)}</div><div className="mt-7 flex flex-wrap justify-between gap-3"><button className="button-secondary" disabled={current === 0} onClick={() => setCurrent((value) => value - 1)} type="button"><ChevronLeft size={16} /> Previous</button><div className="flex gap-2"><button className="button-secondary" onClick={() => { choose(question.type === "MSQ" ? [] : ""); }} type="button"><RotateCcw size={15} /> Clear</button><button className="button-secondary" onClick={() => setReview((value) => ({ ...value, [question.number]: !value[question.number] }))} type="button"><Flag size={15} /> {review[question.number] ? "Unmark" : "Mark for review"}</button><button className="button-primary" disabled={saving} onClick={() => current === questions.length - 1 ? save(true) : setCurrent((value) => value + 1)} type="button">{current === questions.length - 1 ? <><Send size={15} /> Submit</> : <>Next <ChevronRight size={16} /></>}</button></div></div>{status && status !== "Submitted." ? <p className="mt-4 text-sm text-slate-500" role="status">{status}</p> : null}{result ? <div className="mt-5 rounded-xl border border-mint/30 bg-mint/10 p-4"><p className="font-semibold">Result: {result.score} marks</p><p className="mt-1 text-sm text-slate-400">{result.correct} correct of {result.total}; {result.attempted} attempted.</p></div> : null}</div><aside className="card h-fit p-4"><p className="text-sm font-semibold">Question palette</p><div className="mt-4 grid grid-cols-5 gap-2">{questions.map((item, index) => <button className={`rounded-lg border p-2 text-sm ${index === current ? "border-electric bg-electric/20" : answers[item.number] ? "border-mint/60 bg-mint/10" : review[item.number] ? "border-amber-400/60 bg-amber-400/10" : "border-line"}`} key={item.number} onClick={() => setCurrent(index)} type="button">{item.number}</button>)}</div><button className="button-secondary mt-5 w-full" disabled={saving} onClick={() => save(false)} type="button"><Check size={15} /> Save response</button></aside></div>
  </div>;
}
