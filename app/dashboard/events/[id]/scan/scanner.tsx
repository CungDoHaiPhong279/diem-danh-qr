"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { parseTicketToken, type CheckinOutcome } from "@/lib/checkin";
import { IN_APP_BROWSER } from "@/lib/constants";
import { formatTime } from "@/lib/format";
import { enqueue, flushQueue, loadQueue, remove, saveQueue, type QueuedScan } from "@/lib/scan-queue";
import { useQrScanner } from "@/components/use-qr-scanner";
import { Alert, Spinner, buttonClass } from "@/components/ui";
import { ArrowLeftIcon, CheckIcon, ChevronDownIcon, ClockIcon, ScanIcon, SearchIcon, XIcon } from "@/components/icons";
import { checkIn, searchTickets, type TicketHit } from "./actions";

type Shown = CheckinOutcome | { kind: "unreadable" } | { kind: "network"; name?: string };
type Tone = "ok" | "bad" | "wait";
type Entry = { id: string; at: string; shown: Shown };

const RESULT_MS = 2000;
const CHECKIN_TIMEOUT_MS = 8000;
const FLUSH_EVERY_MS = 10_000;
const HISTORY_SIZE = 10;
const FOCUS_DARK = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const TONE_BG: Record<Tone, string> = { ok: "bg-scan-ok", bad: "bg-scan-bad", wait: "bg-scan-wait" };
const TONE_DOT: Record<Tone, string> = { ok: "bg-brand-500", bad: "bg-red-500", wait: "bg-amber-500" };
const TONE_ICON: Record<Tone, typeof CheckIcon> = { ok: CheckIcon, bad: XIcon, wait: ClockIcon };
const INVALID_TEXT = { not_found: "Vé không hợp lệ", bad_qr: "Vé không hợp lệ", wrong_event: "Vé của sự kiện khác", cancelled: "Vé đã bị hủy" } as const;

/** label = short text for the history list. */
function describe(s: Shown): { tone: Tone; status: string; label: string; name?: string; detail?: string; sub?: string } {
  switch (s.kind) {
    case "ok":
      return { tone: "ok", status: "Mời vào", label: "Mời vào", name: s.name, detail: s.studentId ? `MSSV ${s.studentId}` : undefined };
    case "already":
      return {
        tone: "bad",
        status: "Đã điểm danh",
        label: "Đã điểm danh",
        name: s.name,
        detail: s.studentId ? `MSSV ${s.studentId}` : undefined,
        sub: `${s.checkedInAt ? `lúc ${formatTime(s.checkedInAt)}, ` : ""}bởi ${s.by}`,
      };
    case "invalid":
      return { tone: "bad", status: INVALID_TEXT[s.reason], label: INVALID_TEXT[s.reason] };
    case "forbidden":
      return { tone: "bad", status: "Bạn không còn quyền soát vé sự kiện này", label: "Không có quyền", sub: "Hãy đăng nhập lại hoặc xin ban tổ chức link mời mới" };
    case "unreadable":
      return { tone: "bad", status: "Mã không hợp lệ", label: "Mã không hợp lệ", sub: "Đây không phải mã vé của trang này" };
    case "network":
      return { tone: "wait", status: "Đã lưu, đang chờ mạng", label: "Đang chờ mạng", name: s.name };
  }
}

const noSubscribe = () => () => {};

// randomUUID only exists in secure contexts (not on plain-http LAN); getRandomValues exists everywhere.
function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([p, new Promise<never>((_, reject) => (t = setTimeout(() => reject(new Error("timeout")), ms)))]).finally(() => clearTimeout(t));
}

