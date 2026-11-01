import { getPrepTable } from "@/lib/supabase";

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
  const { data, error } = await db("prep_exams").select("*").eq("is_active", true).order("name");
  if (error) throw error;
  const { data: branches, error: branchError } = await db("prep_branches").select("*").eq("is_active", true);
  if (branchError) throw branchError;
  return (data || []).map((exam) => ({ ...exam, branches: (branches || []).filter((branch) => branch.exam_id === exam.id) }));
}
export async function getExam(slug) {
  const { data, error } = await db("prep_exams").select("*").eq("slug", slug).eq("is_active", true).maybeSingle();
  if (error) throw error; return data;
}
export async function getBranch(examId, slug) {
  const { data, error } = await db("prep_branches").select("*").eq("exam_id", examId).eq("slug", slug).eq("is_active", true).maybeSingle();
  if (error) throw error; return data;
}
export async function listPapers(examId, branchId) {
  const { data, error } = await db("prep_papers").select("*").eq("exam_id", examId).eq("branch_id", branchId).eq("is_published", true).order("year", { ascending: false }).order("shift");
  if (error) throw error; return (data || []).map(normalizePaper);
}
export async function getPaper(id) {
  const { data, error } = await db("prep_papers").select("*").eq("id", id).eq("is_published", true).maybeSingle();
  if (error) throw error; return normalizePaper(data);
}
