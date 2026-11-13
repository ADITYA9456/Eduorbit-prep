"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import LoadingExperience from "@/components/LoadingExperience";

export default function LogoutButton() {
  const [signingOut, setSigningOut] = useState(false);
  async function leaveWorkspace() {
    setSigningOut(true);
    try {
      await signOut({ callbackUrl: "/" });
    } catch {
      setSigningOut(false);
    }
  }
  return signingOut ? <LoadingExperience message="Signing you out..." /> : <button className="button-secondary px-3 py-2 text-sm" disabled={signingOut} onClick={leaveWorkspace} type="button">Sign out</button>;
}
