import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createDemoClient } from "@/lib/demo/client";
import { createLocalClient } from "@/lib/localdb/client";

/**
 * Which database the owner portal uses:
 *  - "local":    PostgreSQL on this computer via /api/db (NEXT_PUBLIC_DB_MODE=local)
 *  - "supabase": Supabase cloud (NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY)
 *  - "demo":     built-in sample data in this browser, when nothing is configured
 */
export const dbMode: "local" | "supabase" | "demo" =
  process.env.NEXT_PUBLIC_DB_MODE === "local" ? "local"
    : process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "supabase"
      : "demo";

export const isDemoMode = dbMode === "demo";

let fallbackClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (dbMode === "supabase") return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  fallbackClient ??= (dbMode === "local" ? createLocalClient() : createDemoClient()) as unknown as SupabaseClient;
  return fallbackClient;
}
