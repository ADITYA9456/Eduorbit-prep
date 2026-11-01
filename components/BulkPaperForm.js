"use client";
import { useState } from "react";

export default function BulkPaperForm({ exams, branches }) {
  const [examId, setExamId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [rows, setRows] = useState("");
  const [message, setMessage] = useState("");
  async function submit(event) {
    event.preventDefault();
    setMessage("Saving papers…");
    const response = await fetch("/api/admin/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examId, branchId, rows: rows.split(/\r?\n/).filter(Boolean) })
    });
    const result = await response.json();
    setMessage(response.ok ? `${result.saved.length} papers saved.` : result.error || "Unable to save papers.");
  }
  return <form className="card max-w-3xl space-y-4 p-6" onSubmit={submit}>
    <select className="field" required value={examId} onChange={(event) => setExamId(event.target.value)}><option value="">Select exam</option>{exams.map((exam) => <option value={exam.id} key={exam.id}>{exam.name}</option>)}</select>
    <select className="field" required value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">Select branch</option>{branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}</select>
    <textarea className="field min-h-64 font-mono text-sm" required value={rows} onChange={(event) => setRows(event.target.value)} placeholder={"2025 | Shift 1 | https://example.com/CS12025.pdf\n2025 | Shift 2 | https://example.com/CS22025.pdf"} />
    <button className="button-primary" type="submit">Save all papers</button>
    {message && <p className="text-sm text-slate-400">{message}</p>}
  </form>;
}
