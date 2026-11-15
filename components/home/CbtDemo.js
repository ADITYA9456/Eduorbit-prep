"use client";

import { useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";

const QUESTION = "What is the time complexity of building a binary heap from n elements using bottom-up heapify?";
const OPTIONS = ["O(log n)", "O(n)", "O(n log n)", "O(n²)"];
const CORRECT = 1;
const BEFORE = ["correct", "correct", "wrong", "correct"];

function tileClass(state) {
  if (state === "correct") return "border-[color:var(--ok-border)] bg-[color:var(--ok-bg)] text-[color:var(--ok-fg)]";
  if (state === "wrong") return "border-[color:var(--bad-border)] bg-[color:var(--bad-bg)] text-[color:var(--bad-fg)]";
  if (state === "current") return "border-electric text-foreground ring-1 ring-electric";
  return "border-line text-slate-400";
}

export default function CbtDemo() {
  const [picked, setPicked] = useState(null);
  const answered = picked !== null;
  const right = picked === CORRECT;
  const fifth = !answered ? "current" : right ? "correct" : "wrong";

  return (
    <div aria-label="Try a computer-based test question" className="flex h-full flex-col" role="group">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium">Try a question</p>
        <p className="tabular text-xs text-slate-400">Question 5 of 10</p>
      </div>
      <p className="mt-4 text-[15px] leading-6">{QUESTION}</p>

      <div className="mt-4 grid gap-2">
        {OPTIONS.map((option, index) => {
          const isPicked = picked === index;
          const isRight = answered && index === CORRECT;
          const isWrong = answered && isPicked && index !== CORRECT;
          return (
            <button
              aria-pressed={isPicked}
              className={`demo-option ${isRight ? "is-right" : ""} ${isWrong ? "is-wrong" : ""}`}
              disabled={answered}
              key={option}
              onClick={() => setPicked(index)}
              type="button"
            >
              <span className="tabular text-xs text-slate-400">{String.fromCharCode(65 + index)}</span>
              <span className="flex-1 text-left">{option}</span>
              {isRight ? <Check aria-hidden="true" size={15} strokeWidth={2.5} /> : isWrong ? <X aria-hidden="true" size={15} strokeWidth={2.5} /> : null}
            </button>
          );
        })}
      </div>

      <p aria-live="polite" className="mt-3 min-h-[1.5rem] text-sm text-slate-400">
        {!answered ? "Pick an answer. You see the result straight away." : right ? "Correct. Bottom-up heapify does O(n) total work." : "Not quite. The answer is O(n), because most nodes sit near the leaves."}
      </p>

      <div aria-hidden="true" className="mt-auto grid grid-cols-5 gap-2 pt-4">
        {[...BEFORE, fifth, "idle", "idle", "idle", "idle"].map((state, index) => (
          <span className={`tabular demo-tile ${tileClass(state)}`} key={index}>{index + 1}</span>
        ))}
      </div>

      <button className="button-ghost btn-sm mt-4 self-start" disabled={!answered} onClick={() => setPicked(null)} type="button">
        <RotateCcw aria-hidden="true" size={13} />Try again
      </button>
    </div>
  );
}
