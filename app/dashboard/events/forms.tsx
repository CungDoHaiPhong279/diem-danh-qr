"use client";

import { useActionState } from "react";
import { createEvent, setCapacity, setRegistrationOpen, type FormState } from "./actions";

const input = "w-full rounded border p-2";

export function NewEventForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createEvent, null);
  const f = (name: string, label: string, props: React.ComponentProps<"input"> = {}) => (
    <label className="block">
      {label}
      <input name={name} required className={input} {...props} />
      {state?.errors?.[name] && (
        <span role="alert" className="text-red-600">
          {state.errors[name]}
        </span>
      )}
    </label>
  );
  return (
    <form action={action} className="space-y-3">
      {f("club_name", "Tên CLB")}
      {f("title", "Tên sự kiện")}
      {f("starts_at", "Thời gian bắt đầu (giờ Việt Nam)", { type: "datetime-local" })}
      {f("location", "Địa điểm")}
      {f("capacity", "Số chỗ", { type: "number", min: 1, max: 5000 })}
      {state?.message && (
        <p role="alert" className="text-red-600">
          {state.message}
        </p>
      )}
      <button disabled={pending} className="rounded bg-black px-4 py-2 text-white">
        Tạo sự kiện
      </button>
    </form>
  );
}

export function ToggleOpenForm({ id, open }: { id: string; open: boolean }) {
  const [state, action, pending] = useActionState(setRegistrationOpen.bind(null, id, !open), null);
  return (
    <form action={action}>
      <button disabled={pending} className="rounded border px-3 py-1">
        {open ? "Đóng đăng ký" : "Mở đăng ký"}
      </button>
      {state?.message && (
        <p role="alert" className="text-red-600">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function CapacityForm({ id, capacity }: { id: string; capacity: number }) {
  const [state, action, pending] = useActionState(setCapacity.bind(null, id), null);
  return (
    <form action={action} className="flex items-center gap-2">
      <input name="capacity" type="number" min={1} max={5000} defaultValue={capacity} required className="w-24 rounded border p-1" />
      <button disabled={pending} className="rounded border px-3 py-1">
        Đổi số chỗ
      </button>
      {state?.message && (
        <span role="alert" className="text-red-600">
          {state.message}
        </span>
      )}
    </form>
  );
}
