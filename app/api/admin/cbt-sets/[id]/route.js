import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getPrepTable, getSupabaseServer } from "@/lib/supabase";
import { readJson, serverError } from "@/lib/http";
import { saveFailed } from "@/lib/adminHttp";
import { logAdminAction } from "@/lib/audit";
import { CBT_SET_BUCKET, isMissingColumn } from "@/lib/cbtSets";
import { cleanMarks, defaultNegativeMarks, normalizeType } from "@/lib/cbtSetShared";

const UUID = /^[0-9a-f-]{36}$/i;
const SET_FIELDS = "id,title,year,is_published";
const TYPE_FIELDS = "type,marks,negative_marks,correct_keys,nat_min,nat_max";
const MIGRATION_012 = "Question types, marks and negative marks need database migration 012_cbt_set_question_types.sql to be run first.";

function blank(value) {
  return value === undefined || value === null || (typeof value === "string" && !value.trim());
}

function fail(message) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function badId(id) {
  return UUID.test(String(id)) ? null : NextResponse.json({ error: "Invalid set id." }, { status: 400 });
}

// Admin-only: load a saved set with its questions so the answer key can be corrected.
export async function GET(_request, { params }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { id } = await params;
  const invalid = badId(id);
  if (invalid) return invalid;
  // Columns from migrations 011 (duration) and 012 (question types) may be missing: try the newest shape first.
  const attempts = [[true, true], [true, false], [false, true], [false, false]];
  let data = null;
  let error = null;
  for (const [withTypes, withDuration] of attempts) {
    const fields = `${SET_FIELDS},cbt_questions(id,number,position,text,explanation,correct_key${withTypes ? `,${TYPE_FIELDS}` : ""},cbt_options(key,text,position))${withDuration ? ",duration_minutes" : ""}`;
    ({ data, error } = await getPrepTable("cbt_sets").select(fields).eq("id", id).maybeSingle());
    if (!error || !isMissingColumn(error)) break;
  }
  if (error) return serverError(error, "admin cbt-set get");
  if (!data) return NextResponse.json({ error: "Set not found." }, { status: 404 });
  const questions = [...(data.cbt_questions || [])].sort((a, b) => a.position - b.position).map((question) => {
    const type = normalizeType(question.type);
    const marks = cleanMarks(question.marks, 1);
    const negative = question.negative_marks === null || question.negative_marks === undefined ? defaultNegativeMarks(type, marks) : Number(question.negative_marks);
    return {
      id: question.id,
      number: question.number,
      type,
      text: question.text,
      explanation: question.explanation || "",
      marks,
      negativeMarks: type === "MCQ" ? negative : 0,
      correctKey: question.correct_key || "",
      correctKeys: Array.isArray(question.correct_keys) ? question.correct_keys : [],
      natMin: question.nat_min === null || question.nat_min === undefined ? "" : Number(question.nat_min),
      natMax: question.nat_max === null || question.nat_max === undefined ? "" : Number(question.nat_max),
      options: [...(question.cbt_options || [])].sort((a, b) => a.position - b.position).map(({ key, text }) => ({ key, text }))
    };
  });
  return NextResponse.json({ set: { id: data.id, title: data.title, year: data.year, isPublished: data.is_published, durationMinutes: data.duration_minutes ?? null, questions } });
}

