import { NextResponse } from "next/server";
import { getQuestionForCheck } from "@/lib/cbtSets";
import { formatValue, gradeQuestion } from "@/lib/cbtSetShared";
import { badRequest, isUuid, readJson, serverError, tooLarge } from "@/lib/http";
import { limitRequest } from "@/lib/rateLimit";

// Study mode: grades one question and reveals its answer and explanation.
// Answer keys never ship with the page, so this is the only way to see them before submitting.
export async function POST(request, { params }) {
  const limited = limitRequest(request, "cbt-set-check", { limit: 120, windowMs: 60 * 1000 }); if (limited) return limited;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Set not found." }, { status: 404 });
  const body = await readJson(request, 16 * 1024);
  if (!body) return tooLarge();
  if (!isUuid(body.questionId)) return badRequest("Question is required.");
  if (typeof body.answer === "string" && body.answer.length > 64) return badRequest("Answer is invalid.");
  if (Array.isArray(body.answer) && (body.answer.length > 10 || body.answer.some((item) => typeof item !== "string" || item.length > 64))) return badRequest("Answer is invalid.");
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
    return serverError(error, "cbt-sets check");
  }
}
