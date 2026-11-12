"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState, useSyncExternalStore } from "react";
import { Alert, Button, Card, Logo, SiteFooter, Spinner } from "@/components/ui";
import { GoogleIcon } from "@/components/icons";

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
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
    });
    if (error) {
      setError("Không thể đăng nhập, vui lòng thử lại.");
      setLoading(false);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-5xl px-5 py-5">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-10">
        <Card className="w-full max-w-sm p-7">
          <h1 className="text-2xl font-bold tracking-tight">Đăng nhập</h1>
          <p className="mt-1.5 text-[15px] text-ink-soft">Dành cho ban tổ chức và người soát vé. Sinh viên đăng ký sự kiện không cần đăng nhập.</p>
          {inApp && (
            <div className="mt-5">
              <Alert tone="warning">
                <p>Hãy mở trang này bằng Safari hoặc Chrome để đăng nhập bằng Google.</p>
                <button type="button" onClick={copyLink} className="mt-1.5 font-semibold underline underline-offset-2">
                  {copied ? "Đã sao chép link" : "Sao chép link"}
                </button>
              </Alert>
            </div>
          )}
          <Button type="button" variant="secondary" size="lg" onClick={signIn} disabled={loading} className="mt-6 w-full">
            {loading ? <Spinner /> : <GoogleIcon />}
            Tiếp tục với Google
          </Button>
          {error && (
            <div className="mt-4">
              <Alert>{error}</Alert>
            </div>
          )}
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
