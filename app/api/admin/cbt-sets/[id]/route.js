import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";

// Admin-only: publish or unpublish a saved set.
export async function PATCH(request, { params }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (typeof body?.isPublished !== "boolean") return NextResponse.json({ error: "isPublished must be true or false." }, { status: 400 });
  const { data, error } = await getPrepTable("cbt_sets").update({ is_published: body.isPublished, updated_at: new Date().toISOString() }).eq("id", id).select("id,is_published").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Set not found." }, { status: 404 });
  return NextResponse.json({ set: data });
}
