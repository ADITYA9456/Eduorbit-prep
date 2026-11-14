"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, LazyMotion, m, useReducedMotion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, CircleHelp, LayoutGrid, RotateCcw, X } from "lucide-react";

// Animation features load after first paint; until then m.* render as plain elements.
const loadMotionFeatures = () => import("@/components/cbt/motionFeatures").then((module) => module.default);
const EASE = [0.25, 0.8, 0.3, 1];

function optionState(question, optionKey, chosen) {
  if (!chosen) return "idle";
  if (!question.correctKey) return optionKey === chosen ? "chosen" : "idle";
  if (optionKey === question.correctKey) return chosen === optionKey ? "correct" : "answer";
  if (optionKey === chosen) return "wrong";
  return "idle";
}

// Option row styling per state. Colour is always paired with an icon and text.
const ROW = {
  idle: "border-line bg-panel",
  chosen: "border-electric bg-panel",
  correct: "border-[color:var(--ok-border)] bg-[color:var(--ok-bg)]",
  answer: "border-[color:var(--ok-border)] bg-[color:var(--ok-bg)]",
  wrong: "border-[color:var(--bad-border)] bg-[color:var(--bad-bg)]"
};
const LETTER = {
  idle: "border-[color:var(--border-strong)] text-slate-300",
  chosen: "border-electric bg-electric text-[color:var(--accent-foreground)]",
  correct: "border-transparent bg-mint text-[color:var(--background)]",
  answer: "border-transparent bg-mint text-[color:var(--background)]",
  wrong: "border-transparent bg-danger text-[color:var(--background)]"
};

function StateLabel({ state }) {
  if (state === "correct") return <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[color:var(--ok-fg)]"><Check aria-hidden="true" size={16} strokeWidth={2.5} />Correct</span>;
  if (state === "answer") return <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[color:var(--ok-fg)]"><Check aria-hidden="true" size={16} strokeWidth={2.5} />Correct answer</span>;
  if (state === "wrong") return <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[color:var(--bad-fg)]"><X aria-hidden="true" size={16} strokeWidth={2.5} />Wrong answer</span>;
  if (state === "chosen") return <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-slate-400"><CircleHelp aria-hidden="true" size={16} />No answer key</span>;
  return null;
}

function tileState(item, answers, visited, isCurrent) {
  const answer = answers[item.id];
  if (answer && item.correctKey) return answer === item.correctKey ? "correct" : "wrong";
  if (answer) return "answered";
  if (isCurrent) return "current";
  return visited.has(item.id) ? "visited" : "idle";
}

const TILE = {
  idle: "border-line text-slate-400",
  visited: "border-[color:var(--border-strong)] text-slate-300",
  current: "border-electric text-foreground",
  answered: "border-electric/60 bg-electric/10 text-foreground",
  correct: "border-[color:var(--ok-border)] bg-[color:var(--ok-bg)] text-[color:var(--ok-fg)]",
  wrong: "border-[color:var(--bad-border)] bg-[color:var(--bad-bg)] text-[color:var(--bad-fg)]"
};
const TILE_LABEL = { idle: "not visited", visited: "not answered", current: "current", answered: "answered", correct: "correct", wrong: "wrong" };

function Palette({ questions, answers, visited, index, onPick }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {questions.map((item, itemIndex) => {
        const isCurrent = itemIndex === index;
        const state = tileState(item, answers, visited, isCurrent);
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
            {state === "correct" ? <Check aria-hidden="true" className="absolute right-1 top-1" size={10} strokeWidth={2.5} /> : state === "wrong" ? <X aria-hidden="true" className="absolute right-1 top-1" size={10} strokeWidth={2.5} /> : null}
          </button>
        );
      })}
    </div>
  );
}

function Legend() {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-slate-400">
      <li className="flex items-center gap-2"><span aria-hidden="true" className="flex h-4 w-4 items-center justify-center rounded border border-[color:var(--ok-border)] bg-[color:var(--ok-bg)] text-[color:var(--ok-fg)]"><Check size={9} strokeWidth={3} /></span>Correct</li>
      <li className="flex items-center gap-2"><span aria-hidden="true" className="flex h-4 w-4 items-center justify-center rounded border border-[color:var(--bad-border)] bg-[color:var(--bad-bg)] text-[color:var(--bad-fg)]"><X size={9} strokeWidth={3} /></span>Wrong</li>
      <li className="flex items-center gap-2"><span aria-hidden="true" className="h-4 w-4 rounded border border-electric/60 bg-electric/10" />Answered</li>
      <li className="flex items-center gap-2"><span aria-hidden="true" className="h-4 w-4 rounded border border-line" />Not answered</li>
    </ul>
  );
}

