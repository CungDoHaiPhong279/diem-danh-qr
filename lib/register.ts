import { admin } from "@/lib/supabase/admin";
import { NOTICE_VERSION } from "@/lib/constants";

export type RegisterFailure = "EVENT_NOT_FOUND" | "EVENT_CLOSED" | "EVENT_FULL" | "ALREADY_REGISTERED" | "UNKNOWN";

export type RegistrationInput = { name: string; email: string; student_id: string; class_name: string; faculty: string };

const BUSINESS = ["EVENT_NOT_FOUND", "EVENT_CLOSED", "EVENT_FULL", "ALREADY_REGISTERED"] as const;

// shortcut: short_code collision (~3e-5 at 500 seats) reports UNKNOWN, retry on the form if it ever shows up
export function mapRegisterError(err: { code?: string; message: string }): RegisterFailure {
  const known = BUSINESS.find((m) => m === err.message);
  if (known) return known;
  if (err.code === "23505" && /tickets_event_(email|student)_key/.test(err.message)) return "ALREADY_REGISTERED";
  return "UNKNOWN";
}

export async function registerTicket(
  input: RegistrationInput & { eventId: string },
): Promise<{ ok: true; token: string } | { ok: false; reason: RegisterFailure; code?: string; message?: string }> {
  const { data, error } = await admin.rpc("register", {
    p_event: input.eventId,
    p_name: input.name,
    p_email: input.email,
    p_student_id: input.student_id,
    p_class: input.class_name,
    p_faculty: input.faculty,
    p_notice_version: NOTICE_VERSION,
  });
  if (error) return { ok: false, reason: mapRegisterError(error), code: error.code, message: error.message };
  return { ok: true, token: data.token };
}
