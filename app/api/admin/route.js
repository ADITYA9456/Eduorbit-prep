import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getPrepTable } from "@/lib/supabase";
import { isUuid, readJson, tooLarge } from "@/lib/http";
import { logAdminAction } from "@/lib/audit";

const SAVE_FAILED = "Could not save. Check the values and try again.";
const MAPPING = { isActive: "is_active", isPublished: "is_published", examId: "exam_id", branchId: "branch_id", questionCount: "question_count", officialPaperUrl: "official_paper_url", officialSolutionUrl: "official_solution_url", externalPdfUrl: "external_pdf_url" };
const SLUG = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

// Per-type allowlist: only these body keys are ever written. Unknown keys are ignored.
const FIELDS = {
  exam: { table: "prep_exams", required: ["name", "slug"], fields: { name: { kind: "text", max: 200 }, slug: { kind: "slug", max: 100 }, description: { kind: "text", max: 5000 }, isActive: { kind: "boolean" } } },
  branch: { table: "prep_branches", required: ["examId", "name", "slug"], fields: { examId: { kind: "uuid" }, name: { kind: "text", max: 200 }, slug: { kind: "slug", max: 100 }, isActive: { kind: "boolean" } } },
  paper: { table: "prep_papers", required: ["examId", "branchId", "year", "shift", "title"], fields: { examId: { kind: "uuid" }, branchId: { kind: "uuid" }, year: { kind: "int", min: 1900, max: 2200 }, shift: { kind: "text", max: 100 }, title: { kind: "text", max: 500 }, description: { kind: "text", max: 5000 }, officialPaperUrl: { kind: "url" }, officialSolutionUrl: { kind: "url" }, externalPdfUrl: { kind: "url" }, questionCount: { kind: "int", min: 1, max: 10000 }, isPublished: { kind: "boolean" } } }
};

function validUrl(value) { return value.length <= 2000 && /^https?:\/\/\S+$/i.test(value); }

// Returns { value } or { error } for one field.
function cleanField(name, spec, raw) {
  if (spec.kind === "boolean") return typeof raw === "boolean" ? { value: raw } : { error: `${name} must be true or false.` };
  if (spec.kind === "int") {
    const number = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
    return Number.isInteger(number) && number >= spec.min && number <= spec.max ? { value: number } : { error: `${name} must be a whole number between ${spec.min} and ${spec.max}.` };
  }
  if (typeof raw !== "string") return { error: `${name} must be text.` };
  const text = raw.trim();
  if (spec.kind === "uuid") return isUuid(text) ? { value: text } : { error: `${name} is invalid.` };
  if (spec.kind === "url") {
    if (!text) return { value: null };
    return validUrl(text) ? { value: text } : { error: "URLs must use http or https and be at most 2000 characters." };
  }
  if (text.length > spec.max) return { error: `${name} must be at most ${spec.max} characters.` };
  if (spec.kind === "slug" && !SLUG.test(text)) return { error: "Slug can only use letters, numbers, hyphens and underscores." };
  return { value: text };
}

export async function POST(request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await readJson(request, 64 * 1024);
  if (!body) return tooLarge();
  const config = FIELDS[body.type];
  if (!config) return NextResponse.json({ error: "Unsupported content type" }, { status: 400 });
  const table = config.table;
  const data = {};
  for (const [name, spec] of Object.entries(config.fields)) {
    if (body[name] === undefined || body[name] === null || (body[name] === "" && spec.kind !== "text" && spec.kind !== "url")) continue;
    const cleaned = cleanField(name, spec, body[name]);
    if (cleaned.error) return NextResponse.json({ error: cleaned.error }, { status: 400 });
    data[MAPPING[name] || name] = cleaned.value;
  }
  for (const name of config.required) {
    const column = MAPPING[name] || name;
    if (data[column] === undefined || data[column] === "") return NextResponse.json({ error: `${name} is required.` }, { status: 400 });
  }
  const query = body.type === "paper"
    ? getPrepTable(table).select("id").eq("exam_id", data.exam_id).eq("branch_id", data.branch_id).eq("year", data.year).eq("shift", data.shift).order("created_at", { ascending: true }).limit(1).maybeSingle()
    : null;
  const { data: existing, error: findError } = query ? await query : { data: null, error: null };
  if (findError) { console.error("[admin save] lookup failed", findError.message); return NextResponse.json({ error: SAVE_FAILED }, { status: 400 }); }
  const branchQuery = body.type === "branch"
    ? getPrepTable(table).select("id").eq("exam_id", data.exam_id).eq("slug", data.slug).limit(1).maybeSingle()
    : null;
  const { data: existingBranch, error: branchFindError } = branchQuery ? await branchQuery : { data: null, error: null };
  if (branchFindError) { console.error("[admin save] branch lookup failed", branchFindError.message); return NextResponse.json({ error: SAVE_FAILED }, { status: 400 }); }
  const saveQuery = existing || existingBranch
    ? getPrepTable(table).update(data).eq("id", (existing || existingBranch).id)
    : getPrepTable(table).insert(data);
  const { data: document, error } = await saveQuery.select().single();
  if (error) { console.error("[admin save] write failed", error.message); return NextResponse.json({ error: SAVE_FAILED }, { status: 400 }); }
  await logAdminAction(admin, "content.save", { targetType: table, targetId: document?.id, metadata: { type: body.type, updated: Boolean(existing || existingBranch) }, request });
  return NextResponse.json({ document }, { status: 201 });
}
