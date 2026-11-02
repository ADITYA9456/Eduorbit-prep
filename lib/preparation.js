export function branchCode(branch) {
  const slug = String(branch?.slug || "").toLowerCase();
  if (slug === "cse") return "CSE";
  if (slug === "ec" || slug === "ece") return "EC";
  return slug ? slug.toUpperCase() : branch?.name || "Unknown";
}

export function preparationLabel(branches) {
  const codes = branches.map(branchCode);
  return codes.length ? `GATE / ${codes.join(" & ")}` : "Select your GATE papers";
}

export async function getSelectedBranches(userId) {
  const { getPrepTable } = await import("@/lib/supabase");
  const { data, error } = await getPrepTable("prep_user_preparation_branches")
    .select("branch_id, position, prep_branches(id, name, slug)")
    .eq("user_id", userId)
    .order("position");
  if (error) throw error;
  return (data || []).map((row) => row.prep_branches).filter(Boolean);
}

export function branchIsSelected(branchId, branches) {
  return !branches.length || branches.some((branch) => branch.id === branchId);
}
