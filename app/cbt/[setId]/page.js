import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPublishedCbtSet } from "@/lib/cbtSets";
import CbtPlayer from "@/components/cbt/CbtPlayer";

export const dynamic = "force-dynamic";

export default async function CbtSetPage({ params }) {
  const { setId } = await params;
  const set = await getPublishedCbtSet(setId);
  if (!set) notFound();
  const user = await getCurrentUser();
  const backHref = set.examSlug && set.branchSlug ? `/exams/${set.examSlug}/${set.branchSlug}/cbt` : "/exams";
  return <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16"><Link className="text-sm text-slate-500 hover:text-electric" href={backHref}>← {set.branchName || "Library"} CBT sets</Link><p className="eyebrow mt-8">{[set.examName, set.branchName, set.subjectName, set.year].filter(Boolean).join(" / ")}</p><h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{set.title}</h1><CbtPlayer authenticated={Boolean(user)} set={set} /></section>;
}
