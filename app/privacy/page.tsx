import { Suspense } from "react";
import { connection } from "next/server";
import { NOTICE_VERSION, PLATFORM_NAME } from "@/lib/constants";

async function Contact() {
  // Read at request time so the value is not frozen into the prerendered shell.
  await connection();
  return <>{process.env.CONTACT_EMAIL || "(chưa cấu hình email liên hệ)"}</>;
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 space-y-3 p-6">
      <h1 className="text-2xl font-semibold">Thông báo quyền riêng tư</h1>
      <p>Dữ liệu thu thập: họ tên, email, mã số sinh viên, lớp, khoa.</p>
      <p>Mục đích: đăng ký và điểm danh sự kiện.</p>
      <p>Bên kiểm soát dữ liệu: câu lạc bộ tổ chức sự kiện và nền tảng {PLATFORM_NAME}.</p>
      <p>Lưu trữ: máy chủ Supabase tại Singapore.</p>
      <p>Thời hạn lưu: xóa sau 30 ngày kể từ ngày sự kiện kết thúc.</p>
      <p>
        Quyền của bạn: xem, sửa, xóa dữ liệu và rút lại sự đồng ý bằng cách liên hệ{" "}
        <Suspense fallback="...">
          <Contact />
        </Suspense>
        .
      </p>
      <p className="text-sm text-gray-600">Phiên bản: {NOTICE_VERSION}</p>
    </main>
  );
}
