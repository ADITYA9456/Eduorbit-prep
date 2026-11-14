"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PreparationSelector from "@/components/PreparationSelector";

export default function DashboardControls({ branches, selectedBranches, initialSetup = false }) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(selectedBranches);
  const router = useRouter();
  if (initialSetup || editing) return <PreparationSelector branches={branches} selectedBranches={saved} editing={!initialSetup} onSaved={(next) => { setSaved(next); setEditing(false); router.refresh(); }} onCancel={() => setEditing(false)} />;
  return <div className="panel flex items-start justify-between gap-4 p-6"><div><p className="eyebrow">Your papers</p><p className="mt-2 text-2xl font-medium tracking-tight">{saved.map((branch) => branch.slug.toUpperCase()).join(" and ")}</p></div><button className="button-ghost btn-sm" onClick={() => setEditing(true)} type="button">Change papers</button></div>;
}
