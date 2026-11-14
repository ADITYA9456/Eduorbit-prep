import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPracticeTest } from "@/lib/practice";
import CBTWorkspace from "@/components/CBTWorkspace";

export default async function PracticeTestPage({ params }) {
  const { id } = await params;
  const test = await getPracticeTest(id); if (!test) notFound();
  const user = await getCurrentUser();
  return <section className="shell py-10 sm:py-14"><p className="eyebrow">Practice test{test.testType === "FULL_LENGTH" ? ", full length" : test.subjectName ? `, ${test.subjectName}` : ""}</p><h1 className="page-title mt-2">{test.title}</h1><CBTWorkspace paper={{ id: test.id, title: test.title }} authenticated={Boolean(user)} resourceType="practice" /></section>;
}
