import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPracticeTest } from "@/lib/practice";
import CBTWorkspace from "@/components/CBTWorkspace";

export default async function PracticeTestPage({ params }) {
  const test = await getPracticeTest(params.id); if (!test) notFound();
  const user = await getCurrentUser();
  return <section className="mx-auto max-w-6xl px-6 py-12 sm:py-16"><p className="eyebrow">Practice / {test.testType === "FULL_LENGTH" ? "Full Length" : test.subjectName}</p><h1 className="mt-4 text-4xl font-bold tracking-tight">{test.title}</h1><CBTWorkspace paper={{ id: test.id, title: test.title }} authenticated={Boolean(user)} resourceType="practice" /></section>;
}
