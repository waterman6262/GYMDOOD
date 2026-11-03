import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client that bypasses RLS. Only for owner-only server actions
 * that need the Auth admin API, after requireOwner() has passed.
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
