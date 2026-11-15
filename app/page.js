import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCheck, FileCheck2, Library, ListChecks, MonitorCheck, NotebookPen } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import Hero from "@/components/home/hero/Hero";
import CbtDemo from "@/components/home/CbtDemo";
import Reveal from "@/components/motion/Reveal";
import SpotCard from "@/components/motion/SpotCard";

export const metadata = { title: "EDUorbit" };

const subjects = [
  "Algorithms", "Data Structures", "Operating Systems", "Databases", "Computer Networks", "Theory of Computation",
  "Computer Organization", "Compiler Design", "Digital Logic", "Discrete Mathematics", "Engineering Mathematics", "Programming"
];

const steps = [
  ["01", "Find the paper", "Choose the exam and branch, then open the year and shift you want."],
  ["02", "Take it as a CBT", "One question at a time, with the question palette you will see on exam day."],
  ["03", "Review and note", "See what you got wrong and write your working next to the question."]
];

function Marquee() {
  const row = (hidden) => (
    <ul aria-hidden={hidden || undefined} className="marquee-row">
      {subjects.map((name) => <li key={name}>{name}</li>)}
    </ul>
  );
  return (
    <div aria-label="GATE CSE subjects covered by the papers" className="marquee" role="group">
      <div className="marquee-track">{row(false)}{row(true)}</div>
    </div>
  );
}

function Feature({ icon: Icon, title, copy, className = "", delay = 0, children }) {
  return (
    <Reveal className={className} delay={delay}>
      <SpotCard className="feature-card">
        <span aria-hidden="true" className="feature-icon"><Icon size={18} strokeWidth={1.75} /></span>
        <h3 className="mt-5 text-[17px] font-medium tracking-tight">{title}</h3>
        <p className="mt-2 text-[15px] leading-6 text-slate-400">{copy}</p>
        {children}
      </SpotCard>
    </Reveal>
  );
}

export default async function Home() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <>
      <Hero />
      <Marquee />

      <section className="shell scroll-mt-6 py-24 sm:py-32" id="features">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">What&apos;s inside</p>
          <h2 className="page-title mt-3">Everything a GATE paper needs, nothing it doesn&apos;t.</h2>
          <p className="lede mt-5">No leaderboards and no invented activity. Just the paper library, your progress and your own notes.</p>
        </Reveal>

        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          <Feature className="lg:col-span-2" copy="Find the exact paper you need by exam, branch, year and shift." icon={Library} title="GATE PYQ library">
            <div aria-hidden="true" className="path-chips">
              {["GATE", "CSE", "Year", "Shift"].map((item, index) => (
                <span className="path-chip" key={item} style={{ "--i": index }}>{item}</span>
              ))}
            </div>
          </Feature>

          <Reveal className="lg:row-span-2" delay={80}>
            <SpotCard className="feature-card demo-card">
              <CbtDemo />
            </SpotCard>
          </Reveal>

          <Feature copy="Answer one question at a time and see right away whether you were correct." delay={60} icon={MonitorCheck} title="Computer-based tests" />
          <Feature copy="Mark the papers you have finished and keep the next one in view." delay={120} icon={CheckCheck} title="Paper-level progress" />
          <Feature copy="Track done and not done at the level of a single question." icon={ListChecks} title="Question-wise completion" />
          <Feature copy="Write your own working next to each question. Only you can see it." delay={60} icon={NotebookPen} title="Private notes" />
          <Feature copy="Open the official question papers and answer keys from one place." delay={120} icon={FileCheck2} title="Official resources" />
        </div>
      </section>

      <section aria-labelledby="how-title" className="shell pb-24 sm:pb-32">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">How it works</p>
          <h2 className="page-title mt-3" id="how-title">From paper to review in three steps.</h2>
        </Reveal>
        <ol className="steps mt-14">
          {steps.map(([number, title, copy], index) => (
            <Reveal as="li" className="step" delay={index * 110} key={number}>
              <span className="tabular step-number">{number}</span>
              <h3 className="mt-4 text-[17px] font-medium tracking-tight">{title}</h3>
              <p className="mt-2 text-[15px] leading-6 text-slate-400">{copy}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      <section className="shell pb-24 sm:pb-32">
        <Reveal className="cta-panel">
          <div aria-hidden="true" className="orbit">
            <span className="orbit-ring orbit-ring-1" />
            <span className="orbit-ring orbit-ring-2" />
            <span className="orbit-ring orbit-ring-3" />
          </div>
          <div className="relative z-10 mx-auto max-w-xl text-center">
            <h2 className="page-title">Pick a paper and start.</h2>
            <p className="lede mx-auto mt-4">You can browse without an account. Sign in to save your progress.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link className="button-primary btn-lg btn-arrow" href="/exams">Open the paper library<ArrowRight aria-hidden="true" size={16} /></Link>
              <Link className="button-ghost btn-lg" href="/login">Sign in</Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
