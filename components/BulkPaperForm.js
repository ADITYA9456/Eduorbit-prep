"use client";
import { useState } from "react";

export default function BulkPaperForm({ exams, branches }) {
  const [examId, setExamId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [rows, setRows] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId, branchId, rows: rows.split(/\r?\n/).filter(Boolean) })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save papers.");
      setMessage(`${result.saved.length} papers saved.`);
    } catch (saveError) {
      setMessage(saveError.message || "Unable to save papers.");
    } finally {
      setSaving(false);
    }
  }
  return <form className="panel max-w-3xl space-y-5 p-6" onSubmit={submit}>
    <div className="grid gap-5 sm:grid-cols-2"><label className="block"><span className="field-label">Exam</span><select className="field" required value={examId} onChange={(event) => setExamId(event.target.value)}><option value="">Select exam</option>{exams.map((exam) => <option value={exam.id} key={exam.id}>{exam.name}</option>)}</select></label>
    <label className="block"><span className="field-label">Branch</span><select className="field" required value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">Select branch</option>{branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}</select></label></div>
    <label className="block"><span className="field-label">Papers, one per line</span><textarea className="field min-h-64 font-mono text-sm" required value={rows} onChange={(event) => setRows(event.target.value)} placeholder={"2025 | Shift 1 | https://example.com/CS12025.pdf\n2025 | Shift 2 | https://example.com/CS22025.pdf"} /></label>
    <button className="button-primary" disabled={saving} type="submit">{saving ? "Saving papers..." : "Save all papers"}</button>
    {message && <p className="text-sm text-slate-400" role="status">{message}</p>}
  </form>;
}
