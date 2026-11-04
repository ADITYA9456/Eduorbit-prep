"use client";
import { useEffect, useRef, useState } from "react";

export default function PracticeForm({ branches, subjects }) {
  const [values, setValues] = useState({ branchId: "", testType: "SUBJECT", subjectId: "", durationSeconds: "3600" });
  const [files, setFiles] = useState([]);
  const fileInput = useRef(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  function addFiles(fileList) {
    const selected = Array.from(fileList || []);
    const supported = selected.filter((file) => /\.(pdf|jpe?g|png|webp)$/i.test(file.name));
    if (supported.length !== selected.length) {
      setMessage("Only PDF, JPG, JPEG, PNG, and WEBP files are supported.");
    }
    if (supported.length) {
      setFiles((current) => [...current, ...supported]);
    }
  }
  useEffect(() => {
    if (!values.branchId) { setAvailableSubjects([]); return; }
    const initial = subjects.filter((subject) => subject.branch_id === values.branchId);
    setAvailableSubjects(initial);
    fetch(`/api/admin/practice?branchId=${values.branchId}`).then((response) => response.json()).then((result) => {
      if (Array.isArray(result.subjects)) setAvailableSubjects(result.subjects);
    }).catch(() => setAvailableSubjects(initial));
  }, [values.branchId, subjects]);
  async function submit(event) {
    event.preventDefault();
    setSaving(true); setMessage("Extracting source files...");
    try {
      const form = new FormData();
      Object.entries(values).forEach(([key, value]) => form.append(key, value));
      files.forEach((file) => form.append("sourceFiles", file));
      const response = await fetch("/api/admin/practice", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to create Practice test.");
      setMessage(`${result.test.title} created as a draft. Review it below before publishing.`);
      window.dispatchEvent(new CustomEvent("practice-created", { detail: result.test }));
    } catch (error) { setMessage(error.message); } finally { setSaving(false); }
  }
  return <form className="card max-w-2xl space-y-4 p-6" onSubmit={submit}>
    <label className="block text-sm"><span className="mb-2 block text-slate-400">Branch</span><select className="field" required value={values.branchId} onChange={(event) => setValues({ ...values, branchId: event.target.value, subjectId: "" })}><option value="">Select branch</option>{branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}</select></label>
    <label className="block text-sm"><span className="mb-2 block text-slate-400">Test type</span><select className="field" value={values.testType} onChange={(event) => setValues({ ...values, testType: event.target.value, subjectId: "", durationSeconds: event.target.value === "SUBJECT" ? "3600" : "10800" })}><option value="SUBJECT">Subject Test</option><option value="FULL_LENGTH">Full Length Test</option></select></label>
    <label className="block text-sm"><span className="mb-2 block text-slate-400">Duration (minutes)</span><input className="field" min="1" max="1440" required type="number" value={Math.round(Number(values.durationSeconds) / 60)} onChange={(event) => setValues({ ...values, durationSeconds: String(Number(event.target.value) * 60) })} /></label>
    {values.testType === "SUBJECT" ? <label className="block text-sm"><span className="mb-2 block text-slate-400">Subject</span><select className="field" required value={values.subjectId} onChange={(event) => setValues({ ...values, subjectId: event.target.value })}><option value="">Select subject</option>{availableSubjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select></label> : null}
    <div className="block text-sm"><span className="mb-2 block text-slate-400">Question source (PDF, JPG, PNG, or WEBP)</span><input ref={fileInput} className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" multiple required={!files.length} type="file" onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} /><button className="button-secondary" onClick={() => fileInput.current?.click()} type="button">Choose Files</button>{files.length ? <span className="ml-3 text-xs text-slate-500">{files.length} file{files.length === 1 ? "" : "s"} selected</span> : <span className="ml-3 text-xs text-slate-500">No file chosen</span>}</div>
    <button className="button-secondary" onClick={() => fileInput.current?.click()} type="button">Add More Images</button>
    {files.length ? <div className="space-y-1 text-xs text-slate-500">{files.map((file, index) => <div className="flex items-center justify-between gap-3" key={`${file.name}-${index}`}><span className="truncate">{file.name}</span><button className="text-red-300" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} type="button">Remove</button></div>)}</div> : null}
    <p className="text-xs leading-5 text-slate-500">PDF text is parsed deterministically. Images are OCR-processed with Tesseract.js and preserved as source attachments; review uncertain output before publishing.</p>
    <button className="button-primary" disabled={saving} type="submit">{saving ? "Processing..." : "Create Practice draft"}</button>{message ? <p className="text-sm text-slate-400" role="status">{message}</p> : null}
  </form>;
}
