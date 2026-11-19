import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
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
  return <Scanner eventId={ev.id} eventTitle={ev.title} siteUrl={process.env.NEXT_PUBLIC_SITE_URL!} />;
}

export default function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div aria-busy className="fixed inset-0 z-30 bg-scan-bg" />}>
      <Scan params={params} />
    </Suspense>
  );
}
