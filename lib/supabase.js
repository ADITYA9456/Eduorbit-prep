import { createClient } from "@supabase/supabase-js";

let serverClient;
export function getSupabaseServer() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase server credentials are not configured");
  }
  if (!serverClient) {
    serverClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }
  return serverClient;
}

export function getPrepTable(table) {
  return getSupabaseServer().schema("eduorbit_prep").from(table);
}
