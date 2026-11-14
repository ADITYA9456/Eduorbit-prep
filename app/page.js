import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, X } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import Hero from "@/components/home/hero/Hero";

export const metadata = { title: "EDUorbit" };

const features = [
  ["GATE PYQ library", "Find the exact paper you need by exam, branch, year and shift."],
  ["Computer-based tests", "Answer one question at a time and see right away whether you were correct."],
  ["Paper-level progress", "Mark the papers you have finished and keep the next one in view."],
  ["Question-wise completion", "Track done and not done at the level of a single question."],
  ["Private notes", "Write your own working next to each question. Only you can see it."],
  ["Official resources", "Open the official question papers and answer keys from one place."]
];

// A static picture of the CBT question palette, shown as an example on the homepage.
const sample = ["correct", "correct", "wrong", "correct", "current", "idle", "idle", "answered", "idle", "idle"];

function PaletteExample() {
  return (
    <figure aria-label="Example of the question palette in a computer-based test" className="panel p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium">Questions</p>
        <p className="tabular text-xs text-slate-400">Question 5 of 10</p>
      </div>
      <div aria-hidden="true" className="mt-4 grid grid-cols-5 gap-2">
        {sample.map((state, index) => (
          <span
            className={`tabular relative flex h-11 items-center justify-center rounded-[10px] border text-sm ${state === "correct" ? "border-[color:var(--ok-border)] bg-[color:var(--ok-bg)] text-[color:var(--ok-fg)]" : state === "wrong" ? "border-[color:var(--bad-border)] bg-[color:var(--bad-bg)] text-[color:var(--bad-fg)]" : state === "current" ? "border-electric text-foreground ring-1 ring-electric" : state === "answered" ? "border-electric/50 text-foreground" : "border-line text-slate-400"}`}
            key={index}
          >
            {index + 1}
            {state === "correct" ? <Check className="absolute right-1 top-1" size={10} strokeWidth={2.5} /> : state === "wrong" ? <X className="absolute right-1 top-1" size={10} strokeWidth={2.5} /> : null}
          </span>
        ))}
      </div>
      <figcaption className="mt-5 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
        <span className="inline-flex items-center gap-2"><Check aria-hidden="true" className="text-mint" size={13} />Green with a tick: correct</span>
        <span className="inline-flex items-center gap-2"><X aria-hidden="true" className="text-danger" size={13} />Red with a cross: wrong</span>
      </figcaption>
    </figure>
  );
}

export default async function Home() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <>
      <Hero />
      <section className="shell scroll-mt-6 py-20 sm:py-28" id="features">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-20">
          <div className="lg:sticky lg:top-10 lg:self-start">
            <h2 className="page-title max-w-md">Everything a GATE paper needs, nothing it doesn&apos;t.</h2>
            <p className="lede mt-5">No leaderboards and no invented activity. Just the paper library, your progress and your own notes.</p>
            <div className="mt-10 hidden lg:block"><PaletteExample /></div>
          </div>
          <div>
            <dl className="border-t border-line">
              {features.map(([title, copy]) => (
                <div className="grid gap-1.5 border-b border-line py-6 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-8" key={title}>
                  <dt className="font-medium">{title}</dt>
                  <dd className="text-slate-400">{copy}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-10 lg:hidden"><PaletteExample /></div>
          </div>
        </div>
      </section>
      <section className="shell pb-24 sm:pb-32">
        <div className="flex flex-col items-start justify-between gap-6 border-t border-line pt-10 sm:flex-row sm:items-center">
          <div>
            <h2 className="section-title">Pick a paper and start.</h2>
            <p className="mt-2 text-slate-400">You can browse without an account. Sign in to save your progress.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="button-primary btn-lg" href="/exams">Open the paper library</Link>
            <Link className="button-ghost btn-lg" href="/login">Sign in</Link>
          </div>
        </div>
      </section>
    </>
  );
}
