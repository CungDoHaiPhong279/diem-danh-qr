import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import { formatTime } from "@/lib/format";
import { Alert, Card, Progress, buttonClass } from "@/components/ui";
import { ArrowLeftIcon, ScanIcon } from "@/components/icons";
import { AutoRefresh } from "./auto-refresh";
import { AttendeeList, type Attendee } from "./attendee-list";

export const metadata: Metadata = { title: "Danh sách điểm danh" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Attendees({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  // Organizer or checker: any membership row of this user.
  const { data: ev } = await supabase.from("events").select("id, title, event_members!inner(user_id)").eq("id", id).eq("event_members.user_id", user.id).maybeSingle();
  if (!ev) notFound();

  const valid = () => supabase.from("tickets").select("id", { count: "exact", head: true }).eq("event_id", id).eq("status", "valid");
  const [list, total, inside, members] = await Promise.all([
    // Never select email: checkers read this page too.
    // shortcut: rows capped by PostgREST max_rows (1000); counts stay exact. Paginate if events get bigger.
    supabase
      .from("tickets")
      .select("id, name, student_id, class_name, faculty, checked_in_at, checked_in_by, status")
      .eq("event_id", id)
      .eq("status", "valid")
      .order("checked_in_at", { ascending: false, nullsFirst: false })
      .order("name"),
    valid(),
    valid().not("checked_in_at", "is", null),
    supabase.rpc("member_names", { p_event: id }),
  ]);
  const failed = list.error || total.error || inside.error;
  if (failed || members.error) console.error("attendees: load failed", failed?.code, members.error?.code);

  const names = new Map(((members.data ?? []) as { user_id: string; name: string }[]).map((m) => [m.user_id, m.name]));
  const rows: Attendee[] = (list.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    studentId: t.student_id,
    className: t.class_name,
    faculty: t.faculty,
    at: t.checked_in_at,
    time: t.checked_in_at ? formatTime(t.checked_in_at) : null,
    by: t.checked_in_by ? (names.get(t.checked_in_by) ?? null) : null,
  }));
  const y = total.count ?? 0;
  const x = inside.count ?? 0;
  const eventHref = `/dashboard/events/${ev.id}`;

  return (
    <>
      <AutoRefresh seconds={15} />
      <Link href={eventHref} className="mb-4 inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeftIcon width={16} height={16} className="shrink-0" />
        <span className="truncate">{ev.title}</span>
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Danh sách điểm danh</h1>
        <Link href={`${eventHref}/scan`} className={buttonClass("primary", "md")}>
          <ScanIcon width={18} height={18} /> Mở máy quét
        </Link>
      </div>

      {failed ? (
        <div className="mt-6">
          <Alert>Không tải được danh sách. Kiểm tra mạng rồi tải lại trang.</Alert>
        </div>
      ) : (
        <>
          <Card className="mt-5 p-6">
            <p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
              <span className="text-sm font-medium text-ink-soft">Đã vào</span>{" "}
              <span className="text-5xl leading-none font-bold tracking-tight">{x}</span>{" "}
              <span className="text-lg font-semibold text-ink-mute">/ {y} đã đăng ký</span>
            </p>
            <div className="mt-4">
              <Progress value={x} max={y} />
            </div>
            <p className="mt-2.5 flex flex-wrap items-center gap-x-1.5 text-sm text-ink-soft">
              <span className="tabular-nums">Còn {y - x} người chưa đến</span>
              <span aria-hidden className="hidden sm:inline">
                ·
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-full bg-brand-500 motion-safe:animate-pulse" />
                tự cập nhật mỗi 15 giây
              </span>
            </p>
          </Card>
          <AttendeeList rows={rows} eventHref={eventHref} />
        </>
      )}
    </>
  );
}

function Skeleton() {
  return (
    <div aria-busy className="space-y-5">
      <div className="h-10 max-w-sm animate-pulse rounded-xl bg-stone-200/70" />
      <div className="h-36 animate-pulse rounded-2xl bg-surface" />
      <div className="h-80 animate-pulse rounded-2xl bg-surface" />
    </div>
  );
}

export default function AttendeesPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Attendees params={params} />
    </Suspense>
  );
}
