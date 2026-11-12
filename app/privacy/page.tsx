import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { NOTICE_VERSION, PLATFORM_NAME } from "@/lib/constants";
import { Card, Logo, SiteFooter } from "@/components/ui";

export const metadata: Metadata = { title: "Quyền riêng tư" };

async function Contact() {
  // Read at request time so the value is not frozen into the prerendered shell.
  await connection();
  return <>{process.env.CONTACT_EMAIL || "(chưa cấu hình email liên hệ)"}</>;
}

const ROWS: [string, React.ReactNode][] = [
  ["Dữ liệu thu thập", "Họ tên, email, mã số sinh viên, lớp, khoa."],
  ["Mục đích", "Đăng ký và điểm danh sự kiện."],
  ["Bên kiểm soát dữ liệu", `Câu lạc bộ tổ chức sự kiện và nền tảng ${PLATFORM_NAME}.`],
  ["Nơi lưu trữ", "Máy chủ Supabase tại Singapore."],
  ["Thời hạn lưu", "Xóa sau 30 ngày kể từ ngày sự kiện kết thúc."],
  [
    "Quyền của bạn",
    <>
      Xem, sửa, xóa dữ liệu và rút lại sự đồng ý bằng cách liên hệ{" "}
      <Suspense fallback="…">
        <Contact />
      </Suspense>
      .
    </>,
  ],
];

export default function PrivacyPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-2xl px-5 py-5">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-2xl px-4">
        <Card className="p-6 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight">Thông báo quyền riêng tư</h1>
          <p className="mt-1.5 text-sm text-ink-mute">Phiên bản {NOTICE_VERSION}</p>
          <dl className="mt-6 divide-y divide-line">
            {ROWS.map(([k, v]) => (
              <div key={k} className="grid gap-1 py-4 sm:grid-cols-[180px_1fr] sm:gap-4">
                <dt className="text-sm font-semibold">{k}</dt>
                <dd className="text-[15px] text-ink-soft">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