export function Scanner({ eventId, eventTitle, siteUrl }: { eventId: string; eventTitle: string; siteUrl: string }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const [pending, setPending] = useState(false);
  const [history, setHistory] = useState<Entry[]>([]);
  const busyRef = useRef(false); // a check-in is in flight or a result is on screen
  const [queued, setQueued] = useState(0);
  const flushingRef = useRef(false);
  const localOnlyRef = useRef<QueuedScan[]>([]); // scans localStorage refused to hold (blocked/quota): kept in memory only
  const sheetRef = useRef<HTMLDialogElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const inAppBrowser = useSyncExternalStore(noSubscribe, () => IN_APP_BROWSER.test(navigator.userAgent), () => false);

  const { videoRef, running, error, start, stop } = useQrScanner((raw) => {
    if (busyRef.current || sheetRef.current?.open) return false; // not taken: fires again when ready
    const token = parseTicketToken(raw, siteUrl);
    if (!token) {
      // No retry: a foreign code held in view would flash red every 2 s; last-seen dedupe silences it.
      busyRef.current = true;
      show({ kind: "unreadable" });
      return;
    }
    const scanId = newId();
    busyRef.current = true;
    void runCheckIn({ eventId, scanId, token, scannedAt: new Date().toISOString() });
  });

  const onFlush = useEffectEvent(() => void flush());
  useEffect(() => {
    onFlush();
    window.addEventListener("online", onFlush);
    return () => window.removeEventListener("online", onFlush);
  }, []);
  const hasQueued = queued > 0;
  useEffect(() => {
    if (!hasQueued) return;
    const t = setInterval(onFlush, FLUSH_EVERY_MS);
    const warn = (e: BeforeUnloadEvent) => e.preventDefault(); // browser shows its own "leave page?" prompt
    window.addEventListener("beforeunload", warn);
    return () => {
      clearInterval(t);
      window.removeEventListener("beforeunload", warn);
    };
  }, [hasQueued]);

  const onResultTimeout = useEffectEvent(() => closeResult());
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(onResultTimeout, RESULT_MS);
    return () => clearTimeout(t);
  }, [shown]);

  // Keep the screen on while the camera runs. The browser drops the lock when the tab hides, so re-acquire on return.
  useEffect(() => {
    if (!running) return;
    let lock: WakeLockSentinel | null = null;
    let done = false;
    const release = () => {
      lock?.release().catch(() => {});
      lock = null;
    };
    const acquire = async () => {
      release();
      try {
        const l = await navigator.wakeLock?.request("screen");
        if (done || document.visibilityState !== "visible") void l?.release().catch(() => {});
        else lock = l ?? null;
      } catch {}
    };
    const onVisibility = () => (document.visibilityState === "visible" ? void acquire() : release());
    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      done = true;
      document.removeEventListener("visibilitychange", onVisibility);
      release();
    };
  }, [running]);

  function show(s: Shown, id = newId()) {
    sheetRef.current?.close(); // a result must never sit under the top-layer dialog
    setPending(false);
    setShown(s);
    setHistory((h) => [{ id, at: new Date().toISOString(), shown: s }, ...h].slice(0, HISTORY_SIZE));
    const tone = describe(s).tone;
    try {
      if (tone !== "wait") navigator.vibrate?.(tone === "ok" ? 60 : [80, 60, 80]);
    } catch {}
  }

  function closeResult() {
    setShown(null);
    busyRef.current = false;
    searchButtonRef.current?.focus({ preventScroll: true });
  }

  async function runCheckIn(input: QueuedScan, name?: string) {
    setPending(true);
    let outcome: CheckinOutcome;
    try {
      outcome = await withTimeout(checkIn(input), CHECKIN_TIMEOUT_MS);
    } catch {
      handleCheckinError(input, name);
      return;
    }
    show(outcome);
    void flush(); // the network is evidently back
  }

  // checkIn threw or timed out (network/infra): keep the scan to re-send with the same scanId.
  // No re-read of the code: a new scanId for the same person would only duplicate the queued one.
  function handleCheckinError(input: QueuedScan, name?: string) {
    writeQueue(enqueue(readQueue(), input));
    show({ kind: "network", name }, input.scanId);
  }

  // shortcut: tabs don't coordinate; re-reading storage before each flush/change keeps another tab's
  // sends from being re-sent forever (replays are idempotent anyway). Upgrade to Web Locks if multi-tab scanning matters.
  function readQueue(): QueuedScan[] {
    return localOnlyRef.current.reduce(enqueue, loadQueue(eventId));
  }

  function writeQueue(q: QueuedScan[]) {
    saveQueue(eventId, q);
    const stored = loadQueue(eventId);
    localOnlyRef.current = q.filter((s) => !stored.some((x) => x.scanId === s.scanId));
    setQueued(q.length);
  }

  async function flush() {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      const q = readQueue();
      setQueued(q.length);
      await flushQueue(q, async (s) => {
        const outcome = await withTimeout(checkIn({ ...s, eventId }), CHECKIN_TIMEOUT_MS);
        writeQueue(remove(readQueue(), s.scanId));
        // History only, no overlay: the checker may already be scanning someone else.
        setHistory((h) =>
          h.some((e) => e.id === s.scanId)
            ? h.map((e) => (e.id === s.scanId ? { ...e, shown: outcome } : e))
            : [{ id: s.scanId, at: s.scannedAt, shown: outcome }, ...h].slice(0, HISTORY_SIZE),
        );
      });
    } finally {
      flushingRef.current = false;
    }
  }

  function manualCheckIn(ticketId: string, name: string) {
    if (busyRef.current) return; // buttons are disabled while pending; this guards a double tap
    const scanId = newId();
    busyRef.current = true;
    sheetRef.current?.close();
    void runCheckIn({ eventId, scanId, ticketId, scannedAt: new Date().toISOString() }, name);
  }

  const d = shown && describe(shown);

  return (
    <div className="fixed inset-0 z-30 flex flex-col overflow-y-auto bg-scan-bg text-white [color-scheme:dark]">
      <header className="sticky top-0 z-10 bg-scan-panel">
        <div className="mx-auto flex h-[52px] w-full max-w-[480px] items-center gap-1 px-2">
          <Link href={`/dashboard/events/${eventId}`} aria-label="Quay lại trang sự kiện" className={`grid size-11 shrink-0 place-items-center rounded-xl hover:bg-white/10 ${FOCUS_DARK}`}>
            <ArrowLeftIcon width={22} height={22} />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{eventTitle}</h1>
          <PendingBadge count={queued} />
          {running && (
            <button type="button" onClick={stop} className={`h-11 shrink-0 rounded-xl px-3 text-sm font-semibold text-white/90 hover:bg-white/10 ${FOCUS_DARK}`}>
              Tắt camera
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {inAppBrowser && !running && (
          <div className="mb-3">
            <Alert tone="warning">Bạn đang mở trong Zalo/Messenger nên camera có thể bị chặn. Hãy mở link này bằng Safari hoặc Chrome.</Alert>
          </div>
        )}

        {/* dvh cap keeps the search button on screen on short, wide screens */}
        <div className="relative mx-auto aspect-square w-full max-w-[min(100%,52dvh)] overflow-hidden rounded-3xl bg-black/50 ring-1 ring-white/10">
          <video ref={videoRef} playsInline muted autoPlay className={`h-full w-full object-cover ${running ? "" : "invisible"}`} />
          <Corners />
          {!running && (
            <div className="absolute inset-0 grid place-items-center p-6">
              <button
                type="button"
                onClick={start}
                className={`inline-flex h-14 items-center gap-2.5 rounded-2xl bg-white px-7 text-[17px] font-semibold text-ink shadow-lg shadow-black/30 hover:bg-stone-100 active:bg-stone-200 ${FOCUS_DARK}`}
              >
                <ScanIcon width={22} height={22} />
                Bắt đầu quét
              </button>
            </div>
          )}
          {pending && (
            <div className="absolute inset-0 grid place-items-center bg-black/55">
              <span className="inline-flex items-center gap-2.5 rounded-full bg-scan-panel px-4 py-2.5 text-[15px] font-medium">
                <Spinner /> Đang kiểm tra…
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3">
            <Alert>{error}</Alert>
          </div>
        )}
        <p className="mt-3 text-center text-[15px] text-white/75">{running ? "Đưa mã QR vào khung" : "Bấm “Bắt đầu quét” rồi cho phép dùng camera"}</p>
        {!running && <p className="mt-1 text-center text-[13px] text-white/60">Mở bằng Safari/Chrome, không mở trong Zalo</p>}

        <div className="mt-auto space-y-3 pt-8">
          <button
            ref={searchButtonRef}
            type="button"
            onClick={() => sheetRef.current?.showModal()}
            className={`flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-white/10 text-[17px] font-semibold ring-1 ring-white/15 hover:bg-white/15 active:bg-white/20 ${FOCUS_DARK}`}
          >
            <SearchIcon width={22} height={22} />
            Tìm theo tên / MSSV
          </button>
          <History entries={history} />
        </div>
      </main>

      <p role="status" aria-live="assertive" className="sr-only">
        {d ? [d.status, d.name, d.sub].filter(Boolean).join(". ") : ""}
      </p>
      {d && <ResultOverlay d={d} onClose={closeResult} />}
      <SearchSheet sheetRef={sheetRef} eventId={eventId} busy={pending} onPick={manualCheckIn} />
    </div>
  );
}

/** Offline-queue badge. The live region stays mounted so count changes are announced; empty while n = 0. */
function PendingBadge({ count }: { count: number }) {
  return (
    <span role="status" className="contents">
      {count > 0 && (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-scan-wait px-2.5 py-1 text-sm font-semibold">
          <ClockIcon width={16} height={16} /> Đang chờ ({count})
        </span>
      )}
    </span>
  );
}

function Corners() {
  const c = "absolute size-11 border-white";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-[13%]">
      <span className={`${c} top-0 left-0 rounded-tl-2xl border-t-4 border-l-4`} />
      <span className={`${c} top-0 right-0 rounded-tr-2xl border-t-4 border-r-4`} />
      <span className={`${c} bottom-0 left-0 rounded-bl-2xl border-b-4 border-l-4`} />
      <span className={`${c} right-0 bottom-0 rounded-br-2xl border-r-4 border-b-4`} />
    </div>
  );
}