// Admin-only: publish/unpublish, edit title, year and time limit, and correct answer keys.
export async function PATCH(request, { params }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { id } = await params;
  const invalid = badId(id);
  if (invalid) return invalid;
  const body = await readJson(request, 2 * 1024 * 1024);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const update = {};
  if (body.isPublished !== undefined) {
    if (typeof body.isPublished !== "boolean") return NextResponse.json({ error: "isPublished must be true or false." }, { status: 400 });
    update.is_published = body.isPublished;
  }
  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 250) : "";
    if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    update.title = title;
  }
  if (body.year !== undefined) {
    const year = body.year === null || body.year === "" ? null : Number(body.year);
    if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2200)) return NextResponse.json({ error: "Year must be a four-digit year." }, { status: 400 });
    update.year = year;
  }
  if (body.durationMinutes !== undefined) {
    const minutes = body.durationMinutes === null || body.durationMinutes === "" ? null : Number(body.durationMinutes);
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 600)) return NextResponse.json({ error: "Time limit must be 1 to 600 minutes." }, { status: 400 });
    update.duration_minutes = minutes;
  }
  const edits = Array.isArray(body.questions) ? body.questions : [];
  if (!Object.keys(update).length && !edits.length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  let hasTypeColumns = true;
  let { data: existing, error: loadError } = await getPrepTable("cbt_sets").select(`id,cbt_questions(id,type,cbt_options(key))`).eq("id", id).maybeSingle();
  if (loadError && isMissingColumn(loadError)) {
    hasTypeColumns = false;
    ({ data: existing, error: loadError } = await getPrepTable("cbt_sets").select("id,cbt_questions(id,cbt_options(key))").eq("id", id).maybeSingle());
  }
  if (loadError) return serverError(loadError, "admin cbt-set load");
  if (!existing) return NextResponse.json({ error: "Set not found." }, { status: 404 });

  const stored = new Map((existing.cbt_questions || []).map((question) => [question.id, { type: normalizeType(question.type), keys: new Set((question.cbt_options || []).map((option) => option.key)) }]));
  const questionUpdates = [];
  for (const edit of edits) {
    const question = stored.get(edit?.id);
    if (!question) return fail("A question does not belong to this set.");
    const { type, keys } = question;
    const values = {};
    if (type === "MCQ") {
      const correctKey = edit.correctKey ? String(edit.correctKey).toUpperCase() : null;
      if (correctKey && !keys.has(correctKey)) return fail("An answer key is not one of the question's options.");
      values.correct_key = correctKey;
    } else if (type === "MSQ") {
      const list = Array.isArray(edit.correctKeys) ? edit.correctKeys.map((key) => String(key || "").toUpperCase()) : [];
      if (list.some((key) => !keys.has(key))) return fail("An answer key is not one of the question's options.");
      const unique = [...new Set(list)].sort();
      values.correct_keys = unique.length ? unique : null;
    } else {
      if (blank(edit.natMin)) {
        values.nat_min = null;
        values.nat_max = null;
      } else {
        const min = Number(edit.natMin);
        const max = blank(edit.natMax) ? min : Number(edit.natMax);
        if (!Number.isFinite(min) || !Number.isFinite(max) || Math.abs(min) > 1e12 || Math.abs(max) > 1e12) return fail("A numerical answer is not a valid number.");
        if (min > max) return fail("A numerical answer range starts above its end.");
        values.nat_min = min;
        values.nat_max = max;
      }
    }
    const marks = blank(edit.marks) ? null : Number(edit.marks);
    if (marks !== null && !(Number.isFinite(marks) && marks > 0 && marks <= 100)) return fail("Marks must be a number above 0 and up to 100.");
    if (marks !== null) values.marks = cleanMarks(marks, 1);
    if (edit.negativeMarks !== undefined) {
      const negative = blank(edit.negativeMarks) ? null : Number(edit.negativeMarks);
      if (negative !== null && !(Number.isFinite(negative) && negative >= 0 && negative <= 100)) return fail("Negative marks must be a number from 0 to 100.");
      if (type !== "MCQ") values.negative_marks = 0;
      else if (negative !== null) values.negative_marks = Math.round(negative * 10000) / 10000;
      else if (marks !== null) values.negative_marks = defaultNegativeMarks(type, values.marks);
    } else if (marks !== null && type !== "MCQ") values.negative_marks = 0;
    if (!hasTypeColumns && (values.marks !== undefined || values.negative_marks !== undefined)) {
      // Without migration 012 every question is 1 mark with no stored negative marking: ignore echoes of those defaults.
      const echo = (values.marks === undefined || values.marks === 1) && (values.negative_marks === undefined || values.negative_marks === 0 || values.negative_marks === defaultNegativeMarks("MCQ", 1));
      if (!echo) return fail(MIGRATION_012);
      delete values.marks;
      delete values.negative_marks;
    }
    values.explanation = typeof edit.explanation === "string" ? edit.explanation.trim().slice(0, 20000) || null : null;
    questionUpdates.push({ id: edit.id, values });
  }

  for (const item of questionUpdates) {
    const { error } = await getPrepTable("cbt_questions").update(item.values).eq("id", item.id).eq("set_id", id);
    if (error) return isMissingColumn(error) ? fail(MIGRATION_012) : saveFailed(error, "admin cbt-set question update");
  }
  const { data, error } = await getPrepTable("cbt_sets").update({ ...update, updated_at: new Date().toISOString() }).eq("id", id).select(SET_FIELDS).maybeSingle();
  if (error) {
    if (isMissingColumn(error)) return NextResponse.json({ error: "Time limits need database migration 011_cbt_set_exam_mode.sql to be run first." }, { status: 400 });
    return saveFailed(error, "admin cbt-set update");
  }
  if (!data) return NextResponse.json({ error: "Set not found." }, { status: 404 });
  await logAdminAction(admin, update.is_published === undefined ? "cbt_set.edit" : "cbt_set.publish_state", { targetType: "cbt_sets", targetId: id, metadata: { fields: Object.keys(update), questionEdits: edits.length, isPublished: update.is_published ?? null }, request });
  return NextResponse.json({ set: data });
}

// Admin-only: permanently delete a set. Questions, options and attempts cascade.
export async function DELETE(request, { params }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { id } = await params;
  const invalid = badId(id);
  if (invalid) return invalid;
  const { data, error: loadError } = await getPrepTable("cbt_sets").select("id,title,source_images,cbt_questions(image_paths)").eq("id", id).maybeSingle();
  if (loadError) return serverError(loadError, "admin cbt-set delete load");
  if (!data) return NextResponse.json({ error: "Set not found." }, { status: 404 });
  const { error } = await getPrepTable("cbt_sets").delete().eq("id", id);
  if (error) return saveFailed(error, "admin cbt-set delete");
  await logAdminAction(admin, "cbt_set.delete", { targetType: "cbt_sets", targetId: id, metadata: { title: data.title }, request });
  const paths = [...new Set([...(Array.isArray(data.source_images) ? data.source_images : []), ...(data.cbt_questions || []).flatMap((question) => Array.isArray(question.image_paths) ? question.image_paths : [])])].filter((path) => typeof path === "string" && path.startsWith("cbt-sets/"));
  if (paths.length) {
    try { await getSupabaseServer().storage.from(CBT_SET_BUCKET).remove(paths); } catch { /* images are cleaned up on a best-effort basis */ }
  }
  return NextResponse.json({ deleted: true });
}
