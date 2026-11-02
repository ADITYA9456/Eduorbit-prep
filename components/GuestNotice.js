"use client";

import { X } from "lucide-react";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import LoadingExperience from "@/components/LoadingExperience";

export default function GuestNotice() {
  const [dismissed, setDismissed] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  useEffect(() => {
    setDismissed(window.sessionStorage.getItem("eduorbit-guest-notice-dismissed") === "true");
  }, []);

  if (dismissed) return null;

  async function continueWithGoogle() {
    setSigningIn(true);
    await signIn("google", { callbackUrl: "/dashboard" });
  }

  return (
    <div className="card relative mt-8 flex flex-col gap-4 border-electric/30 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <button aria-label="Dismiss guest notice" className="absolute right-3 top-3 rounded-lg p-1 text-slate-500 hover:text-foreground" onClick={() => { setDismissed(true); window.sessionStorage.setItem("eduorbit-guest-notice-dismissed", "true"); }} type="button">
        <X size={16} />
      </button>
      {signingIn ? <LoadingExperience message="Signing you in..." /> : <><p className="max-w-3xl pr-6 text-sm leading-6 text-slate-400">You&apos;re browsing as a guest. Sign in to save your progress and access your personal workspace across devices.</p><button className="button-primary shrink-0" disabled={signingIn} onClick={continueWithGoogle} type="button">Sign in with Google</button></>}
    </div>
  );
}
