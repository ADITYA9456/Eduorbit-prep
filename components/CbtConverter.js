"use client";

import { useState } from "react";

function questionLabel(question) {
  return `${question.number}. ${question.type} — ${question.verificationStatus}`;
}

export default function CbtConverter({ papers, initialImports }) {
  const [selectedPaper, setSelectedPaper] = useState("");
  const [questionFiles, setQuestionFiles] = useState([]);
  const [answerFiles, setAnswerFiles] = useState([]);
  const [imports, setImports] = useState(initialImports);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);

  async function upload(event) {
    event.preventDefault();
    if (!selectedPaper || !questionFiles.length || busy) return;
    setBusy(true);
    setMessage("Processing PDFs...");
    try {
      for (let index = 0; index < questionFiles.length; index += 1) {
        const form = new FormData();
        form.append("paperId", selectedPaper);
        form.append("questionPdf", questionFiles[index]);
        if (answerFiles[index]) form.append("answerKeyPdf", answerFiles[index]);
        const response = await fetch("/api/admin/cbt", { method: "POST", body: form });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "PDF processing failed.");
        setImports((current) => [payload.import, ...current]);
        setMessage(`Processed ${index + 1} of ${questionFiles.length}.`);
      }
      setMessage("Processing complete. Review every question before publishing.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function retry(item) {
    setMessage("Retrying processing...");
    const response = await fetch(`/api/admin/cbt/${item.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "retry" }) });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error || "Retry failed.");
    setImports((current) => current.map((entry) => entry.id === item.id ? payload.import : entry));
    setMessage("Retry complete.");
  }

  async function saveReview() {
    if (!editing) return;
    const response = await fetch(`/api/admin/cbt/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questions: editing.questions, metadata: editing.metadata }) });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error || "Could not save review.");
    setImports((current) => current.map((item) => item.id === editing.id ? { ...item, ...payload.import } : item));
    setEditing(null);
    setMessage("Review saved.");
  }

  async function publish(item) {
    const response = await fetch(`/api/admin/cbt/${item.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error || "Could not publish.");
    setImports((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "PUBLISHED" } : entry));
    setMessage("CBT published on the existing paper page.");
  }

  function updateQuestion(index, key, value) {
    setEditing((current) => ({ ...current, questions: current.questions.map((question, questionIndex) => questionIndex === index ? { ...question, [key]: value } : question) }));
  }

  return <div className="mt-10 space-y-8">
    <form className="card max-w-3xl space-y-4 p-6" onSubmit={upload}><label className="block text-sm"><span className="mb-2 block text-slate-400">Existing paper</span><select className="field" required value={selectedPaper} onChange={(event) => setSelectedPaper(event.target.value)}><option value="">Select paper to link safely</option>{papers.map((paper) => <option value={paper.id} key={paper.id}>{paper.examName} · {paper.branchName} · {paper.year} · {paper.shift}</option>)}</select></label><label className="block text-sm"><span className="mb-2 block text-slate-400">Question paper PDF(s)</span><input accept="application/pdf" className="field" multiple required type="file" onChange={(event) => setQuestionFiles([...event.target.files])} /></label><label className="block text-sm"><span className="mb-2 block text-slate-400">Official answer-key PDF(s), matching question PDF order</span><input accept="application/pdf" className="field" multiple type="file" onChange={(event) => setAnswerFiles([...event.target.files])} /></label><button className="button-primary" disabled={busy} type="submit">{busy ? "Processing..." : "Upload and process"}</button>{message ? <p className="text-sm text-slate-400" role="status">{message}</p> : null}</form>
    <div className="space-y-4"><h2 className="text-2xl font-bold">Imports and verification</h2>{imports.map((item) => <div className="card p-5" key={item.id}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{item.question_pdf_name}</p><p className="mt-1 text-sm text-slate-500">{item.status} · {item.questions?.length || 0} questions</p>{item.metadata?.processingStage ? <p className="mt-1 text-xs text-slate-500">Stage: {item.metadata.processingStage} · Pages: {item.metadata.pageCount || 0} · Text: {item.metadata.textLength || 0} chars · Answers matched: {item.metadata.matchedAnswerCount || 0} · OCR: {item.metadata.ocrUsed ? "yes" : "no"}</p> : null}{item.error_message ? <p className="mt-1 text-xs text-red-300">{item.error_message}</p> : null}{item.metadata?.warnings?.length ? <p className="mt-1 text-xs text-amber-200">{item.metadata.warnings.join(" ")}</p> : null}</div><div className="flex gap-2">{item.status === "FAILED" ? <button className="button-secondary" onClick={() => retry(item)} type="button">Retry</button> : null}{item.status !== "PUBLISHED" ? <button className="button-secondary" onClick={() => setEditing({ ...item, questions: item.questions || [], metadata: item.metadata || {} })} type="button">Review</button> : null}{item.status === "REVIEW" ? <button className="button-primary" onClick={() => publish(item)} type="button">Publish verified CBT</button> : null}</div></div></div>)}</div>
    {editing ? <div className="card space-y-4 p-6"><div className="flex items-center justify-between"><h2 className="text-2xl font-bold">Review extraction</h2><button className="button-secondary" onClick={() => setEditing(null)} type="button">Close</button></div><p className="text-sm text-amber-200">Every question must be marked VERIFIED and have an official answer before publishing.</p>{editing.questions.map((question, index) => <div className="rounded-xl border border-line p-4" key={`${editing.id}-${question.number}`}><p className="font-semibold">{questionLabel(question)}</p><textarea className="field mt-3 min-h-24" value={question.text} onChange={(event) => updateQuestion(index, "text", event.target.value)} /><div className="mt-3 flex flex-wrap gap-3"><select className="field max-w-40" value={question.type} onChange={(event) => updateQuestion(index, "type", event.target.value)}><option>MCQ</option><option>MSQ</option><option>NAT</option></select><input className="field max-w-40" value={question.answer || ""} onChange={(event) => updateQuestion(index, "answer", event.target.value)} placeholder="Official answer" /><select className="field max-w-48" value={question.verificationStatus} onChange={(event) => updateQuestion(index, "verificationStatus", event.target.value)}><option>NEEDS_REVIEW</option><option>VERIFIED</option></select></div></div>)}<button className="button-primary" onClick={saveReview} type="button">Save review</button></div> : null}
  </div>;
}
