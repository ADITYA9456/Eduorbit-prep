"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, ExternalLink, Play, RotateCcw } from "lucide-react";
import LoadingExperience from "@/components/LoadingExperience";

const DURATION_SECONDS = 3 * 60 * 60;

function getEmbedUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const driveMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
    const driveId = driveMatch?.[1] || parsed.searchParams.get("id");
    if (parsed.hostname === "drive.google.com" && driveId) return `https://drive.google.com/file/d/${driveId}/preview`;
    if (parsed.pathname.toLowerCase().endsWith(".pdf")) return url;
  } catch {
    return null;
  }
  return null;
}

function sourceForPaper(paper) {
  return getEmbedUrl(paper.externalPdfUrl) || getEmbedUrl(paper.officialPaperUrl);
}

function remainingSeconds(attempt, offset) {
  return Math.max(0, Math.ceil((new Date(attempt.expires_at).getTime() - (Date.now() + offset)) / 1000));
}

export default function ExamMode({ paper, authenticated }) {
  const embedUrl = useMemo(() => sourceForPaper(paper), [paper]);
  const [attempt, setAttempt] = useState(null);
  const [expired, setExpired] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(authenticated && Boolean(embedUrl));
  const [error, setError] = useState("");
  const [mode, setMode] = useState("practice");

  useEffect(() => {
    if (!authenticated || !embedUrl) return;
    fetch(`/api/exam-attempts?paperId=${paper.id}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to restore exam attempt.");
        return result;
      })
      .then((result) => {
        setOffset(new Date(result.serverNow).getTime() - Date.now());
        if (result.attempt) {
          setAttempt(result.attempt);
          setSeconds(remainingSeconds(result.attempt, new Date(result.serverNow).getTime() - Date.now()));
          setMode("exam");
        }
        if (result.expired) setExpired(true);
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [authenticated, embedUrl, paper.id]);

  useEffect(() => {
    if (!attempt || expired) return undefined;
    const timer = window.setInterval(() => {
      const next = remainingSeconds(attempt, offset);
      setSeconds(next);
      if (next <= 0) {
        setExpired(true);
        setAttempt(null);
        fetch(`/api/exam-attempts?paperId=${paper.id}`).catch(() => {});
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [attempt, expired, offset, paper.id]);

  async function startExam() {
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/exam-attempts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paperId: paper.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to start exam.");
      const serverOffset = new Date(result.serverNow).getTime() - Date.now();
      setOffset(serverOffset);
      setAttempt(result.attempt);
      setSeconds(remainingSeconds(result.attempt, serverOffset));
      setExpired(false);
      setMode("exam");
    } catch (startError) {
      setError(startError.message);
    } finally {
      setLoading(false);
    }
  }

  if (!authenticated || !embedUrl) return <div className="mt-8 rounded-xl border border-line p-4 text-sm text-slate-500">In-app Exam Mode is unavailable for this paper. Use Practice Mode with the original links below.</div>;
  if (loading) return <LoadingExperience message="Loading exam mode..." />;

  const display = `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return <div className="mt-8"><div className="flex flex-wrap gap-3"><button className={mode === "practice" ? "button-primary" : "button-secondary"} onClick={() => setMode("practice")} type="button">Practice Mode</button><button className={mode === "exam" ? "button-primary" : "button-secondary"} onClick={() => { if (attempt) setMode("exam"); else startExam(); }} type="button"><Play size={16} /> {attempt ? "Resume Exam" : "Start 3-hour Exam"}</button></div>{error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}{mode === "exam" && attempt && !expired ? <div className="mt-5 overflow-hidden rounded-2xl border border-electric/40"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-electric/30 bg-electric/10 px-4 py-3"><span className="flex items-center gap-2 font-semibold"><Clock size={17} /> Time remaining: {display}</span><span className="text-xs text-slate-500">3 hours · Attempt {attempt.id.slice(0, 8)}</span></div><iframe className="h-[70vh] min-h-[520px] w-full bg-white" src={embedUrl} title={`${paper.title} exam mode`} /></div> : null}{expired ? <div className="mt-5 rounded-xl border border-amber-400/40 bg-amber-400/10 p-6"><h2 className="text-xl font-bold">TIME&apos;S UP</h2><p className="mt-2 text-sm text-amber-100/80">Your 3-hour exam attempt has expired.</p><button className="button-primary mt-5" onClick={startExam} type="button"><RotateCcw size={16} /> Start New Attempt</button></div> : null}{mode === "practice" ? <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-500"><span>Practice Mode does not create an attempt.</span><a className="button-secondary" href={paper.officialPaperUrl || paper.externalPdfUrl} target="_blank" rel="noopener noreferrer">Open original paper <ExternalLink size={15} /></a></div> : null}</div>;
}
