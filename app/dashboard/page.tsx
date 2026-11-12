import { Suspense } from "react";
import { createClient, requireUser } from "@/lib/supabase/server";

async function Events() {
  await requireUser();
  const supabase = await createClient();
  const { data: events, error } = await supabase.from("events").select("id, title, starts_at").order("starts_at", { ascending: false });
  if (error) throw error;
  if (!events.length) return <p>Chưa có sự kiện nào.</p>;
  return (
    <ul className="list-disc pl-5">
      {events.map((e) => (
        <li key={e.id}>
          {e.title} ({new Date(e.starts_at).toLocaleString("vi-VN")})
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Sự kiện của bạn</h1>
      <Suspense fallback={<p>Đang tải...</p>}>
        <Events />
      </Suspense>
    </main>
  );
}
