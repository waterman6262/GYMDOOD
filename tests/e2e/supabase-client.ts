import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { OWNER, STAFF } from "./helpers";

// Tests that call the local Supabase directly, to exercise database functions
// under real concurrency that the browser UI's own guards would hide.
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
);

async function signedIn(user: { email: string; password: string }): Promise<SupabaseClient> {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await supabase.auth.signInWithPassword(user);
  if (error) throw error;
  return supabase;
}

export const staffClient = () => signedIn(STAFF);
export const ownerClient = () => signedIn(OWNER);
