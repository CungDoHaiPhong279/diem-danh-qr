"use server";

import { createClient, requireUser } from "@/lib/supabase/server";
import { isValidToken } from "@/lib/ticket";
import { mapCheckinRow, type CheckinOutcome } from "@/lib/checkin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BAD_QR: CheckinOutcome = { kind: "invalid", reason: "bad_qr" };

export type TicketHit = { id: string; name: string; studentId: string | null; className: string | null; faculty: string | null; checkedInAt: string | null };

export async function checkIn(input: { eventId: string; scanId: string; token?: string; ticketId?: string; scannedAt?: string }): Promise<CheckinOutcome> {
  await requireUser();
  const { eventId, scanId, token, ticketId } = input;
  if (!UUID.test(eventId) || !UUID.test(scanId)) return BAD_QR;
  if ((token === undefined) === (ticketId === undefined)) return BAD_QR;
  if (token !== undefined && !isValidToken(token)) return BAD_QR;
  if (ticketId !== undefined && !UUID.test(ticketId)) return BAD_QR;
  const t = input.scannedAt ? new Date(input.scannedAt) : null;
  const scannedAt = t && !Number.isNaN(t.getTime()) ? t.toISOString() : null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("checkin", {
    p_event: eventId,
    p_scan_id: scanId,
    p_token: token ?? null,
    p_ticket: ticketId ?? null,
    p_scanned_at: scannedAt,
  });
  if (error) {
    if (error.code === "42501") return { kind: "forbidden" };
    if (error.message === "BAD_REQUEST") return BAD_QR;
    console.error("checkin rpc failed", error.code);
    throw new Error("Không điểm danh được, vui lòng thử lại");
  }
  return mapCheckinRow(data as Record<string, unknown>);
}

export async function searchTickets(eventId: string, q: string): Promise<TicketHit[]> {
  await requireUser();
  if (!UUID.test(eventId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_tickets", { p_event: eventId, p_query: q.trim() });
  if (error) {
    if (error.code === "42501") return [];
    console.error("search_tickets rpc failed", error.code);
    throw new Error("Không tìm được, vui lòng thử lại");
  }
  return ((data ?? []) as Array<Record<string, string | null>>).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    studentId: r.student_id,
    className: r.class_name,
    faculty: r.faculty,
    checkedInAt: r.checked_in_at,
  }));
}
