import Link from "next/link";
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
  return <section className="shell py-12 sm:py-16"><nav aria-label="Breadcrumb" className="crumbs"><Link href="/admin">Admin</Link><span aria-hidden="true" className="sep">/</span><span aria-current="page" className="text-foreground">Add papers in bulk</span></nav><h1 className="page-title mt-8">Add papers in bulk</h1><p className="lede mb-8 mt-3">One paper per line: year | shift | paper URL | solution URL (optional).</p><BulkPaperForm exams={exams || []} branches={branches || []} /></section>;
}
