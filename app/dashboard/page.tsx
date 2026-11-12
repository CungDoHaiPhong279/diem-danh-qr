import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createClient, requireUser } from "@/lib/supabase/server";
import { formatDate, formatTime } from "@/lib/format";
import { Badge, Card, Progress, buttonClass } from "@/components/ui";
import { CalendarIcon, PinIcon, PlusIcon, TicketIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Sự kiện của bạn" };

async function Events() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: events, error } = await supabase
    .from("events")
    .select("id, title, club_name, location, starts_at, capacity, seats_taken, registration_open, event_members!inner(user_id)")
    .eq("event_members.user_id", user.id)
    .order("starts_at", { ascending: false });
  if (error) throw error;
  if (!events.length)
    return (
      <Card className="px-6 py-14 text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <TicketIcon width={24} height={24} />
        </div>
        <h2 className="font-semibold">Chưa có sự kiện nào</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-soft">Tạo sự kiện đầu tiên để có link đăng ký và mã QR in lên poster.</p>
        <Link href="/dashboard/events/new" className={buttonClass("primary", "md", "mt-6")}>
          <PlusIcon width={18} height={18} /> Tạo sự kiện
        </Link>
      </Card>
    );
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((e) => (
        <li key={e.id}>
          <Link
            href={`/dashboard/events/${e.id}`}
            className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(28,25,23,0.04)] transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="truncate text-xs font-semibold tracking-wide text-brand-700 uppercase">{e.club_name}</p>
              <Badge tone={e.registration_open ? "open" : "closed"}>{e.registration_open ? "Đang mở" : "Đã đóng"}</Badge>
            </div>
            <h2 className="mt-2 line-clamp-2 font-semibold text-ink group-hover:text-brand-700">{e.title}</h2>
            <div className="mt-3 space-y-1.5 text-sm text-ink-soft">
              <p className="flex items-center gap-2">
                <CalendarIcon width={16} height={16} className="shrink-0 text-ink-mute" />
                {formatTime(e.starts_at)} · {formatDate(e.starts_at)}
              </p>
              <p className="flex items-center gap-2">
                <PinIcon width={16} height={16} className="shrink-0 text-ink-mute" />
                <span className="truncate">{e.location}</span>
              </p>
            </div>
            <div className="mt-auto pt-5">
              <div className="mb-2 flex items-baseline justify-between text-sm">
                <span className="text-ink-soft">Đã đăng ký</span>
                <span className="font-semibold tabular-nums">
                  {e.seats_taken}
                  <span className="font-normal text-ink-mute"> / {e.capacity}</span>
                </span>
              </div>
              <Progress value={e.seats_taken} max={e.capacity} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-52 animate-pulse rounded-2xl border border-line bg-surface" />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sự kiện của bạn</h1>
          <p className="mt-1 text-[15px] text-ink-soft">Theo dõi số đăng ký và quản lý từng sự kiện.</p>
        </div>
        <Link href="/dashboard/events/new" className={buttonClass("primary")}>
          <PlusIcon width={18} height={18} /> Tạo sự kiện
        </Link>
      </div>
      <Suspense fallback={<Skeleton />}>
        <Events />
      </Suspense>
    </>
  );
}
