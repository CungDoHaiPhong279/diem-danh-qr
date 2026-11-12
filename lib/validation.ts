import type { RegistrationInput } from "@/lib/register";

export type EventInput = { club_name: string; title: string; starts_at: string; location: string; capacity: number };
export type EventParse = { ok: true; value: EventInput } | { ok: false; errors: Record<string, string> };

export const CAPACITY_MIN = 1;
export const CAPACITY_MAX = 5000;

export function parseCapacity(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= CAPACITY_MIN && n <= CAPACITY_MAX ? n : null;
}

export function parseEventForm(fd: FormData): EventParse {
  const errors: Record<string, string> = {};
  const text = (k: string) => String(fd.get(k) ?? "").trim();
  const club_name = text("club_name");
  const title = text("title");
  const location = text("location");
  if (!club_name) errors.club_name = "Vui lòng nhập tên CLB";
  if (!title) errors.title = "Vui lòng nhập tên sự kiện";
  if (!location) errors.location = "Vui lòng nhập địa điểm";

  // datetime-local has no zone; it means Asia/Ho_Chi_Minh (+07:00, no DST).
  const raw = text("starts_at");
  const d = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? new Date(`${raw}:00+07:00`) : null;
  if (!d || Number.isNaN(d.getTime())) errors.starts_at = "Thời gian không hợp lệ";

  const capacity = parseCapacity(fd.get("capacity"));
  if (capacity === null) errors.capacity = `Số chỗ phải là số nguyên từ ${CAPACITY_MIN} đến ${CAPACITY_MAX}`;

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { club_name, title, starts_at: d!.toISOString(), location, capacity: capacity! } };
}

export type RegistrationParse = { ok: true; value: RegistrationInput } | { ok: false; errors: Record<string, string> };

export function parseRegistration(fd: FormData): RegistrationParse {
  const errors: Record<string, string> = {};
  const text = (k: string) => String(fd.get(k) ?? "").trim();
  const name = text("name").normalize("NFC").replace(/\s+/g, " ");
  const email = text("email").toLowerCase();
  const student_id = text("student_id").replace(/\s+/g, "").toUpperCase();
  const class_name = text("class_name");
  const faculty = text("faculty");
  if (name.length < 2 || name.length > 100) errors.name = "Họ tên cần từ 2 đến 100 ký tự";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Email không hợp lệ";
  if (!/^[A-Z0-9]{4,20}$/.test(student_id)) errors.student_id = "MSSV gồm 4-20 chữ hoặc số";
  if (!class_name || class_name.length > 100) errors.class_name = "Vui lòng nhập lớp";
  if (!faculty || faculty.length > 100) errors.faculty = "Vui lòng nhập khoa";
  if (fd.get("consent") !== "on") errors.consent = "Bạn cần đồng ý để đăng ký.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name, email, student_id, class_name, faculty } };
}
