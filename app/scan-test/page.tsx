import type { Metadata } from "next";
import { Logo, SiteFooter } from "@/components/ui";
import { ScanTest } from "./scan-test";

export const metadata: Metadata = {
  title: "Thử máy quét",
  robots: { index: false },
};

export default function ScanTestPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-5xl px-5 py-5">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-10">
        <h1 className="text-lg font-semibold">Thử máy quét QR</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Trang thử nghiệm: chỉ giải mã và hiển thị, không gửi dữ liệu đi đâu.
        </p>
        <ScanTest />
      </main>
      <SiteFooter />
    </div>
  );
}
