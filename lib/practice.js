import { getPrepTable } from "@/lib/supabase";

export async function listPracticeTests(branchId) {
  const { data, error } = await getPrepTable("prep_practice_tests")
    .select("id,title,test_type,test_number,questions,metadata,created_at,prep_subjects(name)")
    .eq("branch_id", branchId)
    .eq("status", "PUBLISHED")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((test) => ({
    ...test,
    testType: test.test_type,
    questionCount: Array.isArray(test.questions) ? test.questions.length : 0,
    subjectName: test.prep_subjects?.name || null
  }));
}

export async function getPracticeTest(id) {
  const { data, error } = await getPrepTable("prep_practice_tests")
    .select("id,title,test_type,test_number,questions,metadata,branch_id,exam_id,prep_subjects(name),prep_branches(name,slug),prep_exams(name)")
    .eq("id", id)
    .eq("status", "PUBLISHED")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    testType: data.test_type,
    subjectName: data.prep_subjects?.name || null,
    branchName: data.prep_branches?.name || null,
    examName: data.prep_exams?.name || null
  };
}
