import { NextResponse } from "next/server";
import { listExams } from "@/lib/data";
export async function GET() {
  try { return NextResponse.json(await listExams()); }
  catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
