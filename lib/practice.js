import { getPrepTable, getSupabaseServer } from "@/lib/supabase";

export async function signedImages(images) {
  return Promise.all((images || []).map(async (image) => {
    if (!image.path) return image;
    const { data, error } = await getSupabaseServer().storage.from("eduorbit-practice-sources").createSignedUrl(image.path, 60 * 60);
    return error ? image : { ...image, url: data.signedUrl };
  }));
}

export async function listPracticeTests(branchId) {
  const { data, error } = await getPrepTable("prep_practice_tests")
    .select("id,title,test_type,test_number,questions,metadata,created_at,prep_subjects(name)")
    .eq("branch_id", branchId)
    .eq("status", "PUBLISHED")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((test) => ({
    ...test,
    questions: undefined,
    testType: test.test_type,
    questionCount: Array.isArray(test.questions) ? test.questions.length : 0,
    subjectName: test.prep_subjects?.name || null
  }));
}

export async function getPracticeTest(id, includeAnswers = false) {
  const { data, error } = await getPrepTable("prep_practice_tests")
    .select("id,title,test_type,test_number,questions,metadata,duration_seconds,branch_id,exam_id,prep_subjects(name),prep_branches(name,slug),prep_exams(name)")
    .eq("id", id)
    .eq("status", "PUBLISHED")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const questions = await Promise.all((data.questions || []).map(async (question) => {
    const images = await signedImages(question.images);
    return includeAnswers ? { ...question, images } : (() => {
      const { answer, answerVerified, tolerance, ...publicQuestion } = question;
      return { ...publicQuestion, images };
    })();
  }));
  return {
    ...data,
    questions,
    testType: data.test_type,
    subjectName: data.prep_subjects?.name || null,
    branchName: data.prep_branches?.name || null,
    examName: data.prep_exams?.name || null
  };
}
