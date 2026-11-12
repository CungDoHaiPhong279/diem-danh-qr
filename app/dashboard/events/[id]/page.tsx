import { Suspense } from "react";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { createClient, requireUser } from "@/lib/supabase/server";
import { CapacityForm, ToggleOpenForm } from "../forms";

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
  const qr = await QRCode.toDataURL(url, { errorCorrectionLevel: "M", width: 256 });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{ev.title}</h1>
      <p>
        {ev.club_name} - {ev.location} - {new Date(ev.starts_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
      </p>
      <p>
        Đã đăng ký: {ev.seats_taken} / {ev.capacity}
      </p>
      <p>Trạng thái: {ev.registration_open ? "Đang mở đăng ký" : "Đã đóng đăng ký"}</p>
      <ToggleOpenForm id={ev.id} open={ev.registration_open} />
      <CapacityForm id={ev.id} capacity={ev.capacity} />
      <p>
        Link đăng ký:{" "}
        <a className="underline" href={url}>
          {url}
        </a>
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="Mã QR đăng ký" width={256} height={256} />
    </div>
  );
}

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <Suspense fallback={<p>Đang tải...</p>}>
        <Event params={params} />
      </Suspense>
    </main>
  );
}
