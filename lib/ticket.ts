import { admin } from "@/lib/supabase/admin";

const TOKEN = /^[0-9a-f]{32}$/;

export const isValidToken = (s: string) => TOKEN.test(s);

export const ticketUrl = (token: string) => `${process.env.NEXT_PUBLIC_SITE_URL}/t/${token}`;

export type Ticket = {
  name: string;
  student_id: string;
  short_code: string;
  status: string;
  event: { title: string; club_name: string; starts_at: string; location: string };
};

/** Never selects email: the token is a bearer secret, the page must not leak PII beyond the holder's own name/MSSV. */
export async function getTicketByToken(token: string): Promise<Ticket | null> {
  if (!isValidToken(token)) return null;
  const { data, error } = await admin
    .from("tickets")
    .select("name, student_id, short_code, status, events(title, club_name, starts_at, location)")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { events, ...rest } = data as unknown as Omit<Ticket, "event"> & { events: Ticket["event"] };
  return { ...rest, event: events };
}
