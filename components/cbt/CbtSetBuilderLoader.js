"use client";

import dynamic from "next/dynamic";
import LoadingExperience from "@/components/LoadingExperience";

// The builder (editor, compression, answer-key tools) is admin-only, so it is split out and loaded on demand.
const CbtSetBuilder = dynamic(() => import("@/components/cbt/CbtSetBuilder"), {
  ssr: false,
  loading: () => <LoadingExperience message="Loading CBT builder…" />
});

export default function CbtSetBuilderLoader(props) {
  return <CbtSetBuilder {...props} />;
}
