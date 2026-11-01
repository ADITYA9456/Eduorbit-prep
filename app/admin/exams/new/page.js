import AdminForm from "@/components/AdminForm";
import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
export default async function NewExam() { if (!await requireAdmin()) redirect("/dashboard"); return <section className="mx-auto max-w-6xl px-6 py-16"><h1 className="mb-8 text-3xl font-bold">Add examination</h1><AdminForm type="exam" fields={[{ name: "name", label: "Name", required: true }, { name: "slug", label: "Slug", required: true }, { name: "description", label: "Description" }]} /></section>; }
