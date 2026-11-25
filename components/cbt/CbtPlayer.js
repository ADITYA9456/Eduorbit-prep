"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, LazyMotion, m, useReducedMotion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, CircleHelp, Clock, Delete, Flag, LayoutGrid, Loader2, RotateCcw, TriangleAlert, X } from "lucide-react";
import CbtReview from "@/components/cbt/CbtReview";
import { formatDuration as formatTime, formatMarks, isAnswered } from "@/lib/cbtSetShared";

// Animation features load after first paint; until then m.* render as plain elements.
const loadMotionFeatures = () => import("@/components/cbt/motionFeatures").then((module) => module.default);
const EASE = [0.25, 0.8, 0.3, 1];
const NAT_PATTERN = /^-?\d+(\.\d+)?$/;
const TYPE_NAME = { MCQ: "Multiple choice", MSQ: "Multiple select", NAT: "Numerical answer" };

function pickedKeys(answer) {
  return Array.isArray(answer) ? answer : answer ? [answer] : [];
}

// Visual state of one option. `check` is the server's grading of the question (study mode, after checking).
function optionState(optionKey, answer, check) {
  const isChosen = pickedKeys(answer).includes(optionKey);
  if (!check) return isChosen ? "picked" : "idle";
  if (!check.correct) return isChosen ? "chosen" : "idle";
  if (check.correct.keys?.includes(optionKey)) return isChosen ? "correct" : "answer";
  return isChosen ? "wrong" : "idle";
}

// Option row styling per state. Colour is always paired with an icon and text.
const ROW = {
  idle: "border-line bg-panel",
  chosen: "border-electric bg-panel",
  picked: "border-electric bg-electric/10",
  correct: "border-[color:var(--ok-border)] bg-[color:var(--ok-bg)]",
  answer: "border-[color:var(--ok-border)] bg-[color:var(--ok-bg)]",
  wrong: "border-[color:var(--bad-border)] bg-[color:var(--bad-bg)]"
};
const LETTER = {
  idle: "border-[color:var(--border-strong)] text-slate-300",
  chosen: "border-electric bg-electric text-[color:var(--accent-foreground)]",
  picked: "border-electric bg-electric text-[color:var(--accent-foreground)]",
  correct: "border-transparent bg-mint text-[color:var(--background)]",
  answer: "border-transparent bg-mint text-[color:var(--background)]",
  wrong: "border-transparent bg-danger text-[color:var(--background)]"
};

function StateLabel({ state }) {
  if (state === "correct") return <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[color:var(--ok-fg)]"><Check aria-hidden="true" size={16} strokeWidth={2.5} />Correct</span>;
  if (state === "answer") return <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[color:var(--ok-fg)]"><Check aria-hidden="true" size={16} strokeWidth={2.5} />Correct answer</span>;
  if (state === "wrong") return <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[color:var(--bad-fg)]"><X aria-hidden="true" size={16} strokeWidth={2.5} />Wrong</span>;
  if (state === "chosen") return <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-slate-400"><CircleHelp aria-hidden="true" size={16} />No answer key</span>;
  return null;
}

function tileState(item, answers, visited, isCurrent, exam, flagged, checks) {
  const answered = isAnswered(answers[item.id]);
  if (exam) {
    if (flagged[item.id]) return "flagged";
    if (answered) return "answered";
    if (isCurrent) return "current";
    return visited.has(item.id) ? "visited" : "idle";
  }
  const status = checks[item.id]?.status;
  if (status === "correct") return "correct";
  if (status === "wrong") return "wrong";
  if (answered) return "answered";
  if (isCurrent) return "current";
  return visited.has(item.id) ? "visited" : "idle";
}

const TILE = {
  idle: "border-line text-slate-400",
  visited: "border-[color:var(--border-strong)] text-slate-300",
  current: "border-electric text-foreground",
  answered: "border-electric/60 bg-electric/10 text-foreground",
  flagged: "border-[color:var(--warn-fg)] bg-electric/5 text-foreground",
  correct: "border-[color:var(--ok-border)] bg-[color:var(--ok-bg)] text-[color:var(--ok-fg)]",
  wrong: "border-[color:var(--bad-border)] bg-[color:var(--bad-bg)] text-[color:var(--bad-fg)]"
};
const TILE_LABEL = { idle: "not visited", visited: "not answered", current: "current", answered: "answered", flagged: "marked for review", correct: "correct", wrong: "wrong" };