export default function CbtPlayer({ set, authenticated }) {
  const questions = set.questions;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [finished, setFinished] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [visited, setVisited] = useState(() => new Set(questions[0] ? [questions[0].id] : []));
  const [sheetOpen, setSheetOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const stateRef = useRef({ index, answers, finished });
  stateRef.current = { index, answers, finished };
  const sheetButtonRef = useRef(null);
  const sheetRef = useRef(null);

  const question = questions[index];
  const chosen = question ? answers[question.id] : undefined;
  const answeredCount = Object.keys(answers).length;
  const correctCount = questions.filter((item) => item.correctKey && answers[item.id] === item.correctKey).length;
  const wrongCount = questions.filter((item) => item.correctKey && answers[item.id] && answers[item.id] !== item.correctKey).length;

  const select = useCallback((optionKey) => {
    const { index: currentIndex, answers: currentAnswers, finished: isFinished } = stateRef.current;
    const current = questions[currentIndex];
    if (isFinished || !current || currentAnswers[current.id]) return; // one selection locks the question
    if (!current.options.some((option) => option.key === optionKey)) return;
    setAnswers({ ...currentAnswers, [current.id]: optionKey });
  }, [questions]);

  const move = useCallback((delta) => {
    setIndex((value) => Math.min(questions.length - 1, Math.max(0, value + delta)));
  }, [questions.length]);

  // Track which questions have been opened, for the palette's "not answered" state.
  useEffect(() => {
    const id = questions[index]?.id;
    if (!id) return;
    setVisited((current) => (current.has(id) ? current : new Set(current).add(id)));
  }, [index, questions]);

  useEffect(() => {
    function onKey(event) {
      if (event.altKey || event.ctrlKey || event.metaKey || stateRef.current.finished) return;
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || event.target?.isContentEditable) return;
      if (event.key === "ArrowRight") { event.preventDefault(); move(1); return; }
      if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); return; }
      const current = questions[stateRef.current.index];
      if (!current) return;
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

  async function finish() {
    setFinished(true);
    if (!authenticated || !answeredCount) return;
    setSaveStatus("Saving your attempt…");
    try {
      const response = await fetch(`/api/cbt-sets/${set.id}/attempts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }) });
      setSaveStatus(response.ok ? "Attempt saved to your account." : "This attempt was not saved. Your score above is still correct.");
    } catch {
      setSaveStatus("This attempt was not saved. Your score above is still correct.");
    }
  }

  function retry() {
    setAnswers({});
    setIndex(0);
    setFinished(false);
    setSaveStatus("");
    setVisited(new Set(questions[0] ? [questions[0].id] : []));
  }

  const meta = [set.examName, set.branchName, set.subjectName].filter(Boolean);
  const titleBlock = (
    <div className="min-w-0">
      <h1 className="truncate text-xl font-medium tracking-tight sm:text-2xl">{set.title}</h1>
      {meta.length || set.year ? <p className="mt-1.5 flex flex-wrap gap-1.5">{meta.map((item) => <span className="badge" key={item}>{item}</span>)}{set.year ? <span className="badge tabular">{set.year}</span> : null}</p> : null}
    </div>
  );

  if (!questions.length) return <div className="mt-6">{titleBlock}<div className="empty-state mt-8 max-w-xl"><p className="font-medium">This set has no questions yet</p><p className="mt-1 text-sm text-slate-400">Try another CBT set for this branch.</p>{set.examSlug && set.branchSlug ? <Link className="button-secondary mt-5" href={`/exams/${set.examSlug}/${set.branchSlug}/cbt`}>See other sets</Link> : null}</div></div>;

  if (finished) {
    const keyed = questions.filter((item) => item.correctKey).length;
    const total = keyed || questions.length;
    const percent = total ? Math.round((correctCount / total) * 100) : 0;
    return <div className="mt-6">
      {titleBlock}
      <div className="panel mt-8 overflow-hidden" role="status">
        <div className="grid gap-8 p-6 sm:grid-cols-[auto_1fr] sm:items-end sm:p-8">
          <div>
            <p className="eyebrow">Your score</p>
            <p className="mt-2 flex items-baseline gap-2"><span className="tabular text-6xl font-medium tracking-tight">{correctCount}</span><span className="tabular text-2xl text-slate-400">/ {total}</span></p>
          </div>
          <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-[12px] border border-line bg-line text-sm">
            <div className="bg-panel p-3"><dt className="text-slate-400">Correct</dt><dd className="tabular mt-1 text-lg font-medium text-[color:var(--ok-fg)]">{correctCount}</dd></div>
            <div className="bg-panel p-3"><dt className="text-slate-400">Wrong</dt><dd className="tabular mt-1 text-lg font-medium text-[color:var(--bad-fg)]">{wrongCount}</dd></div>
            <div className="bg-panel p-3"><dt className="text-slate-400">Skipped</dt><dd className="tabular mt-1 text-lg font-medium">{questions.length - answeredCount}</dd></div>
          </dl>
        </div>
        <div aria-hidden="true" className="h-1 bg-line"><div className="h-full bg-electric" style={{ width: `${percent}%` }} /></div>
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="text-sm text-slate-400">
            <p><span className="tabular">{answeredCount} of {questions.length}</span> attempted{keyed < questions.length ? <>, <span className="tabular">{questions.length - keyed}</span> without an answer key and not scored</> : null}.</p>
            {saveStatus ? <p className="mt-1">{saveStatus}</p> : !authenticated ? <p className="mt-1">Sign in to save attempts to your account.</p> : null}
          </div>
          <div className="flex flex-wrap gap-3"><button className="button-primary" onClick={retry} type="button"><RotateCcw aria-hidden="true" size={15} />Retry test</button>{set.examSlug && set.branchSlug ? <Link className="button-ghost" href={`/exams/${set.examSlug}/${set.branchSlug}/cbt`}>More CBT sets</Link> : null}</div>
        </div>
      </div>
    </div>;
  }

  const locked = Boolean(chosen);
  const isCorrect = locked && question.correctKey && chosen === question.correctKey;
  const progress = ((index + 1) / questions.length) * 100;
  const fade = reduceMotion ? { duration: 0 } : { duration: 0.2, ease: EASE };
  const isLast = index === questions.length - 1;

  return <LazyMotion features={loadMotionFeatures} strict>
    {/* Top bar: test name, position and progress. */}
    <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      {titleBlock}
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <p className="tabular text-sm text-slate-400" aria-live="off"><span className="text-foreground">Question {index + 1}</span> of {questions.length}</p>
        <button aria-expanded={sheetOpen} aria-haspopup="dialog" className="button-secondary btn-sm lg:hidden" onClick={() => setSheetOpen(true)} ref={sheetButtonRef} type="button"><LayoutGrid aria-hidden="true" size={14} />Questions</button>
      </div>
    </div>
    <div aria-hidden="true" className="mt-4 h-1 overflow-hidden rounded-full bg-line"><m.div animate={{ width: `${progress}%` }} className="h-full rounded-full bg-electric" initial={false} transition={fade} /></div>

    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_272px]">
      <article aria-labelledby="cbt-question-heading" className="panel min-w-0 p-5 sm:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="tabular text-sm font-medium text-slate-400" id="cbt-question-heading">Question {question.number}</h2>
          <p className="hidden text-xs text-slate-400 sm:block">Press A to D or 1 to 4 to answer, arrow keys to move</p>
        </div>
        {question.passage ? <div className="panel-sunken mt-5 whitespace-pre-wrap p-4 text-[15px] leading-7 text-slate-300">{question.passage}</div> : null}
        <p className="mt-4 max-w-[70ch] whitespace-pre-wrap text-[17px] leading-[1.7]">{question.text}</p>
        {question.images.map((url, imageIndex) => <div className="relative mt-5 h-72 w-full overflow-hidden rounded-[12px] border border-line bg-white sm:h-80" key={url}><Image alt={`Figure ${imageIndex + 1} for question ${question.number}`} className="object-contain" fill sizes="(min-width: 1024px) 720px, 100vw" src={url} unoptimized /></div>)}

        <div aria-label={`Options for question ${question.number}`} className="mt-7 space-y-2.5" role="radiogroup">{question.options.map((option, optionIndex) => {
          const state = optionState(question, option.key, chosen);
          const picked = option.key === chosen;
          return <button
            aria-checked={picked}
            aria-disabled={locked}
            className={`flex min-h-[56px] w-full items-center gap-4 rounded-[12px] border px-4 py-3 text-left transition-[border-color,background-color,transform] duration-200 ${ROW[state]} ${locked ? "cursor-default" : "hover:border-[color:var(--border-strong)] active:scale-[.98] active:duration-[120ms]"}`}
            key={option.key}
            onClick={() => select(option.key)}
            role="radio"
            type="button"
          >
            <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors duration-200 ${LETTER[state]}`}>{option.key}</span>
            <span className="min-w-0 flex-1 whitespace-pre-wrap leading-6">{option.text}</span>
            <span className="sr-only">{optionIndex < 4 ? `(key ${optionIndex + 1})` : ""}</span>
            <StateLabel state={state} />
          </button>;
        })}</div>

        <div aria-live="polite">
          <AnimatePresence initial={false}>
            {locked ? <m.div animate={{ opacity: 1, y: 0 }} className={`mt-5 rounded-[12px] border p-4 text-sm ${question.correctKey ? (isCorrect ? "border-[color:var(--ok-border)] bg-[color:var(--ok-bg)]" : "border-[color:var(--bad-border)] bg-[color:var(--bad-bg)]") : "border-line"}`} initial={reduceMotion ? false : { opacity: 0, y: 4 }} key={question.id} transition={fade}>
              <p className={`flex items-center gap-2 font-semibold ${question.correctKey ? (isCorrect ? "text-[color:var(--ok-fg)]" : "text-[color:var(--bad-fg)]") : "text-slate-300"}`}>{question.correctKey ? (isCorrect ? <><Check aria-hidden="true" size={16} strokeWidth={2.5} />Correct.</> : <><X aria-hidden="true" size={16} strokeWidth={2.5} />Wrong answer. The correct answer is {question.correctKey}.</>) : "This question has no answer key, so it is not marked."}</p>
              {question.explanation ? <p className="mt-2 whitespace-pre-wrap leading-6 text-foreground">{question.explanation}</p> : null}
            </m.div> : null}
          </AnimatePresence>
        </div>

        <div className="sticky bottom-0 -mx-5 mt-7 flex items-center justify-between gap-3 border-t border-line bg-panel px-5 py-4 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0">
          <button className="button-ghost" disabled={index === 0} onClick={() => move(-1)} type="button"><ChevronLeft aria-hidden="true" size={16} />Previous</button>
          {isLast ? <button className="button-primary" onClick={finish} type="button">Finish and see score</button> : <button className="button-primary" onClick={() => move(1)} type="button">Next<ChevronRight aria-hidden="true" size={16} /></button>}
        </div>
      </article>

      <aside aria-label="Question palette" className="hidden lg:block">
        <div className="panel sticky top-[calc(var(--header-h)+16px)] p-5">
          <div className="flex items-baseline justify-between"><p className="text-sm font-medium">Questions</p><p className="tabular text-xs text-slate-400">{answeredCount} / {questions.length} answered</p></div>
          <div className="mt-4"><Palette answers={answers} index={index} onPick={setIndex} questions={questions} visited={visited} /></div>
          <div className="divider my-5" />
          <Legend />
          <button className="button-secondary mt-5 w-full" onClick={finish} type="button">Finish test</button>
          {!authenticated ? <p className="mt-3 text-xs leading-5 text-slate-400">Sign in to save attempts to your account.</p> : null}
        </div>
      </aside>
    </div>

    <AnimatePresence>
      {sheetOpen ? <>
        <m.div animate={{ opacity: 1 }} className="fixed inset-0 z-40 bg-black/60 lg:hidden" exit={{ opacity: 0 }} initial={{ opacity: 0 }} key="scrim" onClick={() => setSheetOpen(false)} transition={fade} />
        <m.div animate={{ y: 0 }} aria-label="Questions" aria-modal="true" className="menu-sheet fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-[20px] border-t border-line bg-panel px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 lg:hidden" exit={{ y: "100%" }} initial={{ y: reduceMotion ? 0 : "100%" }} key="sheet" ref={sheetRef} role="dialog" transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: EASE }}>
          <div aria-hidden="true" className="mx-auto mb-4 h-1 w-10 rounded-full bg-[color:var(--border-strong)]" />
          <div className="flex items-center justify-between"><p className="font-medium">Questions</p><button aria-label="Close questions" className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:text-foreground" onClick={() => { setSheetOpen(false); sheetButtonRef.current?.focus(); }} type="button"><X aria-hidden="true" size={18} /></button></div>
          <p className="tabular text-sm text-slate-400">{answeredCount} of {questions.length} answered</p>
          <div className="mt-4"><Palette answers={answers} index={index} onPick={(next) => { setIndex(next); setSheetOpen(false); }} questions={questions} visited={visited} /></div>
          <div className="mt-5"><Legend /></div>
          <button className="button-secondary mt-5 w-full" onClick={() => { setSheetOpen(false); finish(); }} type="button">Finish test</button>
        </m.div>
      </> : null}
    </AnimatePresence>
  </LazyMotion>;
}
