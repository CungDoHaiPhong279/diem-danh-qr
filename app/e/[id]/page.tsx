import { Suspense } from "react";
import { io } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { PLATFORM_NAME } from "@/lib/constants";
import { RegisterForm } from "./form";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLOSED = "Sự kiện không còn nhận đăng ký.";

async function Register({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return <p>{CLOSED}</p>;
  // supabase-js reads Date.now(); keep it out of prerender.
  await io();
  // Plain anon client, no cookies: RLS returns only open events whoever is logged in.
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data: ev } = await anon.from("events").select("id, title, club_name, location, starts_at").eq("id", id).maybeSingle();
  if (!ev) return <p>{CLOSED}</p>;
  const email = process.env.CONTACT_EMAIL || "(chưa cấu hình email liên hệ)";
  const consentLabel =
    `Tôi đồng ý cho ${ev.club_name} và ${PLATFORM_NAME} xử lý họ tên, email, mã số sinh viên, lớp, khoa của tôi để đăng ký và điểm danh sự kiện ${ev.title}. ` +
    `Dữ liệu được lưu trên máy chủ của Supabase tại Singapore và sẽ bị xóa sau 30 ngày kể từ ngày sự kiện kết thúc. ` +
    `Tôi có quyền xem, sửa, xóa dữ liệu và rút lại sự đồng ý bằng cách liên hệ ${email}.`;
  return (
    <>
      <h1 className="text-2xl font-semibold">{ev.title}</h1>
      <p>
        {ev.club_name} - {ev.location} - {new Date(ev.starts_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
      </p>
      <RegisterForm eventId={ev.id} consentLabel={consentLabel} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
    </>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 space-y-4 p-6">
      <Suspense fallback={<p>Đang tải...</p>}>
        <Register params={params} />
      </Suspense>
    </main>
  );
}