function Palette({ questions, answers, visited, index, onPick, exam = false, flagged = {}, checks = {} }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {questions.map((item, itemIndex) => {
        const isCurrent = itemIndex === index;
        const state = tileState(item, answers, visited, isCurrent, exam, flagged, checks);
        return (
          <button
            aria-current={isCurrent ? "step" : undefined}
            aria-label={`Question ${item.number}, ${TILE_LABEL[state]}${isCurrent && state !== "current" ? ", current" : ""}`}
            className={`tabular relative flex h-11 items-center justify-center rounded-[10px] border text-sm transition-colors duration-150 hover:border-[color:var(--border-strong)] ${TILE[state]} ${isCurrent ? "ring-2 ring-electric ring-offset-2 ring-offset-[color:var(--surface)]" : ""}`}
            key={item.id}
            onClick={() => onPick(itemIndex)}
            type="button"
          >
            {item.number}
            {state === "flagged" ? <Flag aria-hidden="true" className="absolute right-1 top-1" size={10} strokeWidth={2.5} /> : state === "correct" ? <Check aria-hidden="true" className="absolute right-1 top-1" size={10} strokeWidth={2.5} /> : state === "wrong" ? <X aria-hidden="true" className="absolute right-1 top-1" size={10} strokeWidth={2.5} /> : null}
          </button>
        );
      })}
    </div>
  );
}

// Owns its own tick so the question screen does not re-render every second.
function ElapsedTimer({ startedAt }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return undefined;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  return <span className="tabular">{formatTime(startedAt ? (now - startedAt) / 1000 : 0)}</span>;
}

function Countdown({ startedAt, limitSeconds, onExpire }) {
  const [now, setNow] = useState(() => Date.now());
  const expireRef = useRef(onExpire);
  const firedRef = useRef(false);
  expireRef.current = onExpire;
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  const remaining = Math.max(0, Math.ceil(limitSeconds - (now - startedAt) / 1000));
  useEffect(() => {
    if (remaining > 0 || firedRef.current) return;
    firedRef.current = true;
    expireRef.current();
  }, [remaining]);
  return <span className={`tabular ${remaining <= 300 ? "text-[color:var(--bad-fg)]" : ""}`}>{formatTime(remaining)}</span>;
}

