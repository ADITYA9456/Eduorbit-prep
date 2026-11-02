import { getServerSession } from "next-auth/next";
import GoogleProvider from "next-auth/providers/google";
import { cache } from "react";
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

export const getCurrentUser = cache(async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.id || !user.email) return null;
  const email = user.email.toLowerCase();
  const configured = (process.env.ADMIN_EMAILS || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  const isAdmin = configured.includes(email);
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
  return user?.isAdmin ? user : null;
}
