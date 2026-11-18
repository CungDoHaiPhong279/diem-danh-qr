import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { Alert, Card, Logo, SiteFooter } from "@/components/ui";
import { IN_APP_BROWSER } from "@/lib/constants";
import { rpcErrorMessage } from "@/lib/rpc-error";
import { createClient, requireUser } from "@/lib/supabase/server";
import { isValidToken } from "@/lib/ticket";
import { AcceptForm } from "./accept-form";

export const metadata: Metadata = { title: "Lời mời soát vé" };

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await requireUser();
  let preview: { club_name: string; title: string } | undefined;
  if (isValidToken(token)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("invite_preview", { p_token: token });
    preview = data?.[0];
  }
  if (!preview) return <Alert>{rpcErrorMessage({ message: "INVITE_INVALID" })}</Alert>;
  const inApp = IN_APP_BROWSER.test((await headers()).get("user-agent") ?? "");
  return (
    <>
      <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">{preview.club_name}</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-balance">{preview.title}</h1>
      <p className="mt-2 text-[15px] text-ink-soft">Bạn được mời làm người soát vé cho sự kiện này.</p>
      {inApp && (
        <div className="mt-5">
          <Alert tone="warning">Nếu đang mở trong Zalo/Facebook/Messenger, hãy mở link này bằng Safari hoặc Chrome để đăng nhập Google và quét QR.</Alert>
        </div>
      )}
      <AcceptForm token={token} />
    </>
  );
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-5xl px-5 py-5">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-10">
        <Card className="w-full max-w-sm p-7">
          <Suspense fallback={<div aria-busy className="h-32 animate-pulse rounded-xl bg-stone-200/70" />}>
            <Invite params={params} />
          </Suspense>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
