import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getPrepTable, getSupabaseServer } from "@/lib/supabase";
import { processImport, uploadSource } from "@/lib/cbt";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 120;
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const PDF_TYPES = ["application/pdf"];
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function GET(request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const branchId = new URL(request.url).searchParams.get("branchId");
  if (!branchId) return NextResponse.json({ subjects: [] });
  const { data, error } = await getPrepTable("prep_branch_subjects")
    .select("subject_id,prep_subjects(id,name,slug)")
    .eq("branch_id", branchId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ subjects: (data || []).map((item) => item.prep_subjects).filter(Boolean) });
}

export async function POST(request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const form = await request.formData();
  const branchId = String(form.get("branchId") || "");
  const testType = String(form.get("testType") || "");
  const subjectId = String(form.get("subjectId") || "") || null;
  const files = form.getAll("sourceFiles");
  if (!branchId || !["SUBJECT", "FULL_LENGTH"].includes(testType)) return NextResponse.json({ error: "Branch and test type are required." }, { status: 400 });
  if (testType === "SUBJECT" && !subjectId) return NextResponse.json({ error: "Subject is required for a Subject Test." }, { status: 400 });
  if (testType === "FULL_LENGTH" && subjectId) return NextResponse.json({ error: "Full Length tests cannot have a subject." }, { status: 400 });
  if (!files.length || files.length > 10) return NextResponse.json({ error: "Upload between one and ten source files." }, { status: 400 });
  const { data: branch, error: branchError } = await getPrepTable("prep_branches").select("id,exam_id,name").eq("id", branchId).eq("is_active", true).single();
  if (branchError || !branch) return NextResponse.json({ error: "Selected branch was not found." }, { status: 400 });
  if (subjectId) {
    const { data: mapping } = await getPrepTable("prep_branch_subjects").select("subject_id").eq("branch_id", branchId).eq("subject_id", subjectId).maybeSingle();
    if (!mapping) return NextResponse.json({ error: "Subject is not mapped to the selected branch." }, { status: 400 });
  }
  const { data: subject } = subjectId ? await getPrepTable("prep_subjects").select("name").eq("id", subjectId).single() : { data: null };
  const counterType = testType === "SUBJECT" ? "SUBJECT" : "FULL_LENGTH";
  const { data: counter, error: counterError } = await getSupabaseServer().schema("eduorbit_prep").rpc("next_practice_counter", { requested_branch_id: branchId, requested_counter_type: counterType });
  if (counterError) return NextResponse.json({ error: counterError.message }, { status: 400 });
  const testNumber = Number(counter);
  const title = testType === "SUBJECT" ? `${subject.name} TEST ${testNumber}` : `FULL LENGTH TEST ${testNumber}`;
  const id = crypto.randomUUID();
  const sourceFiles = [];
  let questions = [];
  const warnings = [];
  for (const file of files) {
    if (!file || typeof file.arrayBuffer !== "function" || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: `Invalid or oversized source file: ${file?.name || "unknown"}` }, { status: 400 });
    const contentType = String(file.type || "").toLowerCase();
    if (![...PDF_TYPES, ...IMAGE_TYPES].includes(contentType)) return NextResponse.json({ error: `Unsupported file type: ${file.name}` }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const path = `${admin.id}/practice/${id}/${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    await uploadSource(path, buffer, contentType, "eduorbit-practice-sources");
    sourceFiles.push({ name: file.name, type: contentType, path });
    if (contentType === "application/pdf") {
      const extraction = await processImport({ questionBuffer: buffer, questionName: file.name });
      questions = [...questions, ...extraction.questions];
      warnings.push(...extraction.warnings);
    } else {
      warnings.push(`${file.name}: image retained for review; OCR requires the separately deployed worker described in the deployment documentation.`);
    }
  }
  const metadata = { warnings, manualReviewRequired: true, sourceCount: sourceFiles.length, extractedQuestionCount: questions.length };
  const { data: test, error } = await getPrepTable("prep_practice_tests").insert({
    id, exam_id: branch.exam_id, branch_id: branchId, subject_id: subjectId, test_type: testType,
    test_number: testNumber, title, source_files: sourceFiles, questions, metadata, created_by: admin.id
  }).select("id,title,test_type,test_number,status,questions,metadata").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ test }, { status: 201 });
}
