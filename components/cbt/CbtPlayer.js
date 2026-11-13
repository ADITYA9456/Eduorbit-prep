"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LazyMotion, m, useReducedMotion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, CircleHelp, RotateCcw, X } from "lucide-react";

// Animation features load after first paint; until then m.* render as plain elements.
const loadMotionFeatures = () => import("@/components/cbt/motionFeatures").then((module) => module.default);

function optionState(question, optionKey, chosen) {
  if (!chosen) return "idle";
  if (!question.correctKey) return optionKey === chosen ? "chosen" : "idle";
  if (optionKey === question.correctKey) return chosen === optionKey ? "correct" : "answer";
  if (optionKey === chosen) return "wrong";
  return "idle";
}

const STATE_STYLE = {
  idle: { borderColor: "var(--border)" },
  chosen: { borderColor: "var(--accent)" },
  correct: { borderColor: "var(--ok-border)", background: "var(--ok-bg)", color: "var(--ok-fg)" },
  answer: { borderColor: "var(--ok-border)", background: "var(--ok-bg)", color: "var(--ok-fg)" },
  wrong: { borderColor: "var(--bad-border)", background: "var(--bad-bg)", color: "var(--bad-fg)" }
};

function StateLabel({ state }) {
  if (state === "correct") return <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-sm font-semibold"><Check aria-hidden="true" size={16} /> Correct</span>;
  if (state === "answer") return <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-sm font-semibold"><Check aria-hidden="true" size={16} /> Correct answer</span>;
  if (state === "wrong") return <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-sm font-semibold"><X aria-hidden="true" size={16} /> Your answer, incorrect</span>;
  if (state === "chosen") return <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-sm text-slate-400"><CircleHelp aria-hidden="true" size={16} /> No answer key</span>;
  return null;
}

