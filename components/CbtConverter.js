"use client";

import { useEffect, useRef, useState } from "react";

function questionLabel(question) {
  return `${question.number}. ${question.type} — ${question.verificationStatus}`;
}

function fileMetadata(name) {
  const source = String(name || "").toUpperCase();
  const year = source.match(/\b(20\d{2})\b/)?.[1] || "";
  const branch = source.match(/\b(CSE|CS|DA|EC|EE|ME|CE|IN|PI|XE|XL|AR|CY|GG|MA|PH|ST)\b/)?.[1] || "";
  const shift = source.match(/(?:SHIFT|SESSION|SET|PAPER)[-_ ]?([12])\b/)?.[1] || source.match(/\bCS([12])\b/)?.[1] || "";
  return { year, branch: branch === "CS" ? "CSE" : branch, shift: shift ? `Shift ${shift}` : "" };
}

function stem(name) {
  return String(name || "").toUpperCase().replace(/\.PDF$/i, "").replace(/(?:ANSWER|ANS|KEY|SOLUTION|OFFICIAL|QUESTION|PAPER|QUES|_+)/g, "").replace(/[^A-Z0-9]/g, "");
}

function autoAnswer(questionFile, answerFiles) {
  const questionMeta = fileMetadata(questionFile.name);
  const exact = answerFiles.find((answer) => stem(answer.name) === stem(questionFile.name));
  if (exact) return exact;
  const matches = answerFiles.filter((answer) => {
    const meta = fileMetadata(answer.name);
    return (!questionMeta.year || !meta.year || meta.year === questionMeta.year) &&
      (!questionMeta.branch || !meta.branch || meta.branch === questionMeta.branch) &&
      (!questionMeta.shift || !meta.shift || meta.shift === questionMeta.shift);
  });
  return matches.length === 1 ? matches[0] : null;
}

function autoPaper(file, papers) {
  const meta = fileMetadata(file.name);
  const matches = papers.filter((paper) =>
    (!meta.year || String(paper.year) === meta.year) &&
    (!meta.shift || String(paper.shift).toLowerCase() === meta.shift.toLowerCase()) &&
    (!meta.branch || `${paper.branchName} ${paper.examName}`.toUpperCase().includes(meta.branch))
  );
  return matches.length === 1 ? matches[0].id : "";
}

