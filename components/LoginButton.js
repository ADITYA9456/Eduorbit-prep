"use client";
import { signIn } from "next-auth/react";

export default function LoginButton() {
  return <button className="button-primary w-full" onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>Continue with Google</button>;
}
