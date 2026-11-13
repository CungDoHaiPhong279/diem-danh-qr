import Link from "next/link";
import { Card, Logo, SiteFooter, buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-5xl px-5 py-5">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-10">
        <Card className="w-full max-w-sm px-6 py-10 text-center">
          <p className="text-5xl font-bold tracking-tight text-brand-600">404</p>
          <h1 className="mt-3 text-lg font-semibold">Không tìm thấy trang</h1>
          <p className="mt-1.5 text-sm text-ink-soft">Link có thể bị gõ sai hoặc đã hết hạn.</p>
          <Link href="/" className={buttonClass("secondary", "md", "mt-6")}>
            Về trang chủ
          </Link>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
