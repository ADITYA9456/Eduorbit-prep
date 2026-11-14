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
  return <section className="shell pb-28 pt-8 sm:pb-16 sm:pt-10"><nav aria-label="Breadcrumb" className="crumbs"><Link href={backHref}>{set.branchName ? `${set.branchName} CBT sets` : "Library"}</Link><span aria-hidden="true" className="sep">/</span><span aria-current="page" className="truncate text-foreground">{set.title}</span></nav><CbtPlayer authenticated={Boolean(user)} set={set} /></section>;
}
