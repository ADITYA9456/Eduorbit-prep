"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Check, ChevronLeft, ChevronRight, Flag, RotateCcw, Send } from "lucide-react";

const DURATION_SECONDS = 3 * 60 * 60;

export default function CBTWorkspace({ paper, authenticated, resourceType = "paper" }) {
  const [mode, setMode] = useState("PRACTICE");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [review, setReview] = useState({});
  const [current, setCurrent] = useState(0);
  const [seconds, setSeconds] = useState(DURATION_SECONDS);
  const [deadlineAt, setDeadlineAt] = useState(null);
  const [questionTimeBudget, setQuestionTimeBudget] = useState(null);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("Loading CBT…");
  const [saving, setSaving] = useState(false);
  const answersRef = useRef({});

  const question = questions[current];
  const answered = useMemo(() => Object.keys(answers).filter((key) => answers[key]?.length || answers[key] === 0).length, [answers]);

  async function load(nextMode = mode) {
    setStatus("Loading CBT…");
    const endpoint = resourceType === "practice" ? `/api/practice?testId=${paper.id}` : `/api/cbt?paperId=${paper.id}&mode=${nextMode}`;
    const response = await fetch(endpoint);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Unable to load CBT.");
    setQuestions(payload.questions || payload.test?.questions || []);
    const localAnswers = window.localStorage.getItem(`eduorbit-cbt-${paper.id}-${nextMode}`);
    let restoredAnswers = payload.response?.answers || {};
    if (!payload.response?.answers && localAnswers) {
      try { restoredAnswers = JSON.parse(localAnswers); } catch { restoredAnswers = {}; }
    }
    setAnswers(restoredAnswers);
    answersRef.current = restoredAnswers;
    setSeconds(payload.response?.remaining_seconds ?? payload.durationSeconds ?? DURATION_SECONDS);
    setDeadlineAt(payload.deadlineAt || payload.response?.deadline_at || null);
    setQuestionTimeBudget(payload.questionTimeBudgetSeconds || null);
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
    if ((resourceType !== "practice" && mode !== "EXAM") || result || !questions.length) return undefined;
    const timer = window.setInterval(() => setSeconds((value) => {
      if (value <= 1) {
        window.clearInterval(timer);
        save(true, answersRef.current, 0);
        return 0;
      }
      if (resourceType === "practice" && deadlineAt) {
        return Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - Date.now()) / 1000));
      }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [mode, result, questions.length, resourceType, deadlineAt]);

  async function save(submit = false, answerOverride = answers, remainingOverride = seconds) {
    setSaving(true);
    try {
      const endpoint = resourceType === "practice" ? "/api/practice" : "/api/cbt";
      const body = resourceType === "practice" ? { testId: paper.id, answers: answerOverride, remainingSeconds: remainingOverride, submit } : { paperId: paper.id, mode, answers: answerOverride, remainingSeconds: remainingOverride, submit };
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
  if (status === "Loading CBT…") return <div className="card mt-8 p-6 text-slate-400">{status}</div>;
  if (!question) return <div className="card mt-8 p-6 text-amber-200">No extracted questions are available.</div>;
  const time = `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const questionImages = question.images || (question.imageUrl ? [{ url: question.imageUrl }] : []);
  return <div className="mt-10">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">{questions.length} questions</p><p className="mt-2 text-sm text-slate-500">{answered} answered, {Object.values(review).filter(Boolean).length} marked for review{questionTimeBudget ? `, Average pace ${Math.floor(questionTimeBudget / 60)}m ${Math.round(questionTimeBudget % 60)}s/question` : ""}</p></div><div className="flex items-center gap-3">{(resourceType === "practice" || mode === "EXAM") ? <span className={`rounded-xl border px-4 py-2 font-mono text-lg ${seconds < 300 ? "border-red-400/60 text-red-300" : "border-electric/40 text-electric"}`}>Time left {time}</span> : null}<div className="flex gap-2"><button className={mode === "PRACTICE" ? "button-primary" : "button-secondary"} onClick={() => { setMode("PRACTICE"); load("PRACTICE").catch((error) => setStatus(error.message)); }} type="button">Practice Mode</button><button className={mode === "EXAM" ? "button-primary" : "button-secondary"} onClick={() => { setMode("EXAM"); load("EXAM").catch((error) => setStatus(error.message)); }} type="button">Exam Mode</button></div></div></div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_220px]"><div className="card p-6"><div className="flex items-center justify-between border-b border-line pb-4"><h3 className="text-xl font-semibold">Question {question.number} <span className="text-sm font-normal text-slate-500">({question.type}, {question.marks || 1} mark)</span></h3>{mode === "EXAM" ? <span className="font-mono text-electric">{time}</span> : null}</div><div className="prose prose-invert mt-6 max-w-none whitespace-pre-wrap text-slate-200">{question.text}</div>{questionImages.map((image, index) => <div className="relative mt-5 h-80 w-full" key={image.path || image.url || index}><Image alt={`Figure ${index + 1} for question ${question.number}`} className="rounded-xl object-contain" fill sizes="(min-width: 1024px) 720px, 100vw" src={image.url} unoptimized /></div>)}<div className="mt-7 space-y-3">{question.type === "NAT" ? <input className="field" type="number" value={answers[question.number] || ""} onChange={(event) => choose(event.target.value)} placeholder="Enter numerical answer" /> : question.options.map((option) => <label className="flex cursor-pointer gap-3 rounded-xl border border-line p-4 hover:border-electric/60" key={option.label}><input checked={question.type === "MSQ" ? (answers[question.number] || []).includes(option.label) : answers[question.number] === option.label} onChange={() => question.type === "MSQ" ? toggle(option.label) : choose(option.label)} type={question.type === "MSQ" ? "checkbox" : "radio"} name={`question-${question.number}`} /><span><b>{option.label}.</b> {option.text}</span></label>)}</div><div className="mt-7 flex flex-wrap justify-between gap-3"><button className="button-secondary" disabled={current === 0} onClick={() => setCurrent((value) => value - 1)} type="button"><ChevronLeft size={16} /> Previous</button><div className="flex gap-2"><button className="button-secondary" onClick={() => { choose(question.type === "MSQ" ? [] : ""); }} type="button"><RotateCcw size={15} /> Clear</button><button className="button-secondary" onClick={() => setReview((value) => ({ ...value, [question.number]: !value[question.number] }))} type="button"><Flag size={15} /> {review[question.number] ? "Unmark" : "Mark for review"}</button><button className="button-primary" disabled={saving} onClick={() => current === questions.length - 1 ? save(true) : setCurrent((value) => value + 1)} type="button">{current === questions.length - 1 ? <><Send size={15} /> Submit</> : <>Next <ChevronRight size={16} /></>}</button></div></div>{status && status !== "Submitted." ? <p className="mt-4 text-sm text-slate-500" role="status">{status}</p> : null}{result ? <div className="mt-5 rounded-xl border border-mint/30 bg-mint/10 p-4"><p className="font-semibold">Result{result.score !== null && result.score !== undefined ? `: ${result.score} marks` : ""}</p><p className="mt-1 text-sm text-slate-400">{result.correct} correct, {result.incorrect} incorrect, {result.unattempted} unattempted, {result.notEvaluated} not evaluated</p><div className="mt-3 space-y-1 text-xs text-slate-500">{result.details?.map((detail) => <p key={detail.number}>Q{detail.number}: {detail.status}{detail.correctAnswer !== null && detail.correctAnswer !== undefined ? `, Answer: ${Array.isArray(detail.correctAnswer) ? detail.correctAnswer.join(", ") : detail.correctAnswer}` : ""}</p>)}</div></div> : null}</div><aside className="card h-fit p-4"><p className="text-sm font-semibold">Question palette</p><div className="mt-4 grid grid-cols-5 gap-2">{questions.map((item, index) => <button className={`rounded-lg border p-2 text-sm ${index === current ? "border-electric bg-electric/20" : answers[item.number] ? "border-mint/60 bg-mint/10" : review[item.number] ? "border-amber-400/60 bg-amber-400/10" : "border-line"}`} key={item.number} onClick={() => setCurrent(index)} type="button">{item.number}</button>)}</div><button className="button-secondary mt-5 w-full" disabled={saving} onClick={() => save(false)} type="button"><Check size={15} /> Save response</button></aside></div>
  </div>;
}
