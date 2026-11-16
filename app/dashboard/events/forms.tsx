"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Field, Spinner, buttonClass, inputClass } from "@/components/ui";
import { CheckIcon, CopyIcon, DownloadIcon } from "@/components/icons";
import { createEvent, setCapacity, setRegistrationOpen, type FormState } from "./actions";

export function NewEventForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createEvent, null);
  const f = (name: string, label: string, props: React.ComponentProps<"input"> = {}, hint?: string) => {
    const error = state?.errors?.[name];
    return (
      <Field label={label} htmlFor={name} hint={hint} error={error}>
        <input
          id={name}
          name={name}
          required
          defaultValue={state?.values?.[name]}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : undefined}
          className={inputClass}
          {...props}
        />
      </Field>
    );
  };
  return (
    <form action={action} className="space-y-5">
      {f("club_name", "Tên câu lạc bộ", { placeholder: "VD: CLB Lập trình" })}
      {f("title", "Tên sự kiện", { placeholder: "VD: Workshop Next.js" })}
      <div className="grid gap-5 sm:grid-cols-[1fr_140px]">
        {f("starts_at", "Thời gian bắt đầu", { type: "datetime-local" }, "Giờ Việt Nam. Chọn cả ngày và giờ.")}
        {f("capacity", "Số chỗ", { type: "number", min: 1, max: 5000, inputMode: "numeric", placeholder: "100" }, "Tối đa 5000.")}
      </div>
      {f("location", "Địa điểm", { placeholder: "VD: Hội trường C2, tầng 3" })}
      {state?.message && <Alert>{state.message}</Alert>}
      <div className="flex justify-end pt-1">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending && <Spinner />} Tạo sự kiện
        </Button>
      </div>
    </form>
  );
}

export function ToggleOpenForm({ id, open }: { id: string; open: boolean }) {
  const [state, action, pending] = useActionState(setRegistrationOpen.bind(null, id, !open), null);
  return (
    <form action={action} className="flex items-center justify-between gap-4">
      <div>
        <p className="font-medium">Nhận đăng ký</p>
        <p className="text-sm text-ink-soft">{open ? "Sinh viên đang đăng ký được qua link." : "Link đăng ký đang tạm khóa."}</p>
        {state?.message && (
          <p role="alert" className="mt-1 text-sm text-red-600">
            {state.message}
          </p>
        )}
      </div>
      <button
        type="submit"
        role="switch"
        aria-checked={open}
        aria-label="Mở đăng ký"
        disabled={pending}
        className={`relative h-7 w-12 shrink-0 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60 ${open ? "bg-brand-600" : "bg-stone-300"}`}
      >
        <span className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform ${open ? "translate-x-5" : ""}`} />
      </button>
    </form>
  );
}

export function CapacityForm({ id, capacity }: { id: string; capacity: number }) {
  const [state, action, pending] = useActionState(setCapacity.bind(null, id), null);
  return (
    <form action={action}>
      <label htmlFor="capacity" className="font-medium">
        Số chỗ
      </label>
      <p className="text-sm text-ink-soft">Không được nhỏ hơn số đã đăng ký.</p>
      <div className="mt-2.5 flex gap-2">
        <input
          id="capacity"
          name="capacity"
          type="number"
          inputMode="numeric"
          min={1}
          max={5000}
          defaultValue={capacity}
          required
          aria-invalid={state?.message ? true : undefined}
          className={`${inputClass} max-w-32`}
        />
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Đang lưu…" : "Lưu"}
        </Button>
      </div>
      {state?.message && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function ShareActions({ url, qr, fileName }: { url: string; qr: string; fileName: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Sao chép link đăng ký:", url);
    }
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button type="button" variant="secondary" onClick={copy}>
        {copied ? <CheckIcon width={18} height={18} className="text-brand-600" /> : <CopyIcon width={18} height={18} />}
        {copied ? "Đã chép" : "Sao chép"}
      </Button>
      <a href={qr} download={fileName} className={buttonClass("secondary")}>
        <DownloadIcon width={18} height={18} /> Tải QR
      </a>
    </div>
  );
}
