import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { io } from "next/cache";
import QRCode from "qrcode";
import { formatDate, formatTime } from "@/lib/format";
import { getTicketByToken, ticketUrl } from "@/lib/ticket";
import { Alert, Card, Logo, SiteFooter, buttonClass } from "@/components/ui";
import { CalendarIcon, DownloadIcon, PinIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Vé của bạn" };

async function Ticket({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // supabase-js reads Date.now(); keep it out of prerender.
  await io();
  const t = await getTicketByToken(token);
  if (!t) notFound();
  const qr = await QRCode.toDataURL(ticketUrl(token), { errorCorrectionLevel: "M", margin: 4, width: 320 });
  const ev = t.event;
  return (
    <Card className="overflow-hidden">
      <div className="relative bg-brand-700 px-6 pt-6 pb-7 text-white">
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-white/8" />
        <p className="relative inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide">{ev.club_name}</p>
        <h1 className="relative mt-3 text-2xl leading-tight font-bold text-balance">{ev.title}</h1>
        <dl className="relative mt-5 space-y-2.5 text-[15px] text-white/90">
          <div className="flex items-start gap-2.5">
            <dt className="sr-only">Thời gian</dt>
            <CalendarIcon className="mt-0.5 shrink-0 text-brand-200" />
            <dd>
              <span className="font-semibold text-white">{formatTime(ev.starts_at)}</span> · {formatDate(ev.starts_at)}
            </dd>
          </div>
          <div className="flex items-start gap-2.5">
            <dt className="sr-only">Địa điểm</dt>
            <PinIcon className="mt-0.5 shrink-0 text-brand-200" />
            <dd>{ev.location}</dd>
          </div>
        </dl>
      </div>
      <div className="flex flex-col items-center px-6 py-6 text-center">
        {t.status !== "valid" && (
          <div className="mb-5 w-full text-left">
            <Alert>Vé này đã bị hủy và không còn giá trị vào cửa.</Alert>
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL, nothing to optimize */}
        <img src={qr} alt="Mã QR vé" width={260} height={260} className="size-65 rounded-2xl border border-line bg-white" />
        <p className="mt-5 font-mono text-3xl font-bold tracking-[0.3em] pl-[0.3em]" aria-label="Mã vé">
          {t.short_code}
        </p>
        <p className="mt-3 text-lg font-semibold">{t.name}</p>
        <p className="text-sm text-ink-soft">MSSV: {t.student_id}</p>
        <a href={qr} download={`ve-${t.short_code}.png`} className={buttonClass("primary", "lg", "mt-6 w-full")}>
          <DownloadIcon />
          Tải ảnh vé
        </a>
        <p className="mt-4 w-full rounded-xl bg-brand-50 px-3.5 py-3 text-sm text-brand-700">Chụp màn hình vé và tăng độ sáng khi tới cửa</p>
      </div>
    </Card>
  );
}

export default function Page({ params }: { params: Promise<{ token: string }> }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-lg px-4 pt-5 pb-4">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-lg px-4">
        <Suspense fallback={<Card className="h-96 animate-pulse" aria-busy />}>
          <Ticket params={params} />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
