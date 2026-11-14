import Link from "next/link";
import AdminForm from "@/components/AdminForm";
import { requireAdmin } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";
import { redirect } from "next/navigation";
export default async function NewBranch() { if (!await requireAdmin()) redirect("/dashboard"); const { data: exams } = await getPrepTable("prep_exams").select("id,name").eq("is_active", true).order("name"); return <section className="shell py-12 sm:py-16"><nav aria-label="Breadcrumb" className="crumbs"><Link href="/admin">Admin</Link><span aria-hidden="true" className="sep">/</span><span aria-current="page" className="text-foreground">Add branch</span></nav><h1 className="page-title mt-8 mb-8">Add branch</h1><AdminForm type="branch" fields={[{ name: "examId", label: "Examination", required: true, options: (exams || []).map((exam) => ({ value: exam.id, label: exam.name })) }, { name: "name", label: "Name", required: true }, { name: "slug", label: "Slug", required: true }]} /></section>; }
