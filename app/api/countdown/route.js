import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data, error } = await getPrepTable("prep_user_countdowns").select("exam_date").eq("user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ examDate: data?.exam_date || null });
}

export async function PUT(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { examDate } = await request.json();
  if (!validDate(examDate)) return NextResponse.json({ error: "Enter a valid exam date." }, { status: 400 });
  const { data, error } = await getPrepTable("prep_user_countdowns")
    .upsert({ user_id: user.id, exam_date: examDate, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select("exam_date")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ examDate: data.exam_date });
}
