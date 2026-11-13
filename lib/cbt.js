import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { createWorker } from "tesseract.js";
import { getPrepTable, getSupabaseServer } from "@/lib/supabase";
import crypto from "node:crypto";

const STORAGE_BUCKET = "eduorbit-cbt-source-pdfs";

export function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function inferFileMetadata(filename) {
  const source = String(filename || "").toUpperCase();
  const year = source.match(/\b(20\d{2})\b/)?.[1] || null;
  const branch = source.match(/\b(CSE|CS|DA|EC|EE|ME|CE|IN|PI|XE|XL|AR|CY|GG|MA|PH|ST)\b/)?.[1] || null;
  const shift = source.match(/(?:SHIFT|SESSION|SET|PAPER)\s*[-_ ]?([12])\b/)?.[1] || (/\bCS[12]\b/.test(source) ? source.match(/\bCS([12])\b/)?.[1] : null);
  return { year: year ? Number(year) : null, branch: branch === "CS" ? "CSE" : branch, shift: shift ? `Shift ${shift}` : null };
}

function paperMatchesMetadata(paper, metadata) {
  if (!metadata?.year || Number(paper.year) !== Number(metadata.year)) return false;
  if (metadata.shift && String(paper.shift).toLowerCase() !== String(metadata.shift).toLowerCase()) return false;
  if (metadata.branch) {
    const branch = `${paper.branch_name || ""} ${paper.branch_slug || ""}`.toUpperCase();
    if (!branch.includes(metadata.branch)) return false;
  }
  return true;
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function classify(text) {
  const upper = text.toUpperCase();
  if (/\bNAT\b|NUMERICAL ANSWER TYPE|ENTER YOUR ANSWER/.test(upper)) return "NAT";
  if (/\bMSQ\b|MULTIPLE SELECT|MORE THAN ONE/.test(upper)) return "MSQ";
  return "MCQ";
}

function parseQuestions(text) {
  const normalized = text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n");
  let starts = [...normalized.matchAll(/(?:^|\n)\s*(?:Q(?:uestion)?\s*[.:#-]?\s*)?(\d{1,3})\s*(?:[.)]|[-:])\s+/gi)];
  if (!starts.length) {
    const standalone = [...normalized.matchAll(/(?:^|\n)\s*(\d{1,3})\s*(?=\n)/g)];
    const sequential = standalone.filter((match, index) => Number(match[1]) === index + 1);
    if (sequential.length >= 2) starts = sequential;
  }
  const questions = [];
  for (let index = 0; index < starts.length; index += 1) {
    const number = Number(starts[index][1]);
    const markerOffset = starts[index][0].search(/(?:Q(?:uestion)?\s*[.:#-]?\s*)?\d/i);
    const start = starts[index].index + Math.max(0, markerOffset);
    const end = index + 1 < starts.length ? starts[index + 1].index : normalized.length;
    const block = normalized.slice(start, end).trim();
    const optionMatches = [...block.matchAll(/(?:^|\n|(?<=\s))\s*([A-D])[\.)]\s+(.+?)(?=\n\s*[A-D][\.)]\s+|(?=\s+[A-D][\.)]\s+)|$)/gis)];
    const firstOption = optionMatches[0]?.index ?? block.length;
    const questionText = clean(block.slice(0, firstOption));
    const options = optionMatches.map((match) => ({ label: match[1].toUpperCase(), text: clean(match[2]) }));
    questions.push({
      number,
      type: classify(block),
      text: questionText.replace(/^(?:Q(?:uestion)?\s*[.:#-]?\s*)?\d{1,3}\s*(?:[.)]|[-:])\s*/i, ""),
      options,
      marks: /\b2\s*marks?\b/i.test(block) ? 2 : 1,
      negativeMarks: /\b1\/3\b|negative marking/i.test(block) ? 1 / 3 : 0,
      answer: null,
      verificationStatus: "NEEDS_REVIEW",
      extractionWarnings: options.length && questionText ? [] : ["Question text or options were not confidently detected."]
    });
  }
  return questions;
}

function inferMetadata(text, filename) {
  const source = `${filename}\n${text}`;
  const year = source.match(/\b(20\d{2})\b/)?.[1] || null;
  const branch = source.match(/\b(CSE|DA|EC|EE|ME|CE|IN|PI|XE|XL|AR|CY|GG|MA|PH|ST)\b/i)?.[1]?.toUpperCase() || null;
  const shift = source.match(/\b(?:shift|session)\s*[-:]?\s*([12])\b/i)?.[1] || null;
  return {
    year: year ? Number(year) : null,
    branch,
    shift: shift ? `Shift ${shift}` : null,
    uncertain: { year: !year, branch: !branch, shift: !shift }
  };
}

async function extractPdf(buffer, filename) {
  const parsed = await pdfParse(buffer);
  const text = parsed.text || "";
  const questions = parseQuestions(text);
  return {
    metadata: inferMetadata(text, filename),
    pageCount: parsed.numpages || 0,
    textLength: text.length,
    questions,
    rawText: text,
    warnings: [
      ...(text.trim() ? [] : ["No selectable text found. This deterministic importer cannot OCR scanned PDFs in the Next.js runtime; retain the source for manual review or process it with a separately deployed OCR worker."]),
      ...(text.trim() && !questions.length ? ["Selectable text was found, but no supported question-number pattern was detected."] : [])
    ]
  };
}

export async function extractImage(buffer, filename) {
  const worker = await createWorker("eng");
  try {
    const result = await worker.recognize(buffer);
    const text = result.data.text || "";
    const confidence = Number(result.data.confidence || 0);
    const questions = parseQuestions(text).map((question) => ({
      ...question,
      extractionConfidence: confidence,
      extractionWarnings: [
        ...(question.extractionWarnings || []),
        ...(confidence < 65 ? [`OCR confidence is low (${Math.round(confidence)}%). Verify this question against the image.`] : [])
      ]
    }));
    return {
      metadata: inferMetadata(text, filename),
      textLength: text.length,
      confidence,
      questions,
      rawText: text,
      warnings: [
        ...(text.trim() ? [] : ["OCR did not detect readable text in this image."]),
        ...(confidence < 65 ? [`OCR confidence is low (${Math.round(confidence)}%).`] : []),
        ...(text.trim() && !questions.length ? ["OCR text was found, but no supported question-number pattern was detected."] : [])
      ]
    };
  } finally {
    await worker.terminate();
  }
}

function parseAnswerKey(text) {
  const answers = {};
  for (const match of text.matchAll(/(?:^|\n|\s)\s*(\d{1,3})\s*(?:[\.:)\-]|\s)\s*([A-D](?:\s*[,/&]\s*[A-D])?|-?\d+(?:\.\d+)?(?:\s*(?:to|-)\s*-?\d+(?:\.\d+)?)?)(?=\s|$)/gi)) {
    answers[Number(match[1])] = clean(match[2]).toUpperCase();
  }
  return answers;
}

export async function processImport({ questionBuffer, questionName, answerBuffer, answerName }) {
  const questionResult = await extractPdf(questionBuffer, questionName);
  const source = questionResult;
  let answerKey = {};
  let answerWarnings = [];
  let answerKeyResult = null;
  if (answerBuffer) {
    answerKeyResult = await extractPdf(answerBuffer, answerName);
    answerKey = parseAnswerKey(answerKeyResult.rawText);
    if (!Object.keys(answerKey).length) answerWarnings.push("No answer-key rows were confidently detected.");
  }

  const questions = source.questions.map((question) => ({
    ...question,
    answer: answerKey[question.number] || null,
    verificationStatus: answerKey[question.number] ? "NEEDS_REVIEW" : "NEEDS_REVIEW",
    extractionWarnings: [...question.extractionWarnings, ...(answerKey[question.number] ? [] : ["No official answer match found."])]
  }));
  return {
    metadata: source.metadata,
    questions,
    answerKey,
    diagnostics: {
      processingStage: questions.length ? "DRAFT_CREATED" : "QUESTION_PARSING",
      pageCount: source.pageCount || questionResult.pageCount || 0,
      textLength: questionResult.textLength,
      extractedQuestionCount: questions.length,
      ocrUsed: false,
      answerKeyProvided: Boolean(answerBuffer),
      answerKeyPageCount: answerKeyResult?.pageCount || 0,
      answerKeyTextLength: answerKeyResult?.textLength || 0,
      answerKeyExtractionSucceeded: Object.keys(answerKey).length > 0,
      matchedAnswerCount: questions.filter((question) => question.answer).length,
      manualReviewRequired: true
    },
    warnings: [...(source.warnings || []), ...answerWarnings],
    rawText: questionResult.rawText
  };
}

export async function processStoredImport(id) {
  const { data: item, error: loadError } = await getPrepTable("prep_cbt_imports")
    .select("id,paper_id,question_pdf_path,answer_key_pdf_path,question_pdf_name,answer_key_pdf_name")
    .eq("id", id)
    .single();
  if (loadError) throw loadError;
  const storage = getSupabaseServer().storage.from(STORAGE_BUCKET);
  const question = await storage.download(item.question_pdf_path);
  if (question.error) throw question.error;
  const answer = item.answer_key_pdf_path ? await storage.download(item.answer_key_pdf_path) : { data: null, error: null };
  if (answer.error) throw answer.error;
  const extraction = await processImport({
    questionBuffer: Buffer.from(await question.data.arrayBuffer()),
    questionName: item.question_pdf_name,
    answerBuffer: answer.data ? Buffer.from(await answer.data.arrayBuffer()) : null,
    answerName: item.answer_key_pdf_name
  });
  let paperId = item.paper_id;
  const fileMetadata = inferFileMetadata(item.question_pdf_name);
  const resolvedMetadata = {
    ...fileMetadata,
    ...Object.fromEntries(Object.entries(extraction.metadata || {}).filter(([, value]) => value))
  };
  if (!paperId && resolvedMetadata.year && resolvedMetadata.branch && resolvedMetadata.shift) {
    const { data: candidates, error } = await getPrepTable("prep_papers")
      .select("id,year,shift,branch_id,prep_branches(name,slug)")
      .eq("is_published", true)
      .eq("year", resolvedMetadata.year);
    if (error) throw error;
    const matching = (candidates || []).filter((paper) => paperMatchesMetadata({
      ...paper,
      branch_name: paper.prep_branches?.name,
      branch_slug: paper.prep_branches?.slug
    }, resolvedMetadata));
    if (matching.length === 1) paperId = matching[0].id;
    if (matching.length !== 1) {
      const diagnostics = { ...resolvedMetadata, ...extraction.diagnostics, warnings: [...extraction.warnings, matching.length ? "Multiple existing papers matched; manual pairing is required." : "No existing paper matched year, branch, and shift. Manual pairing is required."] };
      const { data, error: updateError } = await getPrepTable("prep_cbt_imports").update({
        status: "NEEDS_PAIRING",
        metadata: diagnostics,
        questions: extraction.questions,
        answer_key: extraction.answerKey,
        error_message: diagnostics.warnings.at(-1),
        updated_at: new Date().toISOString()
      }).eq("id", id).select("id,status,paper_id,metadata,questions,error_message").single();
      if (updateError) throw updateError;
      return { data };
    }
  }
  if (!paperId) {
    const diagnostics = { ...resolvedMetadata, ...extraction.diagnostics, warnings: [...extraction.warnings, "Year, branch, and shift were not all confidently identified. Manual pairing is required."] };
    const { data, error } = await getPrepTable("prep_cbt_imports").update({
      status: "NEEDS_PAIRING",
      metadata: diagnostics,
      questions: extraction.questions,
      answer_key: extraction.answerKey,
      error_message: diagnostics.warnings.at(-1),
      updated_at: new Date().toISOString()
    }).eq("id", id).select("id,status,paper_id,metadata,questions,error_message").single();
    if (error) throw error;
    return { data };
  }
  const diagnostics = { ...resolvedMetadata, ...extraction.diagnostics, warnings: extraction.warnings };
  const { data, error } = await getPrepTable("prep_cbt_imports").update({
    paper_id: paperId,
    status: extraction.questions.length ? "REVIEW" : "FAILED",
    metadata: diagnostics,
    questions: extraction.questions,
    answer_key: extraction.answerKey,
    error_message: extraction.questions.length ? null : extraction.warnings.join(" ") || "No questions were extracted.",
    updated_at: new Date().toISOString()
  }).eq("id", id).select("id,status,paper_id,metadata,questions,error_message").single();
  if (error) throw error;
  return { data };
}

export async function uploadSource(path, buffer, contentType = "application/pdf", bucket = STORAGE_BUCKET) {
  const { error } = await getSupabaseServer().storage.from(bucket).upload(path, buffer, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

export async function getPublishedCbt(paperId) {
  try {
    const { data, error } = await getPrepTable("prep_cbt_imports")
      .select("id,paper_id,metadata,questions,status")
      .eq("paper_id", paperId)
      .eq("status", "PUBLISHED")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}
