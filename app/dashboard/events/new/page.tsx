import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { ArrowLeftIcon } from "@/components/icons";
import { NewEventForm } from "../forms";

export const metadata: Metadata = { title: "Tạo sự kiện" };

export default function NewEventPage() {
  return (
    <div className="mx-auto max-w-xl">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeftIcon width={16} height={16} /> Sự kiện của bạn
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">Tạo sự kiện</h1>
      <p className="mt-1 text-[15px] text-ink-soft">Sau khi tạo, bạn sẽ có link đăng ký và mã QR để chia sẻ.</p>
      <Card className="mt-6 p-6">
        <NewEventForm />
      </Card>
    </div>
  );
}
