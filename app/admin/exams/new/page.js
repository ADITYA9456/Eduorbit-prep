import Link from "next/link";
import AdminForm from "@/components/AdminForm";
import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
export default async function NewExam() { if (!await requireAdmin()) redirect("/dashboard"); return <section className="shell py-12 sm:py-16"><nav aria-label="Breadcrumb" className="crumbs"><Link href="/admin">Admin</Link><span aria-hidden="true" className="sep">/</span><span aria-current="page" className="text-foreground">Add examination</span></nav><h1 className="page-title mt-8 mb-8">Add examination</h1><AdminForm type="exam" fields={[{ name: "name", label: "Name", required: true }, { name: "slug", label: "Slug", required: true }, { name: "description", label: "Description" }]} /></section>; }
