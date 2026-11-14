"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

function answerValue(question) {
  if (question.type === "MSQ") return Array.isArray(question.answer) ? question.answer : [];
  return question.answer ?? "";
}

export default function PracticeReview({ initialTests }) {
  const [tests, setTests] = useState(initialTests);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const onCreated = (event) => setTests((current) => [event.detail, ...current]);
    window.addEventListener("practice-created", onCreated);
    return () => window.removeEventListener("practice-created", onCreated);
  }, []);

  function updateQuestion(index, patch) {
    setEditing((current) => ({
      ...current,
      questions: current.questions.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)
    }));
  }

  async function uploadImages(questionIndex, files) {
    const form = new FormData();
    form.append("questionIndex", String(questionIndex));
    [...files].forEach((file) => form.append("images", file));
    const response = await fetch(`/api/admin/practice/${editing.id}`, { method: "POST", body: form });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to upload images.");
    setEditing((current) => ({ ...current, questions: result.test.questions }));
  }

  async function save(publish = false) {
    let response;
    let result;
    try {
      response = await fetch(`/api/admin/practice/${editing.id}`, {
        method: publish ? "POST" : "PATCH",
        headers: publish ? {} : { "Content-Type": "application/json" },
        body: publish ? undefined : JSON.stringify({ questions: editing.questions, metadata: editing.metadata })
      });
      result = await response.json();
    } catch (error) {
      return setMessage(error.message || "Unable to save Practice test.");
    }
    if (!response.ok) return setMessage(result.error || "Unable to save Practice test.");
    setTests((current) => current.map((test) => test.id === editing.id
      ? { ...test, ...editing, ...(result.test || {}), status: publish ? "PUBLISHED" : "DRAFT" }
      : test));
    setEditing(null);
    setMessage(publish ? "Practice test published." : "Draft saved.");
  }

  return <div className="mt-10 space-y-4">
    <h2 className="text-2xl font-bold">Practice drafts</h2>
    {tests.map((test) => <div className="card p-5" key={test.id}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-semibold">{test.title}</p><p className="mt-1 text-sm text-slate-500">{test.status}, {test.questions?.length || 0} questions</p></div>
        <button className="button-secondary" onClick={() => setEditing({ ...test, questions: test.questions || [], metadata: test.metadata || {} })} type="button">Review</button>
      </div>
    </div>)}
    {!tests.length ? <div className="card p-6 text-slate-400">No Practice drafts yet.</div> : null}
    {editing ? <div className="card space-y-4 p-6">
      <div className="flex items-center justify-between"><h3 className="text-xl font-bold">{editing.title}</h3><button className="button-secondary" onClick={() => setEditing(null)} type="button">Close</button></div>
      <p className="text-sm text-amber-200">Answers are optional while editing. Only manually verified answers are used for evaluation.</p>
      {editing.questions.map((question, index) => <div className="rounded-xl border border-line p-4" key={`${editing.id}-${index}`}>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <label className="block text-sm"><span className="mb-2 block text-slate-400">Question {question.number}</span><textarea className="field min-h-24" value={question.text || ""} onChange={(event) => updateQuestion(index, { text: event.target.value })} /></label>
          <label className="block text-sm"><span className="mb-2 block text-slate-400">Type</span><select className="field" value={question.type || "MCQ"} onChange={(event) => updateQuestion(index, { type: event.target.value, answer: undefined })}><option>MCQ</option><option>MSQ</option><option>NAT</option></select></label>
        </div>
        {question.type !== "NAT" ? <label className="mt-3 block text-sm"><span className="mb-2 block text-slate-400">Options (one per line: A. text)</span><textarea className="field min-h-20" value={(question.options || []).map((option) => `${option.label}. ${option.text}`).join("\n")} onChange={(event) => updateQuestion(index, { options: event.target.value.split("\n").map((line, optionIndex) => { const match = line.match(/^([A-Z])\.\s*(.*)$/); return { label: match?.[1] || String.fromCharCode(65 + optionIndex), text: match?.[2] || line }; }).filter((option) => option.text.trim()) })} /></label> : null}
        <div className="mt-3 rounded-xl border border-line p-3">
          <p className="text-sm font-semibold">Verified correct answer</p>
          {question.type === "MCQ" ? <select className="field mt-2" value={answerValue(question)} onChange={(event) => updateQuestion(index, { answer: event.target.value || undefined })}><option value="">Not evaluated</option>{(question.options || []).map((option) => <option value={option.label} key={option.label}>{option.label}. {option.text}</option>)}</select> : null}
          {question.type === "MSQ" ? <div className="mt-2 grid gap-2 sm:grid-cols-2">{(question.options || []).map((option) => <label className="flex gap-2 text-sm" key={option.label}><input checked={answerValue(question).includes(option.label)} onChange={(event) => { const selected = answerValue(question); updateQuestion(index, { answer: event.target.checked ? [...selected, option.label] : selected.filter((value) => value !== option.label) }); }} type="checkbox" />{option.label}. {option.text}</label>)}</div> : null}
          {question.type === "NAT" ? <input className="field mt-2" inputMode="decimal" placeholder="Leave blank to not evaluate" type="number" value={answerValue(question)} onChange={(event) => updateQuestion(index, { answer: event.target.value === "" ? undefined : Number(event.target.value) })} /> : null}
          <button className="button-secondary mt-2 text-xs" onClick={() => updateQuestion(index, { answer: undefined, answerVerified: false })} type="button">Clear answer</button>
        </div>
        <label className="mt-3 block text-sm"><span className="mb-2 block text-slate-400">Add images (multiple allowed)</span><input accept="image/jpeg,image/png,image/webp" className="field" multiple type="file" onChange={(event) => uploadImages(index, event.target.files).catch((error) => setMessage(error.message))} /></label>
        {question.images?.length ? <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{question.images.map((image, imageIndex) => <div className="rounded-lg border border-line p-2" key={image.path}><div className="relative h-24 w-full"><Image alt={image.name || `Question ${question.number} illustration`} className="rounded-lg object-contain" fill sizes="(min-width: 640px) 160px, 45vw" src={image.url} unoptimized /></div><div className="mt-2 flex justify-between gap-1"><button className="text-xs text-slate-400 disabled:opacity-40" disabled={imageIndex === 0} onClick={() => updateQuestion(index, { images: question.images.map((item, itemIndex) => itemIndex === imageIndex - 1 ? question.images[imageIndex] : itemIndex === imageIndex ? question.images[imageIndex - 1] : item) })} type="button">Up</button><button className="text-xs text-slate-400 disabled:opacity-40" disabled={imageIndex === question.images.length - 1} onClick={() => updateQuestion(index, { images: question.images.map((item, itemIndex) => itemIndex === imageIndex ? question.images[imageIndex + 1] : itemIndex === imageIndex + 1 ? question.images[imageIndex] : item) })} type="button">Down</button><button className="text-xs text-red-300" onClick={() => updateQuestion(index, { images: question.images.filter((_, itemIndex) => itemIndex !== imageIndex) })} type="button">Remove</button></div></div>)}</div> : null}
        <p className="mt-2 text-xs text-slate-500">{(question.extractionWarnings || []).join(" ")}</p>
      </div>)}
      <div className="flex gap-3"><button className="button-secondary" onClick={() => save(false)} type="button">Save review</button><button className="button-primary" onClick={() => save(true)} type="button">Publish</button></div>
    </div> : null}
    {message ? <p className="text-sm text-slate-400" role="status">{message}</p> : null}
  </div>;
}
