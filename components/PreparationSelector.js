"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { branchCode } from "@/lib/preparation";

export default function PreparationSelector({ branches, selectedBranches }) {
  const router = useRouter();
  const [selected, setSelected] = useState(selectedBranches);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(nextSelection) {
    if (nextSelection.length < 1 || nextSelection.length > 2 || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/preparation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchIds: nextSelection.map((branch) => branch.id) })
      });
      if (!response.ok) throw new Error((await response.json()).error || "Unable to save preparation papers.");
      setSelected(nextSelection);
      router.refresh();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  function toggle(branch) {
    const exists = selected.some((item) => item.id === branch.id);
    if (exists) {
      if (selected.length === 1) return;
      save(selected.filter((item) => item.id !== branch.id));
      return;
    }
    if (selected.length >= 2) return;
    save([...selected, branch]);
  }

  return (
    <div className="card mt-8 p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="eyebrow">Preparation papers</p>
          <h2 className="mt-3 text-xl font-semibold">Select 1 or 2 GATE papers for your preparation.</h2>
        </div>
        {selected.length === 2 ? <p className="text-sm text-slate-500">Maximum 2 papers allowed.</p> : null}
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((branch) => {
          const isSelected = selected.some((item) => item.id === branch.id);
          const disabled = !isSelected && selected.length >= 2;
          return <button className={`flex items-center justify-between rounded-xl border p-4 text-left transition ${isSelected ? "border-electric bg-electric/10" : "border-line hover:border-electric/60"} ${disabled ? "cursor-not-allowed opacity-45" : ""}`} disabled={disabled || saving} key={branch.id} onClick={() => toggle(branch)} type="button"><span><span className="block font-semibold">{branchCode(branch)}</span><span className="mt-1 block text-xs text-slate-500">{branch.name}</span></span>{isSelected ? <Check className="text-electric" size={18} /> : null}</button>;
        })}
      </div>
      {selected.length ? <div className="mt-5 flex flex-wrap gap-2">{selected.map((branch) => <span className="inline-flex items-center gap-2 rounded-full border border-electric/30 bg-electric/10 px-3 py-1.5 text-sm" key={branch.id}>{branchCode(branch)}<button aria-label={`Remove ${branchCode(branch)}`} className="text-slate-400 hover:text-foreground" disabled={saving || selected.length === 1} onClick={() => toggle(branch)} type="button"><X size={14} /></button></span>)}</div> : <p className="mt-5 text-sm text-amber-300">Choose at least one paper to personalize your workspace.</p>}
      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
