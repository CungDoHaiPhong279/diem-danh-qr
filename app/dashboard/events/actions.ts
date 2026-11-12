"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";
import { parseCapacity, parseEventForm } from "@/lib/validation";

export type FormState = { errors?: Record<string, string>; message?: string; values?: Record<string, string> } | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createEvent(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = parseEventForm(fd);
  // Echo typed values back so a failed submit does not wipe the form.
  const values = Object.fromEntries([...fd.entries()].filter(([k, v]) => !k.startsWith("$") && typeof v === "string")) as Record<string, string>;
  if (!parsed.ok) return { errors: parsed.errors, values };
  const supabase = await createClient();
  // New events are open (default registration_open = true), so events_select lets .select() read the row back.
  const { data, error } = await supabase
    .from("events")
    .insert({ ...parsed.value, owner_id: user.id })
    .select("id")
    .single();
  if (error || !data) return { message: "Không tạo được sự kiện, vui lòng thử lại", values };
  redirect(`/dashboard/events/${data.id}`);
}

async function updateEvent(id: string, patch: { registration_open: boolean } | { capacity: number }): Promise<FormState> {
  await requireUser();
  if (!UUID.test(id)) return { message: "Sự kiện không hợp lệ" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").update(patch).eq("id", id).select("id");
  if (error?.code === "23514") return { message: "Số chỗ không được nhỏ hơn số đã đăng ký" };
  // RLS filters rows silently: zero rows means not an organizer (or no such event).
  if (error || !data?.length) return { message: "Không cập nhật được sự kiện" };
  revalidatePath(`/dashboard/events/${id}`);
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature required by useActionState
export async function setRegistrationOpen(id: string, open: boolean, _prev: FormState): Promise<FormState> {
  return updateEvent(id, { registration_open: open });
}

export async function setCapacity(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const capacity = parseCapacity(fd.get("capacity"));
  if (capacity === null) return { message: "Số chỗ phải là số nguyên từ 1 đến 5000" };
  return updateEvent(id, { capacity });
}
