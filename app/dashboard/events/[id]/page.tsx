import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { createClient, requireUser } from "@/lib/supabase/server";
import { formatDate, formatTime } from "@/lib/format";
import { Badge, Card, Progress } from "@/components/ui";
import { ArrowLeftIcon, CalendarIcon, PinIcon } from "@/components/icons";
import { CapacityForm, ShareActions, ToggleOpenForm } from "../forms";

export const metadata: Metadata = { title: "Quản lý sự kiện" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Event({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data: ev } = await supabase
    .from("events")
    .select("id, title, club_name, location, starts_at, capacity, seats_taken, registration_open")
    .eq("id", id)
    .maybeSingle();
  if (!ev) notFound();
  const url = `${process.env.NEXT_PUBLIC_SITE_URL}/e/${ev.id}`;
  // 1024px so the downloaded file prints sharply on a poster; displayed smaller.
  const qr = await QRCode.toDataURL(url, { errorCorrectionLevel: "M", width: 1024, margin: 2 });
  const left = Math.max(0, ev.capacity - ev.seats_taken);
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">{ev.club_name}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-balance">{ev.title}</h1>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[15px] text-ink-soft">
            <span className="inline-flex items-center gap-2">
              <CalendarIcon width={17} height={17} className="text-ink-mute" />
              {formatTime(ev.starts_at)} · {formatDate(ev.starts_at)}
            </span>
            <span className="inline-flex items-center gap-2">
              <PinIcon width={17} height={17} className="text-ink-mute" />
              {ev.location}
            </span>
          </div>
        </div>
        <Badge tone={ev.registration_open ? "open" : "closed"}>{ev.registration_open ? "Đang mở đăng ký" : "Đã đóng đăng ký"}</Badge>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Card className="min-w-0 p-6">
            <p className="text-sm font-medium text-ink-soft">Đã đăng ký</p>
            <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums">
              {ev.seats_taken}
              <span className="text-xl font-semibold text-ink-mute"> / {ev.capacity}</span>
            </p>
            <div className="mt-4">
              <Progress value={ev.seats_taken} max={ev.capacity} />
            </div>
            <p className="mt-2.5 text-sm text-ink-soft">{left > 0 ? `Còn ${left} chỗ trống.` : "Đã đủ chỗ. Tăng số chỗ nếu muốn nhận thêm."}</p>
          </Card>
          <Card className="divide-y divide-line">
            <div className="p-6">
              <ToggleOpenForm id={ev.id} open={ev.registration_open} />
            </div>
            <div className="p-6">
              <CapacityForm id={ev.id} capacity={ev.capacity} />
            </div>
          </Card>
        </div>

        <Card className="min-w-0 p-6">
          <h2 className="font-semibold">Chia sẻ link đăng ký</h2>
          <p className="mt-1 text-sm text-ink-soft">In mã QR lên poster hoặc gửi link vào nhóm lớp.</p>
          <div className="mx-auto mt-5 w-full max-w-[240px] rounded-2xl border border-line bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={`Mã QR đăng ký sự kiện ${ev.title}`} width={256} height={256} className="h-auto w-full" />
          </div>
          <a href={url} target="_blank" className="mt-4 block truncate rounded-xl bg-canvas px-3 py-2.5 text-center font-mono text-[13px] text-ink-soft hover:text-brand-700">
            {url.replace(/^https?:\/\//, "")}
          </a>
          <div className="mt-3">
            <ShareActions url={url} qr={qr} fileName={`qr-dang-ky-${ev.id.slice(0, 8)}.png`} />
          </div>
        </Card>
      </div>
    </>
  );
}

function Skeleton() {
  return (
    <div aria-busy className="space-y-5">
      <div className="h-20 max-w-lg animate-pulse rounded-xl bg-stone-200/70" />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="h-64 animate-pulse rounded-2xl bg-surface" />
        <div className="h-96 animate-pulse rounded-2xl bg-surface" />
      </div>
    </div>
  );
}

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <>
      <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeftIcon width={16} height={16} /> Sự kiện của bạn
      </Link>
      <Suspense fallback={<Skeleton />}>
        <Event params={params} />
      </Suspense>
    </>
  );
}
