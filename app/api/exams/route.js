import { NextResponse } from "next/server";
import { listExams } from "@/lib/data";
import { serverError } from "@/lib/http";
export async function GET() {
  try { return NextResponse.json(await listExams()); }
  catch (error) { return serverError(error, "exams GET"); }
}
