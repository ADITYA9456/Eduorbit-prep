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
