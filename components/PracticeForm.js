"use client";
import { useEffect, useState } from "react";

export default function PracticeForm({ branches, subjects }) {
  const [values, setValues] = useState({ branchId: "", testType: "SUBJECT", subjectId: "" });
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [availableSubjects, setAvailableSubjects] = useState([]);
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
    <label className="block text-sm"><span className="mb-2 block text-slate-400">Test type</span><select className="field" value={values.testType} onChange={(event) => setValues({ ...values, testType: event.target.value, subjectId: "" })}><option value="SUBJECT">Subject Test</option><option value="FULL_LENGTH">Full Length Test</option></select></label>
    {values.testType === "SUBJECT" ? <label className="block text-sm"><span className="mb-2 block text-slate-400">Subject</span><select className="field" required value={values.subjectId} onChange={(event) => setValues({ ...values, subjectId: event.target.value })}><option value="">Select subject</option>{availableSubjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select></label> : null}
    <label className="block text-sm"><span className="mb-2 block text-slate-400">Question source (PDF, JPG, PNG, or WEBP)</span><input className="field" accept="application/pdf,image/jpeg,image/png,image/webp" multiple required type="file" onChange={(event) => setFiles([...event.target.files])} /></label>
    <p className="text-xs leading-5 text-slate-500">PDF text is parsed deterministically. Images are retained as source files and flagged for OCR-worker review; no AI inference is used.</p>
    <button className="button-primary" disabled={saving} type="submit">{saving ? "Processing..." : "Create Practice draft"}</button>{message ? <p className="text-sm text-slate-400" role="status">{message}</p> : null}
  </form>;
}
