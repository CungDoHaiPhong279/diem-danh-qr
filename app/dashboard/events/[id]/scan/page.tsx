import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import { Alert } from "@/components/ui";
import { Scanner } from "./scanner";

export const metadata: Metadata = { title: "Máy quét" };
export const viewport: Viewport = { themeColor: "#1c1917" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Scan({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  // Organizer or checker: any membership row of this user.
  const { data: ev } = await supabase
    .from("events")
    .select("id, title, event_members!inner(user_id)")
    .eq("id", id)
    .eq("event_members.user_id", user.id)
    .maybeSingle();
  if (!ev) notFound();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  // Without it every ticket QR would be rejected as foreign: fail loudly instead.
  if (!siteUrl || !URL.canParse(siteUrl))
    return (
      <div className="fixed inset-0 z-30 bg-scan-bg p-4">
        <div className="mx-auto max-w-[480px]">
          <Alert>Thiếu cấu hình địa chỉ trang (NEXT_PUBLIC_SITE_URL)</Alert>
        </div>
      </div>
    );
  return <Scanner eventId={ev.id} eventTitle={ev.title} siteUrl={siteUrl} />;
}

export default function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div aria-busy className="fixed inset-0 z-30 bg-scan-bg" />}>
      <Scan params={params} />
    </Suspense>
  );
}
