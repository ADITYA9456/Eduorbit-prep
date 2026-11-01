const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

async function seed() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set Supabase server credentials before seeding");

  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: exam, error: examError } = await db
    .schema("eduorbit_prep")
    .from("prep_exams")
    .upsert({ name: "GATE", slug: "gate", description: "Graduate Aptitude Test in Engineering", is_active: true }, { onConflict: "slug" })
    .select("id")
    .single();
  if (examError) throw examError;

  const { error: branchError } = await db
    .schema("eduorbit_prep")
    .from("prep_branches")
    .upsert({ exam_id: exam.id, name: "Computer Science & Information Technology", slug: "cse", is_active: true }, { onConflict: "exam_id,slug" });
  if (branchError) throw branchError;
  console.log("Seeded GATE / CSE");
}

seed().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
