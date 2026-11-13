import type { Metadata } from "next";
import { Suspense } from "react";
import { io } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { PLATFORM_NAME } from "@/lib/constants";
import { formatDate, formatTime } from "@/lib/format";
import { Card, Logo, SiteFooter } from "@/components/ui";
import { CalendarIcon, PinIcon, TicketIcon, UsersIcon } from "@/components/icons";
import { RegisterForm } from "./form";

export const metadata: Metadata = { title: "Đăng ký sự kiện" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLOSED = "Sự kiện không còn nhận đăng ký.";

function Closed() {
  return (
    <Card className="px-6 py-12 text-center">
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-stone-100 text-ink-soft">
        <TicketIcon width={24} height={24} />
      </div>
      <h1 className="text-lg font-semibold">{CLOSED}</h1>
      <p className="mt-1.5 text-sm text-ink-soft">Link có thể đã hết hạn hoặc ban tổ chức đã đóng đăng ký. Hãy liên hệ ban tổ chức nếu bạn cần hỗ trợ.</p>
    </Card>
  );
}

async function Register({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return <Closed />;
  // supabase-js reads Date.now(); keep it out of prerender.
  await io();
  // Plain anon client, no cookies: RLS returns only open events whoever is logged in.
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data: ev } = await anon
    .from("events")
    .select("id, title, club_name, location, starts_at, capacity, seats_taken")
    .eq("id", id)
    .maybeSingle();
  if (!ev) return <Closed />;
  const left = Math.max(0, ev.capacity - ev.seats_taken);
  const email = process.env.CONTACT_EMAIL || "(chưa cấu hình email liên hệ)";
  const consentLabel =
    `Tôi đồng ý cho ${ev.club_name} và ${PLATFORM_NAME} xử lý họ tên, email, mã số sinh viên, lớp, khoa của tôi để đăng ký và điểm danh sự kiện ${ev.title}. ` +
    `Dữ liệu được lưu trên máy chủ của Supabase tại Singapore và sẽ bị xóa sau 30 ngày kể từ ngày sự kiện kết thúc. ` +
    `Tôi có quyền xem, sửa, xóa dữ liệu và rút lại sự đồng ý bằng cách liên hệ ${email}.`;
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
          <div className="flex items-start gap-2.5">
            <dt className="sr-only">Số chỗ</dt>
            <UsersIcon className="mt-0.5 shrink-0 text-brand-200" />
            <dd>{left > 0 ? `Còn ${left} / ${ev.capacity} chỗ` : "Đã hết chỗ"}</dd>
          </div>
        </dl>
      </div>
      <div className="px-6 py-6">
        <h2 className="text-base font-semibold">Thông tin đăng ký</h2>
        <p className="mt-1 mb-5 text-sm text-ink-soft">Không cần tài khoản. Vé QR sẽ hiện ngay sau khi bạn đăng ký.</p>
        <RegisterForm eventId={ev.id} consentLabel={consentLabel} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
      </div>
    </Card>
  );
}

function Skeleton() {
  return (
    <Card className="overflow-hidden" aria-busy>
      <div className="h-52 animate-pulse bg-brand-700/90" />
      <div className="space-y-4 p-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-11 animate-pulse rounded-xl bg-stone-100" />
        ))}
      </div>
    </Card>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-lg px-4 pt-5 pb-4">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-lg px-4">
        <Suspense fallback={<Skeleton />}>
          <Register params={params} />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
