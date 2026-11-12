"use client";

import { useActionState, useEffect, useRef } from "react";
import Script from "next/script";
import { submitRegistration, type RegState } from "./actions";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string }) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

const FIELDS = [
  ["name", "Họ và tên", "name"],
  ["email", "Email", "email"],
  ["student_id", "Mã số sinh viên", "off"],
  ["class_name", "Lớp", "off"],
  ["faculty", "Khoa", "off"],
] as const;

export function RegisterForm({ eventId, consentLabel, siteKey }: { eventId: string; consentLabel: string; siteKey?: string }) {
  const [state, action, pending] = useActionState<RegState, FormData>(submitRegistration.bind(null, eventId), null);
  // Turnstile tokens are single-use: get a fresh one after every server response.
  const box = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  useEffect(() => {
    if (state && widgetId.current) window.turnstile?.reset(widgetId.current);
  }, [state]);
  const renderWidget = () => {
    if (siteKey && box.current && window.turnstile && !widgetId.current) {
      widgetId.current = window.turnstile.render(box.current, { sitekey: siteKey });
    }
  };
  // Script onReady covers the first load; this effect covers remounts (client navigation, Strict Mode),
  // where next/script deliberately does not call onReady again.
  useEffect(() => {
    renderWidget();
    return () => {
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
            minLength={name === "name" ? 2 : undefined}
            pattern={name === "student_id" ? "[A-Za-z0-9 ]{4,40}" : undefined}
            title={name === "student_id" ? "MSSV gồm 4-20 chữ hoặc số" : undefined}
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
      {siteKey ? (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={renderWidget} />
          <div ref={box} />
        </>
      ) : (
        <p role="alert" className="text-red-600">
          Trang đăng ký chưa được cấu hình chống bot, vui lòng báo ban tổ chức.
        </p>
      )}
      {state?.message && (
        <p role="alert" className="text-red-600">
          {state.message}
        </p>
      )}
      <button disabled={pending || !siteKey} className="rounded bg-black px-4 py-2 text-white">
        Đăng ký
      </button>
    </form>
  );
}
