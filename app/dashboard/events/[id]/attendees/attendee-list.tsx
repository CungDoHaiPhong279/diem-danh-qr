"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { foldText } from "@/lib/format";
import { Card, inputClass } from "@/components/ui";
import { SearchIcon } from "@/components/icons";

/** `time` is formatted on the server so hydration never sees a different locale/timezone. */
export type Attendee = { id: string; name: string; studentId: string | null; className: string | null; faculty: string | null; at: string | null; time: string | null; by: string | null };

type Tab = "in" | "out" | "all";

export function AttendeeList({ rows, eventHref }: { rows: Attendee[]; eventHref: string }) {
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

  const inCount = rows.filter((r) => r.at).length;
  const tabs: [Tab, string][] = [
    ["in", `Đã vào (${inCount})`],
    ["out", `Chưa đến (${rows.length - inCount})`],
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
          <>
            <table className="hidden w-full table-fixed text-left text-[15px] md:table">
              <thead className="border-b border-line bg-canvas/60 text-[13px] text-ink-soft">
                <tr>
                  <th className="w-[30%] px-5 py-3 font-medium">Họ tên</th>
                  <th className="w-[14%] px-3 py-3 font-medium">MSSV</th>
                  <th className="w-[14%] px-3 py-3 font-medium">Lớp</th>
                  <th className="hidden w-[14%] px-3 py-3 font-medium lg:table-cell">Khoa</th>
                  <th className="w-[11%] px-3 py-3 font-medium">Giờ vào</th>
                  <th className="px-3 py-3 pr-5 font-medium">Người quét</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((r) => (
                  <tr key={r.id} className="hover:bg-canvas/50">
                    <td className="truncate px-5 py-3 font-medium">{r.name}</td>
                    <td className="truncate px-3 py-3 text-ink-soft tabular-nums">{r.studentId}</td>
                    <td className="truncate px-3 py-3 text-ink-soft">{r.className}</td>
                    <td className="hidden truncate px-3 py-3 text-ink-soft lg:table-cell">{r.faculty}</td>
                    <td className="px-3 py-3 tabular-nums">{r.at ? <time dateTime={r.at}>{r.time}</time> : <span className="text-ink-mute">—</span>}</td>
                    <td className="truncate px-3 py-3 pr-5 text-ink-soft">{r.at ? (r.by ?? "—") : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-line md:hidden">
              {shown.map((r) => (
                <li key={r.id} className="flex gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold break-words">{r.name}</p>
                    <p className="mt-0.5 text-sm text-ink-soft tabular-nums">{[r.studentId && `MSSV ${r.studentId}`, r.className].filter(Boolean).join(" · ")}</p>
                  </div>
                  {r.at && (
                    <div className="max-w-[40%] shrink-0 text-right">
                      <time dateTime={r.at} className="font-semibold tabular-nums">
                        {r.time}
                      </time>
                      {r.by && <p className="mt-0.5 truncate text-sm text-ink-soft">bởi {r.by}</p>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}
