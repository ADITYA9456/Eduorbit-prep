import { getServerSession } from "next-auth/next";
import GoogleProvider from "next-auth/providers/google";
import { cache } from "react";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getPrepTable } from "@/lib/supabase";

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || ""
    })
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account?.provider === "google") {
        token.prepUserId = account.providerAccountId || token.sub;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && (token.prepUserId || token.sub)) session.user.id = token.prepUserId || token.sub;
      return session;
    }
  },
  pages: { signIn: "/login" }
};

const ADMIN_COOKIE = "eduorbit_admin";
const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 8;

export function isConfiguredAdminEmail(email) {
  const configured = [process.env.ADMIN_EMAIL, ...(process.env.ADMIN_EMAILS || "").split(",")]
    .filter(Boolean)
    .map((value) => value.trim().toLowerCase())
  return configured.includes(String(email || "").toLowerCase());
}

function signingSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET or NEXTAUTH_SECRET must be configured");
  return secret;
}

function signAdminPayload(payload) {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

export function createAdminToken(email) {
  const payload = Buffer.from(JSON.stringify({
    email: email.toLowerCase(),
    expiresAt: Date.now() + ADMIN_COOKIE_MAX_AGE * 1000
  })).toString("base64url");
  return `${payload}.${signAdminPayload(payload)}`;
}

export function isValidAdminToken(token, email) {
  if (!token || !email) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = signAdminPayload(payload);
  const signaturesMatch = signature.length === expected.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!signaturesMatch) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.email === email.toLowerCase() && Number(data.expiresAt) > Date.now();
  } catch {
    return false;
  }
}

export const getCurrentUser = cache(async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.id || !user.email) return null;
  const email = user.email.toLowerCase();
  const isAdmin = isConfiguredAdminEmail(email);
  const { error } = await getPrepTable("prep_users").upsert({
    id: user.id,
    email,
    name: user.name || null,
    image: user.image || null,
    is_admin: isAdmin
  }, { onConflict: "id", ignoreDuplicates: false });
  if (error) {
    if (error.message.includes("Invalid schema")) {
      throw new Error(
        "Supabase schema eduorbit_prep is not exposed. In Supabase Dashboard open " +
        "Project Settings > API > Exposed schemas, add eduorbit_prep, save, " +
        "then restart the Next.js server."
      );
    }
    if (error.code === "42P01" || error.message.includes("prep_users")) {
      throw new Error(
        "Unable to synchronize Prep user: eduorbit_prep.prep_users is missing or not exposed. " +
        "Run supabase/migrations/001_eduorbit_prep_isolated_schema.sql in the Supabase SQL Editor " +
        "and add eduorbit_prep to Supabase API exposed schemas, " +
        "then refresh the app."
      );
    }
    throw new Error(`Unable to synchronize Prep user: ${error.message}`);
  }
  return { ...user, email, isAdmin };
});

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return null;
  const adminCookie = (await cookies()).get(ADMIN_COOKIE)?.value;
  return isValidAdminToken(adminCookie, user.email) ? user : null;
}

export { ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE };
