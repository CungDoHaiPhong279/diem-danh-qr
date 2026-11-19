"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { foldText } from "@/lib/format";
import { Card, inputClass } from "@/components/ui";
import { SearchIcon } from "@/components/icons";

/** `time` is formatted on the server so hydration never sees a different locale/timezone. */
export type Attendee = { id: string; name: string; studentId: string | null; className: string | null; faculty: string | null; at: string | null; time: string | null; by: string | null };

type Tab = "in" | "out" | "all";

// One DOM per row: a card on phones, table columns from md (Khoa from lg). Cells are placed explicitly below md.
const COLS =
  "md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_4.5rem_minmax(0,1.3fr)] lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_4.5rem_minmax(0,1.3fr)] md:items-center md:gap-x-4 md:px-5";
const RESET = "md:col-span-1 md:col-start-auto md:row-start-auto md:text-left";

/** Counts come from the server's exact X / Y, not from `rows`. */
export function AttendeeList({ rows, inCount, outCount, eventHref }: { rows: Attendee[]; inCount: number; outCount: number; eventHref: string }) {
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const keyed = useMemo(() => rows.map((r) => ({ r, key: foldText(`${r.name} ${r.studentId ?? ""}`) })), [rows]);

  if (rows.length === 0)
    return (
      <Card className="mt-5 px-6 py-12 text-center text-[15px] text-ink-soft">
        Chưa có ai đăng ký.{" "}
        <Link href={eventHref} className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-900">
          Chia sẻ link đăng ký ở trang sự kiện.
        </Link>
      </Card>
    );

  const tabs: [Tab, string][] = [
    ["in", `Đã vào (${inCount})`],
    ["out", `Chưa đến (${outCount})`],
    ["all", "Tất cả"],
  ];
  const needle = foldText(q.trim());
  const shown = keyed.filter(({ r, key }) => (tab === "all" || (tab === "in") === !!r.at) && key.includes(needle)).map(({ r }) => r);

  return (
    <>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Lọc theo trạng thái" className="inline-flex self-start rounded-xl bg-stone-200/60 p-1">
          {tabs.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={tab === value}
              onClick={() => setTab(value)}
              className="h-9 rounded-lg px-3.5 text-sm font-medium text-ink-soft tabular-nums transition hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-600 aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow-sm"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <SearchIcon width={18} height={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-mute" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Lọc theo tên hoặc MSSV" placeholder="Lọc theo tên hoặc MSSV" autoComplete="off" className={`${inputClass} pl-10`} />
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {shown.length ? `${shown.length} người` : "Không thấy ai khớp"}
      </p>
      <Card className="mt-3 overflow-hidden">
        {shown.length === 0 ? (
          <p className="px-6 py-12 text-center text-[15px] text-ink-soft">Không thấy ai khớp</p>
        ) : (
          <div role="table" aria-label="Danh sách điểm danh" className="text-[15px]">
            <div role="row" className={`hidden border-b border-line bg-canvas/60 py-3 text-[13px] font-medium text-ink-soft ${COLS}`}>
              <span role="columnheader">Họ tên</span>
              <span role="columnheader">MSSV</span>
              <span role="columnheader">Lớp</span>
              <span role="columnheader" className="hidden lg:block">
                Khoa
              </span>
              <span role="columnheader">Giờ vào</span>
              <span role="columnheader">Người quét</span>
            </div>
            <div role="rowgroup" className="divide-y divide-line">
              {shown.map((r) => (
                <div key={r.id} role="row" className={`grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-1.5 px-4 py-3.5 md:py-3 md:hover:bg-canvas/50 ${COLS}`}>
                  <span role="cell" className={`col-span-2 col-start-1 row-start-1 font-semibold break-words md:truncate md:font-medium ${RESET}`}>
                    {r.name}
                  </span>
                  <span role="cell" className={`col-start-1 row-start-2 mt-0.5 text-sm whitespace-nowrap text-ink-soft tabular-nums md:mt-0 md:text-[15px] ${RESET}`}>
                    {r.studentId && (
                      <>
                        <span className="md:hidden">MSSV </span>
                        {r.studentId}
                        {r.className && <span className="md:hidden"> ·</span>}
                      </>
                    )}
                  </span>
                  <span role="cell" className={`col-start-2 row-start-2 mt-0.5 truncate text-sm text-ink-soft md:mt-0 md:text-[15px] ${RESET}`}>
                    {r.className}
                  </span>
                  <span role="cell" className="hidden truncate text-ink-soft lg:block">
                    {r.faculty}
                  </span>
                  <span role="cell" className={`col-start-3 row-start-1 text-right font-semibold tabular-nums md:font-normal ${RESET} ${r.at ? "" : "hidden md:block"}`}>
                    {r.at ? <time dateTime={r.at}>{r.time}</time> : <span className="text-ink-mute">—</span>}
                  </span>
                  <span role="cell" className={`col-start-3 row-start-2 mt-0.5 max-w-36 truncate text-right text-sm text-ink-soft md:mt-0 md:max-w-none md:text-[15px] ${RESET}`}>
                    {r.at && (
                      <>
                        <span className="md:hidden">{r.by && "bởi "}</span>
                        {r.by ?? <span className="hidden md:inline">—</span>}
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
