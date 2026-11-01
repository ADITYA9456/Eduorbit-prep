import AdminForm from "@/components/AdminForm";
import { requireAdmin } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";
import { redirect } from "next/navigation";
export default async function NewBranch() { if (!await requireAdmin()) redirect("/dashboard"); const { data: exams } = await getPrepTable("prep_exams").select("id,name").eq("is_active", true).order("name"); return <section className="mx-auto max-w-6xl px-6 py-16"><h1 className="mb-8 text-3xl font-bold">Add branch</h1><AdminForm type="branch" fields={[{ name: "examId", label: "Examination", required: true, options: (exams || []).map((exam) => ({ value: exam.id, label: exam.name })) }, { name: "name", label: "Name", required: true }, { name: "slug", label: "Slug", required: true }]} /></section>; }
