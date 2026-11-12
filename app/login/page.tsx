"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState, useSyncExternalStore } from "react";

const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function LoginPage() {
  // Google blocks OAuth inside these in-app browsers; server snapshot is false.
  const inApp = useSyncExternalStore(
    () => () => {},
    () => /Zalo|FBAN|FBAV|Messenger/i.test(navigator.userAgent),
    () => false,
  );
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
    });
    if (error) setError("Không thể đăng nhập, vui lòng thử lại.");
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Đăng nhập ban tổ chức</h1>
      {inApp && (
        <div role="alert" className="rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
          <p>Hãy mở trang này bằng Safari hoặc Chrome để đăng nhập bằng Google.</p>
          <button type="button" onClick={copyLink} className="mt-2 underline">
            {copied ? "Đã sao chép" : "Sao chép link"}
          </button>
        </div>
      )}
      <button type="button" onClick={signIn} className="rounded bg-black px-4 py-3 text-white dark:bg-white dark:text-black">
        Đăng nhập bằng Google
      </button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </main>
  );
}
