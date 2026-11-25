import { NextResponse } from "next/server";
import { getQuestionForCheck } from "@/lib/cbtSets";
import { formatValue, gradeQuestion } from "@/lib/cbtSetShared";

// Study mode: grades one question and reveals its answer and explanation.
// Answer keys never ship with the page, so this is the only way to see them before submitting.
export async function POST(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.questionId !== "string") return NextResponse.json({ error: "Question is required." }, { status: 400 });
  try {
    const question = await getQuestionForCheck(id, body.questionId);
    if (!question) return NextResponse.json({ error: "Question not found." }, { status: 404 });
    const graded = gradeQuestion(question, body.answer);
    return NextResponse.json({
      check: {
        status: graded.status,
        earned: graded.earned,
        marks: graded.marks,
        correct: graded.correct,
        correctText: formatValue(graded.correct),
        explanation: question.explanation || null
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not check this answer." }, { status: 500 });
  }
}
