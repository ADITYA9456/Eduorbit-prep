"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PreparationSelector from "@/components/PreparationSelector";

export default function DashboardControls({ branches, selectedBranches, initialSetup = false }) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(selectedBranches);
  const router = useRouter();
  if (initialSetup || editing) return <PreparationSelector branches={branches} selectedBranches={saved} editing={!initialSetup} onSaved={(next) => { setSaved(next); setEditing(false); router.refresh(); }} onCancel={() => setEditing(false)} />;
  return <div className="card flex items-center justify-between p-6"><div><p className="eyebrow">Your papers</p><p className="mt-2 text-sm text-slate-400">{saved.map((branch) => branch.slug.toUpperCase()).join(" & ")}</p></div><button className="button-secondary" onClick={() => setEditing(true)} type="button">Edit Papers</button></div>;
}
