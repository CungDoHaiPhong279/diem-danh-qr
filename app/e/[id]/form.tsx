"use client";

import { useActionState } from "react";
import Script from "next/script";
import { submitRegistration, type RegState } from "./actions";

const FIELDS = [
  ["name", "Họ và tên", "name"],
  ["email", "Email", "email"],
  ["student_id", "Mã số sinh viên", "off"],
  ["class_name", "Lớp", "off"],
  ["faculty", "Khoa", "off"],
] as const;

export function RegisterForm({ eventId, consentLabel, siteKey }: { eventId: string; consentLabel: string; siteKey?: string }) {
  const [state, action, pending] = useActionState<RegState, FormData>(submitRegistration.bind(null, eventId), null);
  return (
    <form action={action} className="space-y-3">
      {FIELDS.map(([name, label, auto]) => (
        <label key={name} className="block">
          {label}
          <input
            name={name}
            required
            autoComplete={auto}
            type={name === "email" ? "email" : "text"}
            defaultValue={state?.values?.[name]}
            className="w-full rounded border p-2"
          />
          {state?.errors?.[name] && (
            <span role="alert" className="text-red-600">
              {state.errors[name]}
            </span>
          )}
        </label>
      ))}
      <label className="flex gap-2 text-sm">
        <input type="checkbox" name="consent" required className="mt-1" />
        <span>
          {consentLabel}{" "}
          <a href="/privacy" target="_blank" className="underline">
            Thông báo quyền riêng tư
          </a>
        </span>
      </label>
      {state?.errors?.consent && (
        <p role="alert" className="text-red-600">
          {state.errors.consent}
        </p>
      )}
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      <div className="cf-turnstile" data-sitekey={siteKey} />
      {state?.message && (
        <p role="alert" className="text-red-600">
          {state.message}
        </p>
      )}
      <button disabled={pending} className="rounded bg-black px-4 py-2 text-white">
        Đăng ký
      </button>
    </form>
  );
}