function ResultOverlay({ d, onClose }: { d: ReturnType<typeof describe>; onClose: () => void }) {
  const Icon = TONE_ICON[d.tone];
  return (
    // Whole screen is the close target; the live region above carries the text for screen readers.
    <button
      type="button"
      autoFocus
      onClick={onClose}
      aria-label="Đóng kết quả, quét tiếp"
      className={`fixed inset-0 z-50 flex w-full cursor-default flex-col justify-center text-left text-white outline-none motion-safe:animate-fade-in ${TONE_BG[d.tone]}`}
    >
      <div aria-hidden className="mx-auto w-full max-w-[480px] px-6">
        <span className="grid size-16 place-items-center rounded-full bg-white/15">
          <Icon width={48} height={48} strokeWidth={2.4} />
        </span>
        {d.name ? (
          <>
            <p className="mt-5 text-xl font-semibold">{d.status}</p>
            <p className="mt-2 line-clamp-3 text-[40px] leading-[1.1] font-bold text-balance break-words">{d.name}</p>
            {d.detail && <p className="mt-3 text-[17px] font-medium text-white/90">{d.detail}</p>}
          </>
        ) : (
          <p className="mt-5 text-[32px] leading-tight font-bold text-balance">{d.status}</p>
        )}
        {d.sub && <p className="mt-2 text-[17px] font-medium text-white/90">{d.sub}</p>}
      </div>
      <p aria-hidden className="absolute inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-[15px] text-white/90">
        Chạm để quét tiếp
      </p>
    </button>
  );
}

