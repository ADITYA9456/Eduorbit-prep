import { unstable_cache } from "next/cache";
import { getPrepTable } from "@/lib/supabase";

const FALLBACK = [
  "Computer Science & IT", "Data Science & AI", "Electronics & Communication", "Electrical Engineering",
  "Mechanical Engineering", "Civil Engineering", "Instrumentation Engineering", "Chemical Engineering",
  "Biotechnology", "Production & Industrial", "Mathematics", "Physics"
];

const load = unstable_cache(
  async () => {
    const { data, error } = await getPrepTable("prep_branches").select("name").eq("is_active", true).order("name");
    if (error) throw error;
    return (data || []).map((row) => row.name).filter(Boolean);
  },
  ["landing-branch-names"],
  { revalidate: 3600 }
);

// Branch names for the homepage ticker. Cached for an hour so guests never wait on the database.
export async function getBranchNames() {
  try {
    const names = await load();
    return names.length >= 4 ? names : FALLBACK;
  } catch {
    return FALLBACK;
  }
}
