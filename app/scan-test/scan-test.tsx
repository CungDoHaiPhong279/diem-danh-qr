"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui";
import { useQrScanner } from "@/components/use-qr-scanner";

type Result = { text: string; detectMs: number; sinceStartMs: number; isTicket: boolean };

const MAX_RESULTS = 10;
const TICKET_PATH = /^\/t\/[0-9a-f]{32}$/;

function looksLikeTicket(text: string) {
  try {
    return TICKET_PATH.test(new URL(text).pathname);
  } catch {
    return false;
  }
}

export function ScanTest() {
  const [results, setResults] = useState<Result[]>([]);
  const { videoRef, running, error, start, stop } = useQrScanner((text, { detectMs, sinceStartMs }) => {
    const r: Result = { text, detectMs, sinceStartMs, isTicket: looksLikeTicket(text) };
    setResults((prev) => [r, ...prev].slice(0, MAX_RESULTS));
  });
  const native = useSyncExternalStore(
    () => () => {},
    () => "BarcodeDetector" in window,
    () => null,
  );

  return (
    <div className="mt-4 space-y-4">
      <div className="aspect-square overflow-hidden rounded-xl border border-line bg-ink/90">
        <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" />
      </div>
      {running ? (
        <Button variant="secondary" onClick={stop}>
          Dừng
        </Button>
      ) : (
        <Button onClick={start}>Bắt đầu quét</Button>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-line bg-surface p-3 text-sm text-ink">
          {error}
        </p>
      )}
      <p className="text-xs text-ink-mute">
        Máy quét dùng zxing (cùng một bộ giải mã trên mọi máy). BarcodeDetector có sẵn của trình duyệt:{" "}
        {native === null ? "đang kiểm tra" : native ? "có" : "không có"} (chỉ để tham khảo).
      </p>
      <p className="text-xs text-ink-mute">
        &quot;Giải mã&quot; = thời gian một lần gọi detect. &quot;Từ lúc bấm&quot; = từ lúc camera bật sau khi bấm
        &quot;Bắt đầu quét&quot; đến lúc thấy mã. Giữ một mã trước camera chỉ ghi một lần; mã phải rời khung 2,5 giây mới ghi lại.
      </p>
      <ul className="space-y-2">
        {results.map((r, i) => (
          <li key={`${i}-${r.sinceStartMs}`} className="rounded-lg border border-line bg-surface p-3 text-sm">
            <p className="break-all font-mono text-xs">{r.text}</p>
            <p className="mt-1 text-ink-soft">
              {r.isTicket ? "Giống link vé (/t/ + 32 ký tự hex)" : "Không phải link vé"} · giải mã {r.detectMs} ms ·
              từ lúc bấm {r.sinceStartMs} ms
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
