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
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch {
      setSigningIn(false);
    }
  }

  return (
    <div className="panel relative mt-8 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 sm:pr-14">
      <button aria-label="Dismiss guest notice" className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:text-foreground" onClick={() => { setDismissed(true); window.sessionStorage.setItem("eduorbit-guest-notice-dismissed", "true"); }} type="button">
        <X size={16} />
      </button>
      {signingIn ? <LoadingExperience message="Signing you in…" /> : <><p className="max-w-2xl pr-10 text-sm leading-6 text-slate-400 sm:pr-0">You&apos;re browsing as a guest. Sign in to save progress and notes across your devices.</p><button className="button-primary shrink-0 sm:mr-2" disabled={signingIn} onClick={continueWithGoogle} type="button">Sign in with Google</button></>}
    </div>
  );
}