function Legend({ exam = false }) {
  if (exam) {
    return (
      <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-slate-400">
        <li className="flex items-center gap-2"><span aria-hidden="true" className="h-4 w-4 rounded border border-electric/60 bg-electric/10" />Answered</li>
        <li className="flex items-center gap-2"><span aria-hidden="true" className="flex h-4 w-4 items-center justify-center rounded border border-[color:var(--warn-fg)] bg-electric/5"><Flag size={9} strokeWidth={3} /></span>Marked</li>
        <li className="flex items-center gap-2"><span aria-hidden="true" className="h-4 w-4 rounded border border-[color:var(--border-strong)]" />Not answered</li>
        <li className="flex items-center gap-2"><span aria-hidden="true" className="h-4 w-4 rounded border border-line" />Not visited</li>
      </ul>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-slate-400">
      <li className="flex items-center gap-2"><span aria-hidden="true" className="flex h-4 w-4 items-center justify-center rounded border border-[color:var(--ok-border)] bg-[color:var(--ok-bg)] text-[color:var(--ok-fg)]"><Check size={9} strokeWidth={3} /></span>Correct</li>
      <li className="flex items-center gap-2"><span aria-hidden="true" className="flex h-4 w-4 items-center justify-center rounded border border-[color:var(--bad-border)] bg-[color:var(--bad-bg)] text-[color:var(--bad-fg)]"><X size={9} strokeWidth={3} /></span>Wrong</li>
      <li className="flex items-center gap-2"><span aria-hidden="true" className="h-4 w-4 rounded border border-electric/60 bg-electric/10" />Answered</li>
      <li className="flex items-center gap-2"><span aria-hidden="true" className="h-4 w-4 rounded border border-line" />Not answered</li>
    </ul>
  );
}

// Numerical answer entry with an on-screen keypad, like the GATE virtual keypad.
function NatInput({ value, onChange, disabled, label }) {
  const text = value ?? "";
  const valid = text === "" || NAT_PATTERN.test(text);
  function press(key) {
    if (disabled) return;
    if (key === "back") return onChange(text.slice(0, -1));
    if (key === "clear") return onChange("");
    if (key === "-") return onChange(text.startsWith("-") ? text.slice(1) : `-${text}`);
    if (key === "." && text.includes(".")) return;
    if (text.length >= 16) return;
    onChange(text + key);
  }
  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", ".", "-"];
  return <div className="max-w-xs">
    <label className="block"><span className="field-label">{label}</span>
      <input aria-invalid={!valid} autoComplete="off" className="field tabular text-lg" disabled={disabled} inputMode="decimal" onChange={(event) => { if (/^-?\d*\.?\d*$/.test(event.target.value)) onChange(event.target.value); }} placeholder="Type a number" value={text} />
    </label>
    {!valid ? <p className="mt-1 text-xs text-[color:var(--bad-fg)]" role="alert">Enter a valid number, for example 4.5 or -2.</p> : null}
    <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Number keypad">
      {keys.map((key) => <button className="button-secondary tabular h-11 justify-center" disabled={disabled} key={key} onClick={() => press(key)} type="button">{key === "-" ? "+/âˆ’" : key}</button>)}
      <button aria-label="Backspace" className="button-secondary h-11 justify-center" disabled={disabled} onClick={() => press("back")} type="button"><Delete aria-hidden="true" size={16} /></button>
      <button className="button-ghost col-span-2 h-11 justify-center" disabled={disabled} onClick={() => press("clear")} type="button">Clear</button>
    </div>
  </div>;
}

export default function CbtPlayer({ set, authenticated }) {
  const questions = set.questions;
  const limitSeconds = (set.durationMinutes || Math.max(10, questions.length * 2)) * 60;
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [checks, setChecks] = useState({});
  const [checking, setChecking] = useState(null);
  const [checkError, setCheckError] = useState("");
  const [flagged, setFlagged] = useState({});
  const [violations, setViolations] = useState(0);
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState(null);
  const [attemptId, setAttemptId] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [visited, setVisited] = useState(() => new Set(questions[0] ? [questions[0].id] : []));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [duration, setDuration] = useState(0);
  const reduceMotion = useReducedMotion();
  const storageKey = `eduorbit-cbt-${set.id}`;
  const stateRef = useRef({});
  stateRef.current = { index, answers, checks, finished, confirmOpen, mode, violations, startedAt };
  const finishingRef = useRef(false);
  const sheetButtonRef = useRef(null);
  const sheetRef = useRef(null);

  const exam = mode === "EXAM";
  const question = questions[index];
  const answer = question ? answers[question.id] : undefined;
  const check = question ? checks[question.id] : undefined;
  const answeredCount = questions.filter((item) => isAnswered(answers[item.id])).length;
  const flaggedCount = Object.values(flagged).filter(Boolean).length;
  const locked = !exam && Boolean(check);

  const runCheck = useCallback(async (questionId, value) => {
    setChecking(questionId);
    setCheckError("");
    try {
      const response = await fetch(`/api/cbt-sets/${set.id}/check`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId, answer: value }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not check this answer.");
      setChecks((current) => ({ ...current, [questionId]: payload.check }));
    } catch (error) {
      setCheckError(error.message || "Could not check this answer. Try again.");
    } finally {
      setChecking(null);
    }
  }, [set.id]);

  function setAnswer(questionId, value) {
    setAnswers((current) => {
      if (!isAnswered(value)) {
        const { [questionId]: removed, ...rest } = current;
        return rest;
      }
      return { ...current, [questionId]: value };
    });
  }

  // Click or keyboard choice on an option. MCQ replaces, MSQ toggles.
  const select = useCallback((optionKey) => {
    const { index: currentIndex, answers: currentAnswers, checks: currentChecks, finished: isFinished, mode: currentMode } = stateRef.current;
    const current = questions[currentIndex];
    if (isFinished || !currentMode || !current || current.type === "NAT") return;
    if (!current.options.some((option) => option.key === optionKey)) return;
    const examMode = currentMode === "EXAM";
    if (!examMode && currentChecks[current.id]) return; // study mode: a checked question is locked
    const existing = currentAnswers[current.id];
    let next;
    if (current.type === "MSQ") {
      const keys = pickedKeys(existing);
      next = (keys.includes(optionKey) ? keys.filter((key) => key !== optionKey) : [...keys, optionKey]).sort();
    } else if (examMode && existing === optionKey) {
      next = null;
    } else {
      next = optionKey;
    }
    setAnswers((all) => {
      if (!isAnswered(next)) {
        const { [current.id]: removed, ...rest } = all;
        return rest;
      }
      return { ...all, [current.id]: next };
    });
    if (!examMode && current.type === "MCQ" && next) runCheck(current.id, next); // MCQ gives instant feedback
  }, [questions, runCheck]);

  const move = useCallback((delta) => {
    setIndex((value) => Math.min(questions.length - 1, Math.max(0, value + delta)));
  }, [questions.length]);

  function clearAnswer() {
    if (question && !locked) setAnswer(question.id, null);
  }

  function toggleFlag() {
    if (!question) return;
    setFlagged((current) => ({ ...current, [question.id]: !current[question.id] }));
  }

  function checkNow() {
    if (!question || locked || !isAnswered(answer)) return;
    if (question.type === "NAT" && !NAT_PATTERN.test(String(answer))) return setCheckError("Enter a valid number before checking.");
    runCheck(question.id, answer);
  }

  function begin(nextMode) {
    finishingRef.current = false;
    setMode(nextMode);
    setAnswers({});
    setChecks({});
    setFlagged({});
    setViolations(0);
    setIndex(0);
    setVisited(new Set(questions[0] ? [questions[0].id] : []));
    setStartedAt(Date.now());
  }

  // Resume an unfinished attempt after a refresh. Otherwise the student picks a mode first.
  useEffect(() => {
    let saved = null;
    try { saved = JSON.parse(window.sessionStorage.getItem(storageKey) || "null"); } catch { saved = null; }
    const byId = new Map(questions.map((item) => [item.id, item]));
    if (saved && saved.answers && typeof saved.startedAt === "number") {
      const restored = Object.fromEntries(Object.entries(saved.answers).filter(([id, value]) => byId.has(id) && isAnswered(value)));
      const restoredIndex = Math.min(questions.length - 1, Math.max(0, Number(saved.index) || 0));
      setAnswers(restored);
      setChecks(Object.fromEntries(Object.entries(saved.checks || {}).filter(([id]) => byId.has(id))));
      setFlagged(Object.fromEntries(Object.entries(saved.flagged || {}).filter(([id, value]) => byId.has(id) && value)));
      setViolations(Math.max(0, Number(saved.violations) || 0));
      setIndex(restoredIndex);
      setVisited(new Set([...Object.keys(restored), questions[restoredIndex]?.id].filter(Boolean)));
      setStartedAt(saved.startedAt);
      setMode(saved.mode === "EXAM" ? "EXAM" : "STUDY");
    }
    setReady(true);
  }, [storageKey, questions]);

  useEffect(() => {
    if (!startedAt || !mode) return;
    try {
      if (finished) window.sessionStorage.removeItem(storageKey);
      else window.sessionStorage.setItem(storageKey, JSON.stringify({ answers, checks, index, startedAt, mode, flagged, violations }));
    } catch { /* storage unavailable: the test still works, it just will not resume */ }
  }, [answers, checks, index, startedAt, mode, flagged, violations, finished, storageKey]);

  // Track which questions have been opened, for the palette's "not answered" state.
  useEffect(() => {
    const id = questions[index]?.id;
    if (!id) return;
    setVisited((current) => (current.has(id) ? current : new Set(current).add(id)));
    setCheckError("");
  }, [index, questions]);

  // Exam mode: warn before leaving the page and count every time the tab is hidden.
  useEffect(() => {
    if (!exam || finished) return undefined;
    function onVisibility() {
      if (document.visibilityState === "hidden") setViolations((value) => value + 1);
    }
    function onBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = "";
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [exam, finished]);

  useEffect(() => {
    function onKey(event) {
      if (event.altKey || event.ctrlKey || event.metaKey || stateRef.current.finished || stateRef.current.confirmOpen || !stateRef.current.mode) return;
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || event.target?.isContentEditable) return;
      if (event.key === "ArrowRight") { event.preventDefault(); move(1); return; }
      if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); return; }
      const current = questions[stateRef.current.index];
      if (!current || current.type === "NAT") return;
      let optionKey = null;
      if (/^[1-4]$/.test(event.key)) optionKey = current.options[Number(event.key) - 1]?.key;
      else if (/^[a-d]$/i.test(event.key)) optionKey = event.key.toUpperCase();
      if (optionKey) { event.preventDefault(); select(optionKey); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, select, questions]);

  // Mobile palette sheet: Escape closes and returns focus to the "Questions" button.
  useEffect(() => {
    if (!sheetOpen) return undefined;
    sheetRef.current?.querySelector("button[aria-current]")?.focus();
    function onKey(event) {
      if (event.key === "Escape") { setSheetOpen(false); sheetButtonRef.current?.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  // Finishing with unanswered questions asks first, so a stray tap cannot end the test.
  // Exam mode always asks, because a submitted exam cannot be reopened.
  function requestFinish() {
    if (exam || questions.length - answeredCount > 0) setConfirmOpen(true);
    else finish();
  }

  // The server grades the attempt and returns the result, so answer keys never sit in the page.
  async function finish() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    const current = stateRef.current;
    setConfirmOpen(false);
    setSheetOpen(false);
    setSubmitError("");
    setSubmitting(true);
    const elapsed = current.startedAt ? Math.round((Date.now() - current.startedAt) / 1000) : 0;
    const taken = current.mode === "EXAM" ? Math.min(elapsed, limitSeconds) : elapsed;
    try {
      const response = await fetch(`/api/cbt-sets/${set.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: current.answers, mode: current.mode, durationSeconds: taken, violations: current.violations })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.result) throw new Error(payload.error || "Could not submit the test.");
      setResult(payload.result);
      setAttemptId(payload.attemptId || null);
      setDuration(taken);
      setFinished(true);
    } catch (error) {
      finishingRef.current = false;
      setSubmitError(`${error.message || "Could not submit the test."} Your answers are still here. Check your connection and try again.`);
    } finally {
      setSubmitting(false);
    }
  }

  function retry() {
    finishingRef.current = false;
    setMode(null);
    setAnswers({});
    setChecks({});
    setFlagged({});
    setViolations(0);
    setIndex(0);
    setFinished(false);
    setResult(null);
    setReviewOpen(false);
    setSubmitError("");
    setAttemptId(null);
    setVisited(new Set(questions[0] ? [questions[0].id] : []));
    setStartedAt(null);
    setDuration(0);
  }

  const meta = [set.examName, set.branchName, set.subjectName].filter(Boolean);
  const titleBlock = (
    <div className="min-w-0">
      <h1 className="truncate text-xl font-medium tracking-tight sm:text-2xl">{set.title}</h1>
      {meta.length || set.year ? <p className="mt-1.5 flex flex-wrap gap-1.5">{meta.map((item) => <span className="badge" key={item}>{item}</span>)}{set.year ? <span className="badge tabular">{set.year}</span> : null}</p> : null}
    </div>
  );

  if (!questions.length) return <div className="mt-6">{titleBlock}<div className="empty-state mt-8 max-w-xl"><p className="font-medium">This set has no questions yet</p><p className="mt-1 text-sm text-slate-400">Try another CBT set for this branch.</p>{set.examSlug && set.branchSlug ? <Link className="button-secondary mt-5" href={`/exams/${set.examSlug}/${set.branchSlug}/cbt`}>See other sets</Link> : null}</div></div>;

  if (!ready) return <div className="mt-6">{titleBlock}</div>;

  if (!mode) {
    const counts = { MCQ: 0, MSQ: 0, NAT: 0 };
    let totalMarks = 0;
    for (const item of questions) { counts[item.type] += 1; totalMarks += item.marks; }
    const mix = Object.entries(counts).filter(([, count]) => count).map(([type, count]) => `${count} ${type}`).join(", ");
    return <div className="mt-6">
      {titleBlock}
      <p className="mt-8 eyebrow">Choose how to take this set</p>
      <p className="mt-2 text-sm text-slate-400"><span className="tabular">{questions.length}</span> questions ({mix}), <span className="tabular">{formatMarks(totalMarks)}</span> marks. Negative marking applies to MCQ only where the set defines it. MSQ and NAT have no partial credit.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="panel flex flex-col p-6">
          <h2 className="section-title">Study mode</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Go at your own pace. Check each answer to see whether you are right, with the explanation. A checked question is locked.</p>
          <ul className="mt-4 space-y-1.5 text-sm text-slate-300"><li>No time limit</li><li>Instant feedback and explanations</li></ul>
          <div className="mt-auto pt-6"><button className="button-secondary" onClick={() => begin("STUDY")} type="button">Start study mode</button></div>
        </div>
        <div className="panel flex flex-col p-6">
          <h2 className="section-title">Exam mode</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">A timed test that works like the real thing. No feedback until you submit, and the test submits itself when time runs out.</p>
          <ul className="mt-4 space-y-1.5 text-sm text-slate-300"><li><span className="tabular">{set.durationMinutes}</span> minutes</li><li>Change answers and mark questions for review</li><li>Leaving the tab is counted and saved with your attempt</li></ul>
          <div className="mt-auto pt-6"><button className="button-primary" onClick={() => begin("EXAM")} type="button">Start timed exam</button></div>
        </div>
      </div>
      {!authenticated ? <p className="mt-4 text-sm text-slate-400">Sign in to save your attempts and review them later.</p> : null}
    </div>;
  }

  if (finished && result) {
    return <div className="mt-6">
      {titleBlock}
      <div className="panel mt-8 overflow-hidden" role="status">
        <div className="grid gap-8 p-6 sm:grid-cols-[auto_1fr] sm:items-end sm:p-8">
          <div>
            <p className="eyebrow">Your score <span className="badge ml-2 align-middle">{exam ? "Exam mode" : "Study mode"}</span></p>
            <p className="mt-2 flex items-baseline gap-2"><span className="tabular text-6xl font-medium tracking-tight">{formatMarks(result.score)}</span><span className="tabular text-2xl text-slate-400">/ {formatMarks(result.maxScore)} marks</span></p>
          </div>
          <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-[12px] border border-line bg-line text-sm">
            <div className="bg-panel p-3"><dt className="text-slate-400">Correct</dt><dd className="tabular mt-1 text-lg font-medium text-[color:var(--ok-fg)]">{result.correct}</dd></div>
            <div className="bg-panel p-3"><dt className="text-slate-400">Wrong</dt><dd className="tabular mt-1 text-lg font-medium text-[color:var(--bad-fg)]">{result.wrong}</dd></div>
            <div className="bg-panel p-3"><dt className="text-slate-400">Skipped</dt><dd className="tabular mt-1 text-lg font-medium">{result.skipped}</dd></div>
          </dl>
        </div>
        <div aria-hidden="true" className="h-1 overflow-hidden bg-line"><div className="score-bar h-full w-full origin-left bg-electric" style={{ transform: `scaleX(${result.percent / 100})` }} /></div>
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="text-sm text-slate-400">
            <p><span className="tabular">{result.percent}%</span> score in <span className="tabular">{formatTime(duration)}</span>. <span className="tabular">{result.attempted} of {result.total}</span> attempted{result.scored < result.total ? <>, <span className="tabular">{result.total - result.scored}</span> without an answer key and not scored</> : null}.</p>
            {exam && violations ? <p className="mt-1 text-[color:var(--warn-fg)]">You left the tab {violations} {violations === 1 ? "time" : "times"} during the exam.</p> : null}
            {attemptId ? <p className="mt-1">Attempt saved to your account.</p> : authenticated ? <p className="mt-1">This attempt was not saved to your account.</p> : <p className="mt-1">Sign in to save attempts to your account.</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            <button aria-expanded={reviewOpen} className="button-primary" onClick={() => setReviewOpen((value) => !value)} type="button">{reviewOpen ? "Hide review" : "Review answers"}</button>
            <button className="button-secondary" onClick={retry} type="button"><RotateCcw aria-hidden="true" size={15} />Retry test</button>
            {attemptId ? <Link className="button-ghost" href="/cbt/attempts">My attempts</Link> : null}
            {set.examSlug && set.branchSlug ? <Link className="button-ghost" href={`/exams/${set.examSlug}/${set.branchSlug}/cbt`}>More CBT sets</Link> : null}
          </div>
        </div>
      </div>
      {reviewOpen ? <CbtReview answers={answers} questions={questions} results={result.perQuestion} /> : null}
    </div>;
  }

  const progress = ((index + 1) / questions.length) * 100;
  const fade = reduceMotion ? { duration: 0 } : { duration: 0.2, ease: EASE };
  const isLast = index === questions.length - 1;
  const isFlagged = Boolean(flagged[question.id]);
  const guard = exam ? { onContextMenu: (event) => event.preventDefault(), onCopy: (event) => event.preventDefault() } : {};
  const isNat = question.type === "NAT";
  const isMsq = question.type === "MSQ";
  const showCheckButton = !exam && !locked && (isMsq || isNat);
  const isCorrect = check?.status === "correct";
  const negativeNote = question.type === "MCQ" && question.negativeMarks > 0 ? `, âˆ’${formatMarks(Math.round(question.negativeMarks * 100) / 100)} for a wrong answer` : "";

  return <LazyMotion features={loadMotionFeatures} strict>
    {/* Top bar: test name, position and progress. */}
    <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      {titleBlock}
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <p className="tabular text-sm text-slate-400" aria-live="off"><span className="text-foreground">Question {index + 1}</span> of {questions.length}</p>
        <p aria-label={exam ? "Time remaining" : "Time elapsed"} className="inline-flex items-center gap-1.5 text-sm text-slate-400" role="timer"><Clock aria-hidden="true" size={14} />{exam ? <Countdown limitSeconds={limitSeconds} onExpire={finish} startedAt={startedAt} /> : <ElapsedTimer startedAt={startedAt} />}</p>
        <button aria-expanded={sheetOpen} aria-haspopup="dialog" className="button-secondary btn-sm lg:hidden" onClick={() => setSheetOpen(true)} ref={sheetButtonRef} type="button"><LayoutGrid aria-hidden="true" size={14} />Questions</button>
      </div>
    </div>
    <div aria-hidden="true" className="mt-4 h-1 overflow-hidden rounded-full bg-line"><m.div animate={{ scaleX: progress / 100 }} className="h-full w-full origin-left rounded-full bg-electric" initial={false} transition={fade} /></div>
    {exam && violations ? <p className="mt-4 flex items-center gap-2 rounded-[12px] border border-[color:var(--bad-border)] bg-[color:var(--bad-bg)] px-4 py-3 text-sm text-[color:var(--bad-fg)]" role="alert"><TriangleAlert aria-hidden="true" size={16} />You left this tab {violations} {violations === 1 ? "time" : "times"}. This is saved with your attempt.</p> : null}
    {submitError ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[color:var(--bad-border)] bg-[color:var(--bad-bg)] px-4 py-3 text-sm text-[color:var(--bad-fg)]" role="alert"><span className="flex items-center gap-2"><TriangleAlert aria-hidden="true" size={16} />{submitError}</span><button className="button-secondary btn-sm" onClick={finish} type="button">Try again</button></div> : null}

    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_272px]">
      <article aria-labelledby="cbt-question-heading" className="panel min-w-0 p-5 sm:p-7" {...guard}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="tabular flex flex-wrap items-center gap-2 text-sm font-medium text-slate-400" id="cbt-question-heading">Question {question.number}<span className="badge">{TYPE_NAME[question.type]}</span><span className="badge tabular">{formatMarks(question.marks)} {question.marks === 1 ? "mark" : "marks"}</span>{isFlagged ? <span className="badge"><Flag aria-hidden="true" size={11} />Marked for review</span> : null}</h2>
          <p className="hidden text-xs text-slate-400 sm:block">{isNat ? "Type the number or use the keypad" : isMsq ? "Press A to D to select or clear options, arrow keys to move" : "Press A to D or 1 to 4 to answer, arrow keys to move"}</p>
        </div>
<div className="q-swap" key={question.id}>
        {question.passage ? <div className="panel-sunken mt-5 whitespace-pre-wrap p-4 text-[15px] leading-7 text-slate-300">{question.passage}</div> : null}
        <p className="mt-4 max-w-[70ch] whitespace-pre-wrap text-[17px] leading-[1.7]">{question.text}</p>
        {question.images.map((url, imageIndex) => <div className="relative mt-5 h-72 w-full overflow-hidden rounded-[12px] border border-line bg-white sm:h-80" key={url}><Image alt={`Figure ${imageIndex + 1} for question ${question.number}`} className="object-contain" fill sizes="(min-width: 1024px) 720px, 100vw" src={url} unoptimized /></div>)}
        <p className="mt-5 text-sm text-slate-400">{isMsq ? "One or more options can be correct. You get the marks only if you select all the correct options and no others." : isNat ? "Enter the numerical answer. There is no negative marking." : `Choose one option${negativeNote}.`}</p>

        {isNat ? <div className="mt-4"><NatInput disabled={locked} label={`Answer for question ${question.number}`} onChange={(value) => setAnswer(question.id, value)} value={typeof answer === "string" ? answer : ""} /></div> : <div aria-label={`Options for question ${question.number}`} className="mt-4 space-y-2.5" role={isMsq ? "group" : "radiogroup"}>{question.options.map((option, optionIndex) => {
          const state = optionState(option.key, answer, check);
          const picked = pickedKeys(answer).includes(option.key);
          return <button
            aria-checked={picked}
            aria-disabled={locked}
            className={`flex min-h-[56px] w-full items-center gap-4 rounded-[12px] border px-4 py-3 text-left transition-[border-color,background-color,transform] duration-200 ${ROW[state]} ${locked ? "cursor-default" : "hover:border-[color:var(--border-strong)] active:scale-[.98] active:duration-[120ms]"}`}
            key={option.key}
            onClick={() => select(option.key)}
            role={isMsq ? "checkbox" : "radio"}
            type="button"
          >
            <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center border text-sm font-semibold transition-colors duration-200 ${isMsq ? "rounded-[8px]" : "rounded-full"} ${LETTER[state]}`}>{option.key}</span>
            <span className="min-w-0 flex-1 whitespace-pre-wrap leading-6">{option.text}</span>
            <span className="sr-only">{optionIndex < 4 ? `(key ${optionIndex + 1})` : ""}</span>
            <StateLabel state={state} />
          </button>;
        })}</div>}
        </div>

        {showCheckButton ? <div className="mt-5"><button className="button-primary" disabled={!isAnswered(answer) || checking === question.id} onClick={checkNow} type="button">{checking === question.id ? <><Loader2 aria-hidden="true" className="animate-spin" size={15} />Checkingâ€¦</> : "Check answer"}</button></div> : null}
        {checkError ? <p className="mt-4 text-sm text-[color:var(--bad-fg)]" role="alert">{checkError}</p> : null}

        <div aria-live="polite">
          <AnimatePresence initial={false}>
            {locked ? <m.div animate={{ opacity: 1, y: 0 }} className={`mt-5 rounded-[12px] border p-4 text-sm ${check.correct ? (isCorrect ? "border-[color:var(--ok-border)] bg-[color:var(--ok-bg)]" : "border-[color:var(--bad-border)] bg-[color:var(--bad-bg)]") : "border-line"}`} initial={reduceMotion ? false : { opacity: 0, y: 4 }} key={question.id} transition={fade}>
              <p className={`flex items-center gap-2 font-semibold ${check.correct ? (isCorrect ? "text-[color:var(--ok-fg)]" : "text-[color:var(--bad-fg)]") : "text-slate-300"}`}>{check.correct ? (isCorrect ? <><Check aria-hidden="true" size={16} strokeWidth={2.5} />Correct, +{formatMarks(check.earned)}.</> : <><X aria-hidden="true" size={16} strokeWidth={2.5} />Wrong{check.earned < 0 ? `, ${formatMarks(check.earned)}` : ""}. The correct answer is {check.correctText}.</>) : "This question has no answer key, so it is not marked."}</p>
              {check.explanation ? <p className="mt-2 whitespace-pre-wrap leading-6 text-foreground">{check.explanation}</p> : null}
            </m.div> : null}
          </AnimatePresence>
        </div>

        <div className="sticky bottom-0 -mx-5 mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-panel px-5 py-4 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0">
          <button className="button-ghost" disabled={index === 0} onClick={() => move(-1)} type="button"><ChevronLeft aria-hidden="true" size={16} />Previous</button>
          {exam ? <div className="flex gap-2">
            <button className="button-ghost" disabled={!isAnswered(answer)} onClick={clearAnswer} type="button">Clear</button>
            <button aria-pressed={isFlagged} className="button-secondary" onClick={toggleFlag} type="button"><Flag aria-hidden="true" size={15} />{isFlagged ? "Unmark" : "Mark for review"}</button>
          </div> : null}
          {isLast ? <button className="button-primary" disabled={submitting} onClick={requestFinish} type="button">{submitting ? <><Loader2 aria-hidden="true" className="animate-spin" size={15} />Submittingâ€¦</> : exam ? "Submit test" : "Finish and see score"}</button> : <button className="button-primary" onClick={() => move(1)} type="button">Next<ChevronRight aria-hidden="true" size={16} /></button>}
        </div>
      </article>

      <aside aria-label="Question palette" className="hidden lg:block">
        <div className="panel sticky top-[calc(var(--header-h)+16px)] p-5">
          <div className="flex items-baseline justify-between"><p className="text-sm font-medium">Questions</p><p className="tabular text-xs text-slate-400">{answeredCount} / {questions.length} answered</p></div>
          <div className="mt-4"><Palette answers={answers} checks={checks} exam={exam} flagged={flagged} index={index} onPick={setIndex} questions={questions} visited={visited} /></div>
          <div className="divider my-5" />
          <Legend exam={exam} />
          <button className="button-secondary mt-5 w-full" disabled={submitting} onClick={requestFinish} type="button">{submitting ? "Submittingâ€¦" : exam ? "Submit test" : "Finish test"}</button>
          {!authenticated ? <p className="mt-3 text-xs leading-5 text-slate-400">Sign in to save attempts to your account.</p> : null}
        </div>
      </aside>
    </div>

    {confirmOpen ? <div className="confirm-scrim" onClick={() => setConfirmOpen(false)}>
      <div aria-describedby="cbt-confirm-copy" aria-labelledby="cbt-confirm-title" aria-modal="true" className="confirm-box" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape") setConfirmOpen(false); }} role="alertdialog">
        <h2 className="text-lg font-medium" id="cbt-confirm-title">{exam ? "Submit the test?" : "Finish the test?"}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400" id="cbt-confirm-copy"><span className="tabular">{questions.length - answeredCount}</span> of <span className="tabular">{questions.length}</span> questions are not answered. They will count as skipped.{exam && flaggedCount ? <> <span className="tabular">{flaggedCount}</span> {flaggedCount === 1 ? "question is" : "questions are"} marked for review.</> : null}{exam ? " You cannot change answers after submitting." : ""}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button autoFocus className="button-ghost" onClick={() => setConfirmOpen(false)} type="button">Keep going</button>
          <button className="button-primary" onClick={finish} type="button">{exam ? "Submit now" : "Finish anyway"}</button>
        </div>
      </div>
    </div> : null}

    <AnimatePresence>
      {sheetOpen ? <>
        <m.div animate={{ opacity: 1 }} className="fixed inset-0 z-40 bg-black/60 lg:hidden" exit={{ opacity: 0 }} initial={{ opacity: 0 }} key="scrim" onClick={() => setSheetOpen(false)} transition={fade} />
        <m.div animate={{ y: 0 }} aria-label="Questions" aria-modal="true" className="menu-sheet fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-[20px] border-t border-line bg-panel px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 lg:hidden" exit={{ y: "100%" }} initial={{ y: reduceMotion ? 0 : "100%" }} key="sheet" ref={sheetRef} role="dialog" transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: EASE }}>
          <div aria-hidden="true" className="mx-auto mb-4 h-1 w-10 rounded-full bg-[color:var(--border-strong)]" />
          <div className="flex items-center justify-between"><p className="font-medium">Questions</p><button aria-label="Close questions" className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:text-foreground" onClick={() => { setSheetOpen(false); sheetButtonRef.current?.focus(); }} type="button"><X aria-hidden="true" size={18} /></button></div>
          <p className="tabular text-sm text-slate-400">{answeredCount} of {questions.length} answered</p>
          <div className="mt-4"><Palette answers={answers} checks={checks} exam={exam} flagged={flagged} index={index} onPick={(next) => { setIndex(next); setSheetOpen(false); }} questions={questions} visited={visited} /></div>
          <div className="mt-5"><Legend exam={exam} /></div>
          <button className="button-secondary mt-5 w-full" disabled={submitting} onClick={() => { setSheetOpen(false); requestFinish(); }} type="button">{exam ? "Submit test" : "Finish test"}</button>
        </m.div>
      </> : null}
    </AnimatePresence>
  </LazyMotion>;
}
