import Link from "next/link";
import { Card, Logo, SiteFooter, buttonClass } from "@/components/ui";
import { ScanIcon, TicketIcon, UsersIcon } from "@/components/icons";

const STEPS = [
  { icon: UsersIcon, title: "Tạo sự kiện", text: "Nhập tên, thời gian, địa điểm, số chỗ. Nhận link và mã QR để in lên poster." },
  { icon: TicketIcon, title: "Sinh viên đăng ký", text: "Mở link trên điện thoại, điền 5 thông tin, nhận vé QR ngay. Không cần tài khoản." },
  { icon: ScanIcon, title: "Quét vé ở cửa", text: "Ban tổ chức quét QR bằng camera điện thoại. Không trùng, không vượt số chỗ." },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <Logo />
        <Link href="/login" className={buttonClass("ghost", "sm")}>
          Đăng nhập
        </Link>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5">
        <section className="py-12 text-center sm:py-20">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[13px] font-medium text-brand-700">
            Miễn phí cho câu lạc bộ sinh viên
          </p>
          <h1 className="mx-auto mt-5 max-w-2xl text-4xl leading-[1.15] font-bold tracking-tight text-balance sm:text-5xl">
            Đăng ký và điểm danh sự kiện <span className="text-brand-600">bằng mã QR</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-ink-soft text-pretty">
            Bỏ Google Form và danh sách giấy. Sinh viên nhận vé trên điện thoại, ban tổ chức quét vé ở cửa trong một giây.
          </p>
          <div className="mt-8 flex justify-center">
            <Link href="/login" className={buttonClass("primary", "lg")}>
              Bắt đầu tạo sự kiện
            </Link>
          </div>
        </section>

        <section aria-label="Cách hoạt động" className="grid gap-4 pb-16 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <Card key={title} className="p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon />
                </span>
                <span className="text-sm font-semibold text-ink-mute">Bước {i + 1}</span>
              </div>
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{text}</p>
            </Card>
          ))}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
