import { getPrepTable } from "@/lib/supabase";
import { getPublishedCbt } from "@/lib/cbt";

const db = (table) => getPrepTable(table);
function normalizePaper(paper) {
  if (!paper) return null;
  return {
    ...paper,
    examId: paper.exam_id,
    branchId: paper.branch_id,
    officialPaperUrl: paper.official_paper_url,
    officialSolutionUrl: paper.official_solution_url,
    externalPdfUrl: paper.external_pdf_url,
    questionCount: paper.question_count,
    isPublished: paper.is_published
  };
}
export async function listExams() {
  const { data, error } = await db("prep_exams").select("id, name, slug, description").eq("is_active", true).order("name");
  if (error) throw error;
  const { data: branches, error: branchError } = await db("prep_branches").select("id, exam_id, name, slug").eq("is_active", true);
  if (branchError) throw branchError;
  return (data || []).map((exam) => ({ ...exam, branches: (branches || []).filter((branch) => branch.exam_id === exam.id) }));
}
export async function getExam(slug) {
  const { data, error } = await db("prep_exams").select("id, name, slug, description").eq("slug", slug).eq("is_active", true).maybeSingle();
  if (error) throw error; return data;
}
export async function getBranch(examId, slug) {
  const { data, error } = await db("prep_branches").select("id, exam_id, name, slug").eq("exam_id", examId).eq("slug", slug).eq("is_active", true).maybeSingle();
  if (error) throw error; return data;
}
export async function listPapers(examId, branchId) {
  const { data, error } = await db("prep_papers").select("id, exam_id, branch_id, title, year, shift, question_count, official_paper_url, official_solution_url, external_pdf_url, description, is_published").eq("exam_id", examId).eq("branch_id", branchId).eq("is_published", true).order("year", { ascending: false }).order("shift");
  if (error) throw error; return (data || []).map(normalizePaper);
}
export async function getPaper(id) {
  const { data, error } = await db("prep_papers").select("id, exam_id, branch_id, title, year, shift, question_count, official_paper_url, official_solution_url, external_pdf_url, description, is_published").eq("id", id).eq("is_published", true).maybeSingle();
  if (error) throw error;
  const paper = normalizePaper(data);
  return paper ? { ...paper, cbt: await getPublishedCbt(id) } : null;
}
