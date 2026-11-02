import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { getPrepTable, getSupabaseServer } from "@/lib/supabase";

const STORAGE_BUCKET = "eduorbit-cbt-source-pdfs";

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
  const starts = [...normalized.matchAll(/(?:^|\n)\s*(\d{1,3})[.)]\s+/g)];
  const questions = [];
  for (let index = 0; index < starts.length; index += 1) {
    const number = Number(starts[index][1]);
    const start = starts[index].index + starts[index][0].length - starts[index][1].length - 2;
    const end = index + 1 < starts.length ? starts[index + 1].index : normalized.length;
    const block = normalized.slice(start, end).trim();
    const optionMatches = [...block.matchAll(/(?:^|\n)\s*([A-D])[\.)]\s+(.+?)(?=\n\s*[A-D][\.)]\s+|\s*$)/gis)];
    const firstOption = optionMatches[0]?.index ?? block.length;
    const questionText = clean(block.slice(0, firstOption));
    const options = optionMatches.map((match) => ({ label: match[1].toUpperCase(), text: clean(match[2]) }));
    questions.push({
      number,
      type: classify(block),
      text: questionText.replace(/^\d{1,3}[.)]\s*/, ""),
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

export async function extractPdf(buffer, filename) {
  const parsed = await pdfParse(buffer);
  const text = parsed.text || "";
  const questions = parseQuestions(text);
  return {
    metadata: inferMetadata(text, filename),
    pageCount: parsed.numpages || null,
    textLength: text.length,
    questions,
    rawText: text,
    warnings: text.trim() ? [] : ["No selectable text found. Configure OPENAI_API_KEY for scanned-PDF vision extraction."]
  };
}

function parseAnswerKey(text) {
  const answers = {};
  for (const match of text.matchAll(/(?:^|\n|\s)\s*(\d{1,3})\s*(?:[\.:)\-]|\s)\s*([A-D](?:\s*[,/&]\s*[A-D])?|-?\d+(?:\.\d+)?(?:\s*(?:to|-)\s*-?\d+(?:\.\d+)?)?)(?=\s|$)/gi)) {
    answers[Number(match[1])] = clean(match[2]).toUpperCase();
  }
  return answers;
}

async function extractWithAi(buffer, filename) {
  if (!process.env.OPENAI_API_KEY) return null;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_CBT_MODEL || "gpt-4.1-mini",
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: "Extract every question from this exam PDF. Return JSON only with metadata {year,branch,shift}, and questions[]. Each question must contain number,type (MCQ/MSQ/NAT),text,options [{label,text}],marks,negativeMarks. Never invent missing values; use null and include warnings." },
          { type: "input_file", filename, file_data: `data:application/pdf;base64,${buffer.toString("base64")}` }
        ]
      }],
      text: { format: { type: "json_object" } }
    })
  });
  if (!response.ok) throw new Error(`AI extraction failed (${response.status}).`);
  const payload = await response.json();
  const outputText = (payload.output || []).flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text;
  if (!outputText) throw new Error("AI extraction returned no structured output.");
  const parsed = JSON.parse(outputText);
  return {
    metadata: { ...(parsed.metadata || {}), uncertain: { year: !parsed.metadata?.year, branch: !parsed.metadata?.branch, shift: !parsed.metadata?.shift } },
    questions: (parsed.questions || []).map((question) => ({ ...question, answer: null, options: question.options || [], verificationStatus: "NEEDS_REVIEW", extractionWarnings: [...(question.warnings || []), "AI-extracted; verify against the source PDF."] })),
    warnings: ["Scanned PDF extracted with server-side AI vision. Verify every question and answer."]
  };
}

export async function processImport({ questionBuffer, questionName, answerBuffer, answerName }) {
  const questionResult = await extractPdf(questionBuffer, questionName);
  const aiResult = !questionResult.rawText.trim() ? await extractWithAi(questionBuffer, questionName) : null;
  const source = aiResult || questionResult;
  let answerKey = {};
  let answerWarnings = [];
  if (answerBuffer) {
    const answerResult = await extractPdf(answerBuffer, answerName);
    answerKey = parseAnswerKey(answerResult.rawText);
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
    warnings: [...(source.warnings || []), ...answerWarnings, ...(questionResult.rawText.trim() ? [] : ["No selectable text found; OCR/vision extraction must be configured and verified."])],
    rawText: questionResult.rawText
  };
}

export async function uploadSource(path, buffer, contentType = "application/pdf") {
  const { error } = await getSupabaseServer().storage.from(STORAGE_BUCKET).upload(path, buffer, { contentType, upsert: false });
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
