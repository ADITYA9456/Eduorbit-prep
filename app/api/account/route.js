import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";
import { limitRequest } from "@/lib/rateLimit";
import { readJson, serverError } from "@/lib/http";

// Tables holding a signed-in student's personal data, keyed by user_id. Used for access (export) and erasure.
const USER_TABLES = [
  "prep_user_progress",
  "prep_user_question_progress",
  "prep_question_notes",
  "prep_user_preparation_branches",
  "prep_user_countdowns",
  "prep_exam_attempts",
  "prep_cbt_responses",
  "prep_practice_responses",
  "cbt_attempts"
];

// Right of access: returns everything stored about the signed-in user as a JSON download.
export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const limited = limitRequest(request, "account-export", { limit: 5, windowMs: 60 * 60 * 1000, userId: user.id });
  if (limited) return limited;
  try {
    const { data: profile, error } = await getPrepTable("prep_users").select("id,email,name,image,created_at").eq("id", user.id).maybeSingle();
    if (error) throw error;
    const data = { exportedAt: new Date().toISOString(), profile, tables: {}, unavailable: [] };
    for (const table of USER_TABLES) {
      const result = await getPrepTable(table).select("*").eq("user_id", user.id);
      if (result.error) data.unavailable.push(table);
      else data.tables[table] = result.data || [];
    }
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="eduorbit-my-data.json"', "Cache-Control": "no-store" }
    });
  } catch (error) {
    return serverError(error, "account-export");
  }
}

// Right of erasure: permanently deletes the signed-in user and, through foreign-key cascades, their progress,
// notes, attempts and responses. The client must send {"confirm":"DELETE"} and then sign out.
export async function DELETE(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const limited = limitRequest(request, "account-delete", { limit: 3, windowMs: 60 * 60 * 1000, userId: user.id });
  if (limited) return limited;
  const body = await readJson(request, 1024);
  if (body?.confirm !== "DELETE") return NextResponse.json({ error: 'Send {"confirm":"DELETE"} to delete your account.' }, { status: 400 });
  try {
    const { error } = await getPrepTable("prep_users").delete().eq("id", user.id);
    if (error) {
      // Accounts that created content (admins) are protected by foreign keys and must be handled by another administrator.
      if (error.code === "23503") return NextResponse.json({ error: "This account owns published content and cannot be deleted here. Contact the site owner." }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return serverError(error, "account-delete");
  }
}
