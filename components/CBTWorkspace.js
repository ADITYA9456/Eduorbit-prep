"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Check, ChevronLeft, ChevronRight, Flag, RotateCcw, Send } from "lucide-react";

const DURATION_SECONDS = 3 * 60 * 60;
const AUTOSAVE_MS = 30 * 1000;
const LOADING = "Loading CBT…";

function endpointFor(resourceType) {
  return resourceType === "practice" ? "/api/practice" : "/api/cbt";
}

function bodyFor(resourceType, paperId, mode, extra) {
  return resourceType === "practice" ? { testId: paperId, ...extra } : { paperId, mode, ...extra };
}

function formatDuration(totalSeconds) {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? "" : "s"}`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function readJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function CBTWorkspace({ paper, authenticated, resourceType = "paper" }) {
  const [mode, setMode] = useState("PRACTICE");
  const [questions, setQuestions] = useState([]);
  const [questionCount, setQuestionCount] = useState(0);
  const [answers, setAnswers] = useState({});
  const [review, setReview] = useState({});
  const [current, setCurrent] = useState(0);
  const [seconds, setSeconds] = useState(DURATION_SECONDS);
  const [durationSeconds, setDurationSeconds] = useState(DURATION_SECONDS);
  const [deadlineAt, setDeadlineAt] = useState(null);
  const [questionTimeBudget, setQuestionTimeBudget] = useState(null);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState(LOADING);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const answersRef = useRef({});
  const versionRef = useRef(0);
  const savedVersionRef = useRef(0);
  const autosavingRef = useRef(false);
  const autoSubmitRef = useRef(false);
  const loadSeqRef = useRef(0);
  const clockOffsetRef = useRef(0);

  const timed = resourceType === "practice" || mode === "EXAM";
  const loading = status === LOADING;
  const timedActive = timed && Boolean(deadlineAt) && !result && !loading;
  const needsStart = timed && !deadlineAt && !result;
  const question = questions[current];
  const answered = useMemo(() => Object.keys(answers).filter((key) => answers[key]?.length || answers[key] === 0).length, [answers]);

  function applyServerTiming(payload) {
    if (payload.serverNow) clockOffsetRef.current = new Date(payload.serverNow).getTime() - Date.now();
    const deadline = payload.deadlineAt || payload.response?.deadline_at || null;
    setDeadlineAt(deadline);
    setSeconds(payload.response?.remaining_seconds ?? payload.durationSeconds ?? DURATION_SECONDS);
  }

  async function load(nextMode = mode) {
    const seq = ++loadSeqRef.current;
    setStatus(LOADING);
    const endpoint = resourceType === "practice" ? `/api/practice?testId=${paper.id}` : `/api/cbt?paperId=${paper.id}&mode=${nextMode}`;
    const response = await fetch(endpoint);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Unable to load CBT.");
    if (seq !== loadSeqRef.current) return;
    const nextTimed = resourceType === "practice" || nextMode === "EXAM";
    const started = Boolean(payload.response?.started_at || payload.response?.submitted_at);
    const loadedQuestions = payload.questions || payload.test?.questions || [];
    setQuestions(loadedQuestions);
    setQuestionCount(payload.questionCount ?? payload.test?.questionCount ?? loadedQuestions.length);
    let restoredAnswers = payload.response?.answers || {};
    let restoredFromLocal = false;
    if (!nextTimed || started) {
      const localAnswers = readJson(`eduorbit-cbt-${paper.id}-${nextMode}`);
      if (!Object.keys(restoredAnswers).length && localAnswers && typeof localAnswers === "object") {
        restoredAnswers = localAnswers;
        restoredFromLocal = true;
      }
    }
    const restoredReview = readJson(`eduorbit-cbt-review-${paper.id}-${nextMode}`);
    setReview(restoredReview && typeof restoredReview === "object" && !Array.isArray(restoredReview) ? restoredReview : {});
    setAnswers(restoredAnswers);
    answersRef.current = restoredAnswers;
    versionRef.current += 1;
    savedVersionRef.current = restoredFromLocal ? versionRef.current - 1 : versionRef.current;
    autoSubmitRef.current = false;
    setDurationSeconds(payload.durationSeconds ?? DURATION_SECONDS);
    applyServerTiming(payload);
    setQuestionTimeBudget(payload.questionTimeBudgetSeconds || null);
    setResult(payload.response?.result || null);
    setCurrent(0);
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
    if (!timedActive) return undefined;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - (Date.now() + clockOffsetRef.current)) / 1000));
      setSeconds(remaining);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timedActive, deadlineAt]);

  useEffect(() => {
    if (!timedActive || !questions.length || seconds > 0 || autoSubmitRef.current) return;
    autoSubmitRef.current = true;
    save(true, answersRef.current);
  }, [seconds, timedActive, questions.length]);

  useEffect(() => {
    if (!timedActive) return undefined;
    const endpoint = endpointFor(resourceType);
    const payloadFor = (submit) => bodyFor(resourceType, paper.id, mode, { answers: answersRef.current, submit });

    async function autosave() {
      if (autosavingRef.current || savedVersionRef.current === versionRef.current) return;
      autosavingRef.current = true;
      const sentVersion = versionRef.current;
      try {
        const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payloadFor(false)) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) return;
        savedVersionRef.current = sentVersion;
        if (payload.result) setResult(payload.result);
      } catch {
        // The next interval retries.
      } finally {
        autosavingRef.current = false;
      }
    }

    function flush() {
      if (savedVersionRef.current === versionRef.current) return;
      const sentVersion = versionRef.current;
      const body = JSON.stringify(payloadFor(false));
      let queued = false;
      try {
        queued = typeof navigator.sendBeacon === "function" && navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
      } catch {
        queued = false;
      }
      if (!queued) fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
      savedVersionRef.current = sentVersion;
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") flush();
    }

    function onBeforeUnload(event) {
      flush();
      event.preventDefault();
      event.returnValue = "";
    }

    const timer = window.setInterval(autosave, AUTOSAVE_MS);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [timedActive, resourceType, paper.id, mode]);

  async function save(submit = false, answerOverride = answersRef.current) {
    setSaving(true);
    const sentVersion = versionRef.current;
    try {
      const response = await fetch(endpointFor(resourceType), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyFor(resourceType, paper.id, mode, { answers: answerOverride, submit })) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save CBT response.");
      savedVersionRef.current = sentVersion;
      if (submit || payload.result) setResult(payload.result);
      setStatus(submit || payload.result ? "Submitted." : "Response saved.");
    } catch (error) {
      autoSubmitRef.current = false;
      setStatus(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function startAttempt() {
    setStarting(true);
    setStatus("");
    try {
      const response = await fetch(endpointFor(resourceType), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyFor(resourceType, paper.id, mode, { start: true })) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to start the test.");
      const restoredAnswers = payload.response?.answers || {};
      window.localStorage.removeItem(`eduorbit-cbt-${paper.id}-${mode}`);
      const startedQuestions = payload.questions || payload.test?.questions || [];
      setQuestions(startedQuestions);
      setQuestionCount(payload.questionCount ?? payload.test?.questionCount ?? startedQuestions.length);
      setAnswers(restoredAnswers);
      answersRef.current = restoredAnswers;
      versionRef.current += 1;
      savedVersionRef.current = versionRef.current;
      autoSubmitRef.current = false;
      setCurrent(0);
      if (payload.response?.submitted_at) {
        setResult(payload.result || payload.response.result || null);
      } else {
        applyServerTiming(payload);
      }
    } catch (error) {
      setStatus(error.message);
    } finally {
      setStarting(false);
    }
  }

  function choose(value) {
    if (result) return;
    const next = { ...answersRef.current, [question.number]: value };
    answersRef.current = next;
    versionRef.current += 1;
    window.localStorage.setItem(`eduorbit-cbt-${paper.id}-${mode}`, JSON.stringify(next));
    setAnswers(next);
  }

  function toggle(value) {
    const selected = Array.isArray(answers[question.number]) ? answers[question.number] : [];
    choose(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value].sort());
  }

  function toggleReview() {
    const next = { ...review, [question.number]: !review[question.number] };
    setReview(next);
    window.localStorage.setItem(`eduorbit-cbt-review-${paper.id}-${mode}`, JSON.stringify(next));
  }

  if (!authenticated || status === "Sign in to solve this CBT.") return <div className="card mt-8 p-6 text-slate-400">{status}</div>;
  if (loading) return <div className="card mt-8 p-6 text-slate-400">{status}</div>;
  const modeSwitch = <div className={resourceType === "practice" ? "hidden" : "flex gap-2"}><button className={mode === "PRACTICE" ? "button-primary" : "button-secondary"} onClick={() => { setMode("PRACTICE"); load("PRACTICE").catch((error) => setStatus(error.message)); }} type="button">Practice Mode</button><button className={mode === "EXAM" ? "button-primary" : "button-secondary"} onClick={() => { setMode("EXAM"); load("EXAM").catch((error) => setStatus(error.message)); }} type="button">Exam Mode</button></div>;
  if (!question && !needsStart) return <div className="card mt-8 p-6 text-amber-200">No extracted questions are available.</div>;
  if (needsStart) return <div className="mt-10">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="eyebrow">{questionCount} questions</p>{modeSwitch}</div>
    <div className="card mt-5 p-6">
      <h3 className="text-xl font-semibold">Ready to start?</h3>
      <p className="mt-2 text-slate-400">Duration: <b className="text-slate-200">{formatDuration(durationSeconds)}</b> · Questions: <b className="text-slate-200">{questionCount}</b></p>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-400">
        <li>The timer starts when you press Start test and keeps running on the server, even if you close this page.</li>
        <li>Your answers are saved automatically every 30 seconds while the test is running.</li>
        <li>The test is submitted automatically when time runs out. A submitted test cannot be changed.</li>
        <li>You can mark questions for review and move freely between questions.</li>
      </ul>
      <button className="button-primary mt-6" disabled={starting} onClick={startAttempt} type="button">{starting ? "Starting…" : "Start test"}</button>
      {status ? <p className="mt-4 text-sm text-red-300" role="status">{status}</p> : null}
    </div>
  </div>;
  const time = `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const questionImages = question.images || (question.imageUrl ? [{ url: question.imageUrl }] : []);
  return <div className="mt-10">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">{questions.length} questions</p><p className="mt-2 text-sm text-slate-500">{answered} answered, {Object.values(review).filter(Boolean).length} marked for review{questionTimeBudget ? `, Average pace ${Math.floor(questionTimeBudget / 60)}m ${Math.round(questionTimeBudget % 60)}s/question` : ""}</p></div><div className="flex items-center gap-3">{(resourceType === "practice" || mode === "EXAM") ? <span className={`rounded-xl border px-4 py-2 font-mono text-lg ${seconds < 300 ? "border-red-400/60 text-red-300" : "border-electric/40 text-electric"}`}>Time left {time}</span> : null}{modeSwitch}</div></div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_220px]"><div className="card p-6"><div className="flex items-center justify-between border-b border-line pb-4"><h3 className="text-xl font-semibold">Question {question.number} <span className="text-sm font-normal text-slate-500">({question.type}, {question.marks || 1} mark)</span></h3>{mode === "EXAM" ? <span className="font-mono text-electric">{time}</span> : null}</div><div className="prose prose-invert mt-6 max-w-none whitespace-pre-wrap text-slate-200">{question.text}</div>{questionImages.map((image, index) => <div className="relative mt-5 h-80 w-full" key={image.path || image.url || index}><Image alt={`Figure ${index + 1} for question ${question.number}`} className="rounded-xl object-contain" fill sizes="(min-width: 1024px) 720px, 100vw" src={image.url} unoptimized /></div>)}<div className="mt-7 space-y-3">{question.type === "NAT" ? <input className="field" disabled={Boolean(result)} type="number" value={answers[question.number] || ""} onChange={(event) => choose(event.target.value)} placeholder="Enter numerical answer" /> : question.options.map((option) => <label className="flex cursor-pointer gap-3 rounded-xl border border-line p-4 hover:border-electric/60" key={option.label}><input disabled={Boolean(result)} checked={question.type === "MSQ" ? (answers[question.number] || []).includes(option.label) : answers[question.number] === option.label} onChange={() => question.type === "MSQ" ? toggle(option.label) : choose(option.label)} type={question.type === "MSQ" ? "checkbox" : "radio"} name={`question-${question.number}`} /><span><b>{option.label}.</b> {option.text}</span></label>)}</div><div className="mt-7 flex flex-wrap justify-between gap-3"><button className="button-secondary" disabled={current === 0} onClick={() => setCurrent((value) => value - 1)} type="button"><ChevronLeft size={16} /> Previous</button><div className="flex gap-2"><button className="button-secondary" disabled={Boolean(result)} onClick={() => { choose(question.type === "MSQ" ? [] : ""); }} type="button"><RotateCcw size={15} /> Clear</button><button className="button-secondary" onClick={toggleReview} type="button"><Flag size={15} /> {review[question.number] ? "Unmark" : "Mark for review"}</button><button className="button-primary" disabled={saving || (Boolean(result) && current === questions.length - 1)} onClick={() => current === questions.length - 1 ? save(true) : setCurrent((value) => value + 1)} type="button">{current === questions.length - 1 ? <><Send size={15} /> Submit</> : <>Next <ChevronRight size={16} /></>}</button></div></div>{status && status !== "Submitted." ? <p className="mt-4 text-sm text-slate-500" role="status">{status}</p> : null}{result ? <div className="mt-5 rounded-xl border border-mint/30 bg-mint/10 p-4"><p className="font-semibold">Result{result.score !== null && result.score !== undefined ? `: ${result.score} marks` : ""}</p><p className="mt-1 text-sm text-slate-400">{result.correct} correct, {result.incorrect ?? result.details?.filter((detail) => detail.attempted && !detail.correct).length ?? 0} incorrect, {result.unattempted ?? (result.total - result.attempted)} unattempted{result.notEvaluated ? `, ${result.notEvaluated} not evaluated` : ""}</p><div className="mt-3 space-y-1 text-xs text-slate-500">{result.details?.map((detail) => <p key={detail.number}>Q{detail.number}: {detail.status || (detail.correct ? "CORRECT" : detail.attempted ? "INCORRECT" : "UNATTEMPTED")}{detail.correctAnswer !== null && detail.correctAnswer !== undefined ? `, Answer: ${Array.isArray(detail.correctAnswer) ? detail.correctAnswer.join(", ") : detail.correctAnswer}` : ""}</p>)}</div></div> : null}</div><aside className="card h-fit p-4"><p className="text-sm font-semibold">Question palette</p><div className="mt-4 grid grid-cols-5 gap-2">{questions.map((item, index) => <button className={`rounded-lg border p-2 text-sm ${index === current ? "border-electric bg-electric/20" : answers[item.number] ? "border-mint/60 bg-mint/10" : review[item.number] ? "border-amber-400/60 bg-amber-400/10" : "border-line"}`} key={item.number} onClick={() => setCurrent(index)} type="button">{item.number}</button>)}</div><button className="button-secondary mt-5 w-full" disabled={saving || Boolean(result)} onClick={() => save(false)} type="button"><Check size={15} /> Save response</button></aside></div>
  </div>;
}
