import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";

async function getContext() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data: exam, error: examError } = await getPrepTable("prep_exams").select("id").eq("slug", "gate").eq("is_active", true).maybeSingle();
  if (examError) throw examError;
  if (!exam) throw new Error("GATE examination is not configured");
  return { user, exam };
}

async function validBranches(examId, branchIds) {
  if (!Array.isArray(branchIds) || branchIds.length < 1 || branchIds.length > 2) return null;
  const uniqueIds = [...new Set(branchIds)];
  if (uniqueIds.length !== branchIds.length) return null;
  const { data, error } = await getPrepTable("prep_branches").select("id, name, slug").eq("exam_id", examId).eq("is_active", true).in("id", uniqueIds);
  if (error) throw error;
  return data?.length === uniqueIds.length ? data : null;
}

export async function GET() {
  try {
    const context = await getContext();
    if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { data, error } = await getPrepTable("prep_user_preparation_branches")
      .select("branch_id, position, prep_branches(id, name, slug)")
      .eq("user_id", context.user.id)
      .order("position");
    if (error) throw error;
    return NextResponse.json({ branches: (data || []).map((item) => item.prep_branches) });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const context = await getContext();
    if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const body = await request.json();
    const branchIds = body?.branchIds;
    const branches = await validBranches(context.exam.id, branchIds);
    if (!branches) return NextResponse.json({ error: "Select one or two valid GATE papers." }, { status: 400 });

    const { error: deleteError } = await getPrepTable("prep_user_preparation_branches").delete().eq("user_id", context.user.id);
    if (deleteError) throw deleteError;
    const { error: insertError } = await getPrepTable("prep_user_preparation_branches").insert(
      branchIds.map((branchId, index) => ({ user_id: context.user.id, branch_id: branchId, position: index + 1 }))
    );
    if (insertError) throw insertError;
    return NextResponse.json({ branches });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
