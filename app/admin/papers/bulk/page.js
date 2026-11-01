import { requireAdmin } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";
import { redirect } from "next/navigation";
import BulkPaperForm from "@/components/BulkPaperForm";

export default async function BulkPapersPage() {
  if (!await requireAdmin()) redirect("/dashboard");
  const [{ data: exams }, { data: branches }] = await Promise.all([
    getPrepTable("prep_exams").select("id,name").eq("is_active", true).order("name"),
    getPrepTable("prep_branches").select("id,name").eq("is_active", true).order("name")
  ]);
  return <section className="mx-auto max-w-6xl px-6 py-16"><h1 className="mb-4 text-3xl font-bold">Add papers in bulk</h1><p className="mb-8 max-w-2xl text-slate-400">One paper per line: year | shift | paper URL | solution URL (optional)</p><BulkPaperForm exams={exams || []} branches={branches || []} /></section>;
}
