"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PreparationSelector from "@/components/PreparationSelector";

export default function DashboardControls({ branches, selectedBranches, initialSetup = false }) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(selectedBranches);
  const router = useRouter();
  if (initialSetup || editing) return <PreparationSelector branches={branches} selectedBranches={saved} editing={!initialSetup} onSaved={(next) => { setSaved(next); setEditing(false); router.refresh(); }} onCancel={() => setEditing(false)} />;
  return <div className="spot dash-card flex items-start justify-between gap-4"><div><p className="eyebrow">Your branches</p><ul className="mt-4 flex flex-wrap gap-2">{saved.map((branch) => <li className="paper-chip" key={branch.id}>{branch.slug.toUpperCase()}</li>)}</ul></div><button className="button-ghost btn-sm" onClick={() => setEditing(true)} type="button">Change branches</button></div>;
}
