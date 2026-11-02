"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { branchCode } from "@/lib/preparation";

export default function PreparationSelector({ branches, selectedBranches, onSaved, onCancel, editing = false }) {
  const [selected, setSelected] = useState(selectedBranches);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggle(branch) {
    setSelected((current) => {
      if (current.some((item) => item.id === branch.id)) return current.filter((item) => item.id !== branch.id);
      if (current.length >= 2) return current;
      return [...current, branch];
    });
  }

  async function save() {
    if (selected.length < 1 || selected.length > 2 || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/preparation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchIds: selected.map((branch) => branch.id) })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save preparation papers.");
      onSaved(result.branches);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div><p className="eyebrow">Preparation papers</p><h2 className="mt-3 text-xl font-semibold">Select 1 or 2 GATE papers for your preparation.</h2></div>
        {selected.length === 2 ? <p className="text-sm text-slate-500">Maximum 2 papers allowed.</p> : null}
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((branch) => {
          const isSelected = selected.some((item) => item.id === branch.id);
          const disabled = !isSelected && selected.length >= 2;
          return <button aria-pressed={isSelected} className={`flex items-center justify-between rounded-xl border p-4 text-left transition ${isSelected ? "border-electric bg-electric/10" : "border-line hover:border-electric/60"} ${disabled ? "cursor-not-allowed opacity-45" : ""}`} disabled={disabled || saving} key={branch.id} onClick={() => toggle(branch)} type="button"><span><span className="block font-semibold">{branchCode(branch)}</span><span className="mt-1 block text-xs text-slate-500">{branch.name}</span></span>{isSelected ? <Check className="text-electric" size={18} /> : null}</button>;
        })}
      </div>
      {selected.length ? <div className="mt-5 flex flex-wrap gap-2">{selected.map((branch) => <span className="inline-flex items-center gap-2 rounded-full border border-electric/30 bg-electric/10 px-3 py-1.5 text-sm" key={branch.id}>{branchCode(branch)}<button aria-label={`Remove ${branchCode(branch)}`} className="text-slate-400 hover:text-foreground" disabled={saving || selected.length === 1} onClick={() => toggle(branch)} type="button"><X size={14} /></button></span>)}</div> : <p className="mt-5 text-sm text-amber-300">Choose at least one paper to personalize your workspace.</p>}
      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      <div className="mt-6 flex flex-wrap gap-3"><button className="button-primary" disabled={saving || selected.length < 1} onClick={save} type="button">{saving ? "Saving..." : "Save Selection"}</button>{editing ? <button className="button-secondary" disabled={saving} onClick={onCancel} type="button">Cancel</button> : null}</div>
    </div>
  );
}