export default function CbtPlayer({ set, authenticated }) {
  const questions = set.questions;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [finished, setFinished] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const reduceMotion = useReducedMotion();
  const stateRef = useRef({ index, answers, finished });
  stateRef.current = { index, answers, finished };

  const question = questions[index];
  const chosen = question ? answers[question.id] : undefined;
  const answeredCount = Object.keys(answers).length;
  const correctCount = questions.filter((item) => item.correctKey && answers[item.id] === item.correctKey).length;

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

  async function finish() {
    setFinished(true);
    if (!authenticated || !answeredCount) return;
    setSaveStatus("Saving your attempt...");
    try {
      const response = await fetch(`/api/cbt-sets/${set.id}/attempts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }) });
      setSaveStatus(response.ok ? "Attempt saved to your account." : "This attempt could not be saved.");
    } catch {
      setSaveStatus("This attempt could not be saved.");
    }
  }

  function retry() {
    setAnswers({});
    setIndex(0);
    setFinished(false);
    setSaveStatus("");
  }

  if (!questions.length) return <div className="card mt-8 p-6 text-slate-400">This set has no questions yet.</div>;

  if (finished) {
    const keyed = questions.filter((item) => item.correctKey).length;
    return <div className="card mt-8 p-6 sm:p-8" role="status">
      <p className="eyebrow">Result</p>
      <p className="mt-4 text-5xl font-bold">{correctCount} <span className="text-2xl font-medium text-slate-500">/ {keyed || questions.length}</span></p>
      <p className="mt-3 text-sm text-slate-400">{answeredCount} of {questions.length} attempted{keyed < questions.length ? ` · ${questions.length - keyed} question(s) have no answer key and are not scored` : ""}.</p>
      {saveStatus ? <p className="mt-2 text-sm text-slate-500">{saveStatus}</p> : null}
      <div className="mt-6 flex flex-wrap gap-3"><button className="button-primary" onClick={retry} type="button"><RotateCcw size={16} /> Retry</button>{set.examSlug && set.branchSlug ? <Link className="button-secondary" href={`/exams/${set.examSlug}/${set.branchSlug}/cbt`}>More CBT sets</Link> : null}</div>
    </div>;
  }

  const locked = Boolean(chosen);
  const isCorrect = locked && question.correctKey && chosen === question.correctKey;
  return <LazyMotion features={loadMotionFeatures} strict>
    <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
      <div className="card min-w-0 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4"><h2 className="text-lg font-semibold">Question {question.number} <span className="text-sm font-normal text-slate-500">({index + 1} of {questions.length})</span></h2><p className="hidden text-xs text-slate-500 sm:block">Keys: A–D or 1–4 to answer, arrows to move</p></div>
        {question.passage ? <div className="mt-5 whitespace-pre-wrap rounded-xl border border-line p-4 text-sm leading-6 text-slate-300">{question.passage}</div> : null}
        <p className="mt-5 whitespace-pre-wrap leading-7">{question.text}</p>
        {question.images.map((url, imageIndex) => <div className="relative mt-5 h-72 w-full overflow-hidden rounded-xl border border-line bg-white sm:h-80" key={url}><Image alt={`Figure ${imageIndex + 1} for question ${question.number}`} className="object-contain" fill sizes="(min-width: 1024px) 720px, 100vw" src={url} unoptimized /></div>)}
        <div className="mt-6 space-y-3" role="radiogroup" aria-label={`Options for question ${question.number}`}>{question.options.map((option, optionIndex) => {
          const state = optionState(question, option.key, chosen);
          const picked = option.key === chosen;
          return <m.button
            animate={picked && !reduceMotion ? { scale: [1, 1.015, 1] } : { scale: 1 }}
            aria-checked={picked}
            aria-disabled={locked}
            className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left ${locked ? "cursor-default" : "hover:border-electric/60"}`}
            key={option.key}
            onClick={() => select(option.key)}
            role="radio"
            style={{ ...STATE_STYLE[state], transition: "none" }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            type="button"
          ><span className="shrink-0 font-semibold">{option.key}.</span><span className="min-w-0 flex-1 whitespace-pre-wrap">{option.text}</span><span className="sr-only">{optionIndex < 4 ? `(key ${optionIndex + 1})` : ""}</span><StateLabel state={state} /></m.button>;
        })}</div>
        {locked ? <m.div animate={{ opacity: 1, y: 0 }} aria-live="polite" className="mt-5 rounded-xl border p-4 text-sm" initial={reduceMotion ? false : { opacity: 0, y: 4 }} style={question.correctKey ? (isCorrect ? STATE_STYLE.correct : STATE_STYLE.wrong) : STATE_STYLE.chosen} transition={{ duration: 0.18 }}>
          <p className="flex items-center gap-2 font-semibold">{question.correctKey ? (isCorrect ? <><Check aria-hidden="true" size={16} /> Correct.</> : <><X aria-hidden="true" size={16} /> Incorrect. The correct answer is {question.correctKey}.</>) : "No answer key is available for this question."}</p>
          {question.explanation ? <p className="mt-2 whitespace-pre-wrap text-[color:var(--foreground)]">{question.explanation}</p> : null}
        </m.div> : null}
        <div className="mt-6 flex flex-wrap justify-between gap-3"><button className="button-secondary" disabled={index === 0} onClick={() => move(-1)} type="button"><ChevronLeft size={16} /> Previous</button>{index === questions.length - 1 ? <button className="button-primary" onClick={finish} type="button">Finish and see score</button> : <button className="button-primary" onClick={() => move(1)} type="button">Next <ChevronRight size={16} /></button>}</div>
      </div>
      <aside className="card h-fit p-4">
        <p className="text-sm font-semibold">Questions</p>
        <p className="mt-1 text-xs text-slate-500">{answeredCount} answered · {correctCount} correct</p>
        <div className="mt-4 grid grid-cols-5 gap-2">{questions.map((item, itemIndex) => {
          const answer = answers[item.id];
          const result = !answer ? "" : !item.correctKey ? "answered" : answer === item.correctKey ? "correct" : "wrong";
          const style = result === "correct" ? STATE_STYLE.correct : result === "wrong" ? STATE_STYLE.wrong : result ? STATE_STYLE.chosen : STATE_STYLE.idle;
          return <button aria-current={itemIndex === index ? "step" : undefined} aria-label={`Question ${item.number}${result === "correct" ? ", correct" : result === "wrong" ? ", incorrect" : result ? ", answered" : ""}`} className={`relative flex h-10 items-center justify-center rounded-lg border text-sm ${itemIndex === index ? "ring-2 ring-[color:var(--accent)]" : ""}`} key={item.id} onClick={() => setIndex(itemIndex)} style={style} type="button">{item.number}{result === "correct" ? <Check aria-hidden="true" className="absolute right-0.5 top-0.5" size={10} /> : result === "wrong" ? <X aria-hidden="true" className="absolute right-0.5 top-0.5" size={10} /> : null}</button>;
        })}</div>
        <button className="button-secondary mt-5 w-full" onClick={finish} type="button">Finish now</button>
        {!authenticated ? <p className="mt-3 text-xs text-slate-500">Sign in to save attempts to your account.</p> : null}
      </aside>
    </div>
  </LazyMotion>;
}
