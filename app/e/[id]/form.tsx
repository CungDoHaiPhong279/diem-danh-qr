"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { Alert, Button, Field, Spinner, inputClass } from "@/components/ui";
import { ShieldIcon } from "@/components/icons";
import { submitRegistration, type RegState } from "./actions";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          size?: "normal" | "flexible" | "compact";
          callback?: () => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

type FieldDef = { name: string; label: string; placeholder: string; hint?: string; props: React.ComponentProps<"input"> };
const FIELDS: FieldDef[] = [
  { name: "name", label: "Họ và tên", placeholder: "Nguyễn Văn An", props: { autoComplete: "name", minLength: 2 } },
  { name: "email", label: "Email", placeholder: "ten@email.com", props: { type: "email", autoComplete: "email", inputMode: "email" } },
  {
    name: "student_id",
    label: "Mã số sinh viên",
    placeholder: "VD: 20231234",
    hint: "Chỉ gồm chữ và số, 4–20 ký tự.",
    props: { autoComplete: "off", autoCapitalize: "characters", pattern: "[A-Za-z0-9 ]{4,40}", title: "MSSV gồm 4-20 chữ hoặc số" },
  },
  { name: "class_name", label: "Lớp", placeholder: "VD: K67-CNTT1", props: { autoComplete: "off" } },
  { name: "faculty", label: "Khoa", placeholder: "VD: Công nghệ thông tin", props: { autoComplete: "off" } },
];

export function RegisterForm({ eventId, consentLabel, siteKey }: { eventId: string; consentLabel: string; siteKey?: string }) {
  const [state, action, pending] = useActionState<RegState, FormData>(submitRegistration.bind(null, eventId), null);
  // Turnstile tokens are single-use: get a fresh one after every server response.
  const box = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  // Submit stays disabled until Turnstile has issued a token, so nobody posts an empty one.
  const [verified, setVerified] = useState(false);
  // Script blocked/failed, widget error, or no token within 10 s: say so instead of waiting forever.
  const [verifyFailed, setVerifyFailed] = useState(false);
  useEffect(() => {
    if (!siteKey || verified || verifyFailed) return;
    const t = setTimeout(() => setVerifyFailed(true), 10000);
    return () => clearTimeout(t);
  }, [siteKey, verified, verifyFailed, state]);
  useEffect(() => {
    if (state && widgetId.current) {
      window.turnstile?.reset(widgetId.current);
      setVerified(false);
    }
  }, [state]);
  const renderWidget = () => {
    if (siteKey && box.current && window.turnstile && !widgetId.current) {
      widgetId.current = window.turnstile.render(box.current, {
        sitekey: siteKey,
        size: "flexible",
        callback: () => {
          setVerified(true);
          setVerifyFailed(false);
        },
        "expired-callback": () => setVerified(false),
        "error-callback": () => {
          setVerified(false);
          setVerifyFailed(true);
        },
      });
    }
  };
  // Script onReady covers the first load; this effect covers remounts (client navigation, Strict Mode),
  // where next/script deliberately does not call onReady again.
  useEffect(() => {
    renderWidget();
    return () => {
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
      setVerified(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <form action={action} className="space-y-4">
      {FIELDS.map((f) => {
        const error = state?.errors?.[f.name];
        return (
          <Field key={f.name} label={f.label} htmlFor={f.name} hint={f.hint} error={error}>
            <input
              id={f.name}
              name={f.name}
              required
              type="text"
              placeholder={f.placeholder}
              defaultValue={state?.values?.[f.name]}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${f.name}-error` : undefined}
              className={inputClass}
              {...f.props}
            />
          </Field>
        );
      })}

      <div className="rounded-xl border border-line bg-canvas/70 p-3.5">
        <label className="flex cursor-pointer gap-3">
          <input type="checkbox" name="consent" required defaultChecked={!!state && !state.errors?.consent} className="mt-0.5 size-5 shrink-0 cursor-pointer rounded accent-brand-600" />
          <span className="text-[13px] leading-relaxed text-ink-soft">
            {consentLabel}{" "}
            <Link href="/privacy" target="_blank" className="font-medium text-brand-700 underline underline-offset-2">
              Xem thông báo quyền riêng tư
            </Link>
          </span>
        </label>
        {state?.errors?.consent && (
          <p role="alert" className="mt-2 pl-8 text-sm text-red-600">
            {state.errors.consent}
          </p>
        )}
      </div>

      {siteKey ? (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={renderWidget} onError={() => setVerifyFailed(true)} />
          <div ref={box} className="min-h-[65px]" />
        </>
      ) : (
        <Alert>Trang đăng ký chưa được cấu hình chống bot, vui lòng báo ban tổ chức.</Alert>
      )}

      {siteKey && verifyFailed && !verified && (
        <Alert>
          <p>Không tải được bước xác minh chống spam. Hãy tải lại trang hoặc đổi mạng (4G/Wi-Fi) rồi thử lại.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-1.5 font-semibold underline underline-offset-2">
            Tải lại trang
          </button>
        </Alert>
      )}

      {state?.message && <Alert>{state.message}</Alert>}

      <Button type="submit" size="lg" disabled={pending || !siteKey || !verified} className="w-full">
        {pending ? (
          <>
            <Spinner /> Đang đăng ký…
          </>
        ) : siteKey && !verified ? (
          "Đang xác minh…"
        ) : (
          "Đăng ký và nhận vé"
        )}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-xs text-ink-mute">
        <ShieldIcon width={14} height={14} /> Thông tin chỉ dùng để đăng ký và điểm danh sự kiện này.
      </p>
    </form>
  );
}
