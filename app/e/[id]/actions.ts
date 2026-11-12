"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { registerTicket, type RegisterFailure } from "@/lib/register";
import { verifyTurnstile } from "@/lib/turnstile";
import { parseRegistration } from "@/lib/validation";

export type RegState = { message?: string; errors?: Record<string, string>; values?: Record<string, string> } | null;

const MESSAGES: Record<RegisterFailure, string> = {
  EVENT_FULL: "Sự kiện đã hết chỗ.",
  EVENT_CLOSED: "Sự kiện không còn nhận đăng ký.",
  EVENT_NOT_FOUND: "Sự kiện không còn nhận đăng ký.",
  ALREADY_REGISTERED: "Email hoặc MSSV này đã đăng ký sự kiện. Hãy dùng vé đã nhận.",
  UNKNOWN: "Có lỗi, bạn thử lại sau ít phút.",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function submitRegistration(eventId: string, _prev: RegState, fd: FormData): Promise<RegState> {
  const values = Object.fromEntries(["name", "email", "student_id", "class_name", "faculty"].map((k) => [k, String(fd.get(k) ?? "")]));
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || null;
  const tsToken = fd.get("cf-turnstile-response");
  if (!(await verifyTurnstile(typeof tsToken === "string" ? tsToken : null, ip))) {
    return { values, message: "Không xác minh được bạn không phải bot, hãy tải lại trang." };
  }
  const parsed = parseRegistration(fd);
  if (!parsed.ok) return { values, errors: parsed.errors };
  if (!UUID.test(eventId)) return { values, message: MESSAGES.EVENT_NOT_FOUND };
  const res = await registerTicket({ ...parsed.value, eventId });
  if (!res.ok) return { values, message: MESSAGES[res.reason] };
  redirect(`/t/${res.token}`);
}
