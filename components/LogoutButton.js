"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import LoadingExperience from "@/components/LoadingExperience";

export default function LogoutButton({ block = false }) {
  const [signingOut, setSigningOut] = useState(false);
  async function leaveWorkspace() {
    setSigningOut(true);
    try {
      await signOut({ callbackUrl: "/" });
    } catch {
      setSigningOut(false);
    }
  }
  return signingOut ? <LoadingExperience message="Signing you out…" overlay /> : <button className={`button-ghost ${block ? "w-full" : "btn-sm"}`} disabled={signingOut} onClick={leaveWorkspace} type="button">Sign out</button>;
}