function History({ entries }: { entries: Entry[] }) {
  return (
    <details className="group rounded-2xl bg-scan-panel">
      <summary className={`flex h-12 cursor-pointer list-none items-center justify-between rounded-2xl px-4 text-[15px] font-medium [&::-webkit-details-marker]:hidden ${FOCUS_DARK}`}>
        Lần quét gần đây ({entries.length})
        <ChevronDownIcon className="text-white/70 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      {entries.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-white/65">Chưa có lượt quét nào.</p>
      ) : (
        <ol className="divide-y divide-white/10 px-4 pb-1">
          {entries.map((e) => {
            const d = describe(e.shown);
            return (
              <li key={e.id} className="flex items-center gap-3 py-3 text-[15px]">
                <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${TONE_DOT[d.tone]}`} />
                <span className="shrink-0 font-medium">{d.label}</span>
                <span className="min-w-0 flex-1 truncate text-white/70">{d.name}</span>
                <time dateTime={e.at} className="shrink-0 text-white/65 tabular-nums">
                  {formatTime(e.at)}
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </details>
  );
}

function SearchSheet({ sheetRef, eventId, busy, onPick }: { sheetRef: RefObject<HTMLDialogElement | null>; eventId: string; busy: boolean; onPick: (ticketId: string, name: string) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<TicketHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const seq = useRef(0); // only the latest query may set results

  useEffect(() => () => clearTimeout(timer.current), []);

  function onChange(v: string) {
    setQ(v);
    clearTimeout(timer.current);
    const n = ++seq.current;
    if (v.trim().length < 2) {
      setHits(null);
      setLoading(false);
      setFailed(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      try {
        const r = await searchTickets(eventId, v);
        if (n === seq.current) setHits(r);
      } catch {
        if (n === seq.current) setFailed(true);
      } finally {
        if (n === seq.current) setLoading(false);
      }
    }, 300);
  }

  const short = q.trim().length < 2;
  const NO_MATCH = "Không thấy ai khớp. Thử MSSV hoặc tên không dấu.";
  // Announced politely; the list itself is not a live region.
  const statusText = failed || short ? "" : busy ? "Đang kiểm tra lượt trước…" : !hits ? "Đang tìm…" : hits.length ? `${hits.length} kết quả` : NO_MATCH;
  return (
    <dialog
      ref={sheetRef}
      aria-labelledby="search-title"
      onClose={() => onChange("")}
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      className="inset-x-0 top-auto bottom-0 mx-auto h-[85dvh] max-h-none w-full max-w-[480px] rounded-t-3xl bg-surface p-0 text-ink backdrop:bg-black/60 open:flex open:flex-col motion-safe:open:animate-fade-in"
    >
      <div className="flex items-center gap-2 py-3 pr-2 pl-5">
        <h2 id="search-title" className="flex-1 text-lg font-semibold">
          Tìm theo tên / MSSV
        </h2>
        {loading && hits && (
          <span className="text-ink-mute">
            <Spinner />
          </span>
        )}
        <button
          type="button"
          onClick={() => sheetRef.current?.close()}
          aria-label="Đóng"
          className="grid size-11 place-items-center rounded-xl text-ink-soft hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          <XIcon width={22} height={22} />
        </button>
      </div>
      <div className="relative px-4">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-7.5 -translate-y-1/2 text-ink-mute" />
        <input
          autoFocus
          type="search"
          value={q}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Họ tên hoặc MSSV"
          placeholder="Nhập họ tên hoặc MSSV"
          autoComplete="off"
          enterKeyHint="search"
          // 16px: smaller makes iOS zoom in on focus
          className="block h-12 w-full rounded-xl border border-line bg-canvas pr-3.5 pl-11 text-base text-ink placeholder:text-ink-mute focus:border-brand-500 focus:bg-surface focus:ring-4 focus:ring-brand-100 focus:outline-none"
        />
      </div>
      <p aria-live="polite" className="sr-only">
        {statusText}
      </p>
      {busy && (
        <p className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-canvas px-3.5 py-2.5 text-sm text-ink-soft">
          <Spinner /> Đang kiểm tra lượt trước, chờ một chút…
        </p>
      )}
      <div className="mt-2 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {failed ? (
          <div className="mt-2">
            <Alert>Không tìm được, kiểm tra mạng rồi thử lại</Alert>
          </div>
        ) : short ? (
          <p className="px-1 py-6 text-center text-sm text-ink-mute">Gõ ít nhất 2 ký tự của họ tên hoặc MSSV.</p>
        ) : !hits ? (
          <p className="flex items-center justify-center gap-2 py-6 text-sm text-ink-mute">
            <Spinner /> Đang tìm…
          </p>
        ) : hits.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-ink-soft">{NO_MATCH}</p>
        ) : (
          <ul className="divide-y divide-line">
            {hits.map((h) => {
              const meta = [h.studentId && `MSSV ${h.studentId}`, h.className && `lớp ${h.className}`].filter(Boolean).join(", ");
              return (
                <li key={h.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold break-words">{h.name}</p>
                    {meta && <p className="mt-0.5 text-sm text-ink-soft">{meta}</p>}
                  </div>
                  {h.checkedInAt ? (
                    <span className="shrink-0 text-sm text-ink-mute">Đã vào {formatTime(h.checkedInAt)}</span>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => onPick(h.id, h.name)} className={buttonClass("primary", "md", "shrink-0")}>
                      {busy ? "Đang kiểm tra…" : "Điểm danh"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </dialog>
  );
}
