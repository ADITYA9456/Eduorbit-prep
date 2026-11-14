"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import LoadingExperience from "@/components/LoadingExperience";

export default function LoginButton() {
  const [signingIn, setSigningIn] = useState(false);
  async function continueWithGoogle() {
    setSigningIn(true);
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch {
      setSigningIn(false);
    }
  }
  return signingIn ? <LoadingExperience message="Signing you in…" /> : <button aria-label="Continue with Google" className="button-google w-full" disabled={signingIn} onClick={continueWithGoogle} type="button"><svg aria-hidden="true" className="google-mark" viewBox="0 0 24 24"><path d="M21.35 12.1c0-.7-.06-1.37-.18-2H12v3.79h5.22a4.46 4.46 0 0 1-1.94 2.92v2.42h3.14c1.84-1.69 2.93-4.18 2.93-7.13Z" fill="#4285F4" /><path d="M12 21.5c2.63 0 4.84-.87 6.46-2.36l-3.14-2.42c-.87.58-1.98.92-3.32.92-2.55 0-4.71-1.72-5.49-4.04H3.27v2.5A9.75 9.75 0 0 0 12 21.5Z" fill="#34A853" /><path d="M6.51 13.6A5.86 5.86 0 0 1 6.2 12c0-.56.11-1.1.31-1.6V7.9H3.27A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.06 1.02 4.1l3.24-2.5Z" fill="#FBBC05" /><path d="M12 6.36c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.46 14.63 2.5 12 2.5a9.75 9.75 0 0 0-8.73 5.4l3.24 2.5c.78-2.32 2.94-4.04 5.49-4.04Z" fill="#EA4335" /></svg><span>Continue with Google</span></button>;
}