async function runWithConcurrency(items, concurrency, worker) {
  let cursor = 0;
  async function next() {
    const index = cursor;
    cursor += 1;
    if (index >= items.length) return;
    await worker(items[index], index);
    return next();
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
}

export default function CbtConverter({ papers, initialImports }) {
  const [selectedPaper, setSelectedPaper] = useState("");
  const [questionFiles, setQuestionFiles] = useState([]);
  const [answerFiles, setAnswerFiles] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [imports, setImports] = useState(initialImports);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const initialImportsRef = useRef(initialImports);

  useEffect(() => {
    const queued = initialImportsRef.current.filter((item) => item.status === "QUEUED" || item.status === "PROCESSING");
    runWithConcurrency(queued, 3, async (item) => {
      try {
        const response = await fetch(`/api/admin/cbt/${item.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "process" }) });
        const payload = await response.json();
        setImports((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...(payload.import || {}) } : entry));
      } catch (error) {
        setImports((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "FAILED", error_message: error.message } : entry));
      }
    });
  }, []);

  function chooseQuestionFiles(event) {
    const files = [...event.target.files];
    setQuestionFiles(files);
    setPairs(files.map((questionFile) => ({
      questionFile,
      answerFile: autoAnswer(questionFile, answerFiles),
      paperId: selectedPaper || autoPaper(questionFile, papers),
      status: "READY"
    })));
  }

  function chooseAnswerFiles(event) {
    const files = [...event.target.files];
    setAnswerFiles(files);
    setPairs((current) => current.map((pair) => ({ ...pair, answerFile: autoAnswer(pair.questionFile, files) })));
  }

  function updatePair(index, key, value) {
    setPairs((current) => current.map((pair, pairIndex) => pairIndex === index ? { ...pair, [key]: value } : pair));
  }

  async function upload(event) {
    event.preventDefault();
    if (!questionFiles.length || busy) return;
    setBusy(true);
    setMessage(`Queueing ${pairs.length} paper(s)...`);
    const batchId = crypto.randomUUID();
    try {
      const queued = [];
      await runWithConcurrency(pairs, 3, async (pair, index) => {
        try {
          const form = new FormData();
          form.append("queue", "true");
          form.append("batchId", batchId);
          if (pair.paperId) form.append("paperId", pair.paperId);
          form.append("questionPdf", pair.questionFile);
          if (pair.answerFile) form.append("answerKeyPdf", pair.answerFile);
          const response = await fetch("/api/admin/cbt", { method: "POST", body: form });
          const payload = await response.json();
          if (!response.ok) {
            updatePair(index, "status", `FAILED: ${payload.error || "Upload failed."}`);
            return;
          }
          queued.push(payload.import);
          updatePair(index, "status", "QUEUED");
        } catch (error) {
          updatePair(index, "status", `FAILED: ${error.message}`);
        }
      });
      setImports((current) => [...queued, ...current]);
      setMessage(`Queued ${queued.length} paper(s). Processing with 3 workers...`);
      await runWithConcurrency(queued, 3, async (item, index) => {
        try {
          const response = await fetch(`/api/admin/cbt/${item.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "process" }) });
          const payload = await response.json();
          const processed = payload.import || { ...item, status: "FAILED", error_message: payload.error || "Processing failed." };
          setImports((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...processed } : entry));
          setMessage(`Processed ${index + 1} of ${queued.length} paper(s).`);
        } catch (error) {
          setImports((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "FAILED", error_message: error.message } : entry));
        }
      });
      setMessage(`Bulk processing complete. ${queued.length} independent job(s) finished.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function retry(item) {
    setMessage("Retrying processing...");
    try {
      const response = await fetch(`/api/admin/cbt/${item.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "retry" }) });
      const payload = await response.json();
      if (!response.ok) return setMessage(payload.error || "Retry failed.");
      setImports((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...payload.import } : entry));
      const processResponse = await fetch(`/api/admin/cbt/${item.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "process" }) });
      const processed = await processResponse.json();
      setImports((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...(processed.import || {}) } : entry));
      setMessage("Retry complete.");
    } catch (error) {
      setMessage(error.message || "Retry failed.");
    }
  }

  async function saveReview() {
    if (!editing) return;
    try {
      const response = await fetch(`/api/admin/cbt/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questions: editing.questions, metadata: editing.metadata, paperId: editing.paper_id || undefined }) });
      const payload = await response.json();
      if (!response.ok) return setMessage(payload.error || "Could not save review.");
      setImports((current) => current.map((item) => item.id === editing.id ? { ...item, ...payload.import } : item));
      setEditing(null);
      setMessage("Review saved.");
    } catch (error) {
      setMessage(error.message || "Could not save review.");
    }
  }

  async function publish(item) {
    try {
      const response = await fetch(`/api/admin/cbt/${item.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const payload = await response.json();
      if (!response.ok) return setMessage(payload.error || "Could not publish.");
      setImports((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "PUBLISHED" } : entry));
      setMessage("CBT published on the existing paper page.");
    } catch (error) {
      setMessage(error.message || "Could not publish.");
    }
  }

  function updateQuestion(index, key, value) {
    setEditing((current) => ({ ...current, questions: current.questions.map((question, questionIndex) => questionIndex === index ? { ...question, [key]: value } : question) }));
  }

  return <div className="mt-10 space-y-8">
    <form className="card max-w-3xl space-y-4 p-6" onSubmit={upload}><label className="block text-sm"><span className="mb-2 block text-slate-400">Optional paper override for all files</span><select className="field" value={selectedPaper} onChange={(event) => { setSelectedPaper(event.target.value); setPairs((current) => current.map((pair) => ({ ...pair, paperId: event.target.value || pair.paperId }))); }}><option value="">Auto-match from filename/content</option>{papers.map((paper) => <option value={paper.id} key={paper.id}>{paper.examName} · {paper.branchName} · {paper.year} · {paper.shift}</option>)}</select></label><label className="block text-sm"><span className="mb-2 block text-slate-400">Question paper PDF(s)</span><input accept="application/pdf" className="field" multiple required type="file" onChange={chooseQuestionFiles} /></label><label className="block text-sm"><span className="mb-2 block text-slate-400">Official answer-key PDF(s), automatically paired where possible</span><input accept="application/pdf" className="field" multiple type="file" onChange={chooseAnswerFiles} /></label>{pairs.length ? <div className="space-y-2 rounded-xl border border-line p-3"><p className="text-sm font-semibold">Bulk pairing review</p>{pairs.map((pair, index) => <div className="grid gap-2 text-xs sm:grid-cols-[1fr_1fr_1fr] sm:items-center" key={pair.questionFile.name}><span className="truncate">{pair.questionFile.name}</span><select className="field text-xs" value={pair.paperId} onChange={(event) => updatePair(index, "paperId", event.target.value)}><option value="">Manual paper pairing required</option>{papers.map((paper) => <option value={paper.id} key={paper.id}>{paper.branchName} · {paper.year} · {paper.shift}</option>)}</select><span className={pair.answerFile ? "text-mint" : "text-amber-200"}>{pair.answerFile?.name || "Answer key unmatched"}</span></div>)}</div> : null}<button className="button-primary" disabled={busy} type="submit">{busy ? "Queueing and processing..." : "Upload and process bulk"}</button>{message ? <p className="text-sm text-slate-400" role="status">{message}</p> : null}</form>
    <div className="space-y-4"><h2 className="text-2xl font-bold">Imports and verification</h2>{imports.map((item) => <div className="card p-5" key={item.id}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{item.question_pdf_name}</p><p className="mt-1 text-sm text-slate-500">{item.status} · {item.questions?.length || 0} questions</p>{item.metadata?.processingStage ? <p className="mt-1 text-xs text-slate-500">Stage: {item.metadata.processingStage} · Pages: {item.metadata.pageCount || 0} · Text: {item.metadata.textLength || 0} chars · Answers matched: {item.metadata.matchedAnswerCount || 0} · OCR: {item.metadata.ocrUsed ? "yes" : "no"}</p> : null}{item.error_message ? <p className="mt-1 text-xs text-red-300">{item.error_message}</p> : null}{item.metadata?.warnings?.length ? <p className="mt-1 text-xs text-amber-200">{item.metadata.warnings.join(" ")}</p> : null}</div><div className="flex gap-2">{item.status === "FAILED" ? <button className="button-secondary" onClick={() => retry(item)} type="button">Retry</button> : null}{item.status !== "PUBLISHED" ? <button className="button-secondary" onClick={() => setEditing({ ...item, questions: item.questions || [], metadata: item.metadata || {} })} type="button">Review</button> : null}{item.status === "REVIEW" ? <button className="button-primary" onClick={() => publish(item)} type="button">Publish verified CBT</button> : null}</div></div></div>)}</div>
    {editing ? <div className="card space-y-4 p-6"><div className="flex items-center justify-between"><h2 className="text-2xl font-bold">Review extraction</h2><button className="button-secondary" onClick={() => setEditing(null)} type="button">Close</button></div><p className="text-sm text-amber-200">Every question must be marked VERIFIED and have an official answer before publishing.</p>{editing.status === "NEEDS_PAIRING" ? <select className="field" value={editing.paper_id || ""} onChange={(event) => setEditing((current) => ({ ...current, paper_id: event.target.value }))}><option value="">Select matching existing paper</option>{papers.map((paper) => <option value={paper.id} key={paper.id}>{paper.branchName} · {paper.year} · {paper.shift}</option>)}</select> : null}{editing.questions.map((question, index) => <div className="rounded-xl border border-line p-4" key={`${editing.id}-${question.number}`}><p className="font-semibold">{questionLabel(question)}</p><textarea className="field mt-3 min-h-24" value={question.text} onChange={(event) => updateQuestion(index, "text", event.target.value)} /><div className="mt-3 flex flex-wrap gap-3"><select className="field max-w-40" value={question.type} onChange={(event) => updateQuestion(index, "type", event.target.value)}><option>MCQ</option><option>MSQ</option><option>NAT</option></select><input className="field max-w-40" value={question.answer || ""} onChange={(event) => updateQuestion(index, "answer", event.target.value)} placeholder="Official answer" /><select className="field max-w-48" value={question.verificationStatus} onChange={(event) => updateQuestion(index, "verificationStatus", event.target.value)}><option>NEEDS_REVIEW</option><option>VERIFIED</option></select></div></div>)}<button className="button-primary" onClick={saveReview} type="button">Save review</button></div> : null}
  </div>;
}
