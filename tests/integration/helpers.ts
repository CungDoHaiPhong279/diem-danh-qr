import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.SUPABASE_URL!;
// These tests create users and delete data: refuse anything but a local Supabase.
if (!/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url ?? "")) throw new Error(`Integration tests write data: refusing non-local SUPABASE_URL (${url})`);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

export const admin: SupabaseClient = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);
export const anon: SupabaseClient = createClient(url, process.env.SUPABASE_ANON_KEY!, opts);

export type EventRow = {
  id: string;
  owner_id: string;
  club_name: string;
  title: string;
  starts_at: string;
  location: string;
  capacity: number;
  seats_taken: number;
  registration_open: boolean;
  purge_after: string | null;
};

// Local Supabase only: never point SUPABASE_URL at a real project.
export async function createTestUser(): Promise<{ id: string; client: SupabaseClient }> {
  const email = `u-${randomUUID()}@test.local`;
  const password = randomUUID();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createClient(url, process.env.SUPABASE_ANON_KEY!, opts);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

export async function createEvent(ownerId: string, overrides: Partial<EventRow> = {}): Promise<EventRow> {
  const { data, error } = await admin
    .from("events")
    .insert({
      owner_id: ownerId,
      club_name: "Club",
      title: "Event",
      starts_at: new Date(Date.now() + 86400000).toISOString(),
      location: "Hall",
      capacity: 100,
      ...overrides,
    })
    .select()
    .single();
  if (error) throw error;
  return data as EventRow;
}
