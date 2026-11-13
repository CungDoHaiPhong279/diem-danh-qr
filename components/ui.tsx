import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { PLATFORM_NAME } from "@/lib/constants";
import { AlertIcon, LogoMark } from "./icons";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const BTN = {
  base: "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-55",
  primary: "bg-brand-600 text-white shadow-sm shadow-brand-900/10 hover:bg-brand-700 active:bg-brand-900",
  secondary: "border border-line bg-surface text-ink hover:bg-canvas",
  ghost: "text-ink-soft hover:bg-black/5 hover:text-ink",
  md: "h-11 px-4 text-[15px]",
  lg: "h-13 px-6 text-base",
  sm: "h-9 px-3 text-sm",
};
type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";
export const buttonClass = (variant: Variant = "primary", size: Size = "md", extra?: string) => cx(BTN.base, BTN[variant], BTN[size], extra);

export function Button({ variant, size, className, ...p }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...p} />;
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={cx("rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(28,25,23,0.04)]", className)} {...p} />;
}

export const inputClass =
  "block h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-mute transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 aria-[invalid=true]:border-red-400 aria-[invalid=true]:focus:ring-red-100";

/** Label + control + hint/error. The control is passed as children so pages keep their own inputs. */
export function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : (
        hint && <p className="text-[13px] text-ink-mute">{hint}</p>
      )}
    </div>
  );
}

export function Alert({ tone = "error", children }: { tone?: "error" | "warning"; children: ReactNode }) {
  const t = tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div role="alert" className={cx("flex gap-2.5 rounded-xl border px-3.5 py-3 text-sm", t)}>
      <AlertIcon className="mt-px shrink-0" width={18} height={18} />
      <div>{children}</div>
    </div>
  );
}

export function Badge({ tone, children }: { tone: "open" | "closed"; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tone === "open" ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200" : "bg-stone-100 text-ink-soft ring-1 ring-line",
      )}
    >
      <span className={cx("size-1.5 rounded-full", tone === "open" ? "bg-brand-500" : "bg-ink-mute")} />
      {children}
    </span>
  );
}

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className={cx("h-full rounded-full", pct >= 100 ? "bg-amber-500" : "bg-brand-500")} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 rounded-lg font-semibold tracking-tight text-ink">
      <LogoMark className="size-8" />
      <span>{PLATFORM_NAME}</span>
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto px-4 py-8 text-center text-[13px] text-ink-mute">
      {PLATFORM_NAME} ·{" "}
      <Link href="/privacy" className="underline-offset-2 hover:text-ink-soft hover:underline">
        Quyền riêng tư
      </Link>
    </footer>
  );
}

export function Spinner() {
  return <span className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current" aria-hidden />;
}
