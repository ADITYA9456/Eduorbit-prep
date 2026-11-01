"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return <button className="button-secondary px-3 py-2 text-sm" onClick={() => signOut({ callbackUrl: "/" })}>Sign out</button>;
}
