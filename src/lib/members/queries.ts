import "server-only";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/phone";

export type Member = {
  id: string;
  member_code: string;
  name: string;
  phone: string | null;
  line_id: string | null;
  note: string | null;
  active: boolean;
};

const MEMBER_COLUMNS = "id, member_code, name, phone, line_id, note, active";

/**
 * Search by partial name, partial phone (dashes ignored) or exact member code.
 * Characters that carry meaning in a PostgREST `or` filter are stripped so a
 * search box value can never change the filter itself.
 */
export async function searchMembers(q: string, includeInactive = false): Promise<Member[]> {
  const supabase = await createClient();
  let query = supabase.from("members").select(MEMBER_COLUMNS).order("name").limit(50);
  if (!includeInactive) query = query.eq("active", true);

  const term = q.replace(/[,()*%\\"':]/g, "").trim();
  if (q.trim() && !term) return [];
  if (term) {
    const filters = [`name.ilike.%${term}%`, `member_code.eq.${term.toUpperCase()}`];
    const digits = normalizePhone(term);
    if (digits) filters.push(`phone_digits.like.%${digits}%`);
    query = query.or(filters.join(","));
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getMember(id: string): Promise<Member | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("members").select(MEMBER_COLUMNS).eq("id", id).maybeSingle();
  return data;
}
