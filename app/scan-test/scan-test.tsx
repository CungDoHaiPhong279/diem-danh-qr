"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BarcodeDetector, prepareZXingModule } from "barcode-detector/ponyfill";
import { Button } from "@/components/ui";

type Result = { text: string; detectMs: number; sinceStartMs: number; isTicket: boolean };

const DEDUPE_MS = 2500;
const MAX_RESULTS = 10;
const TICKET_PATH = /^\/t\/[0-9a-f]{32}$/;

function looksLikeTicket(text: string) {
  try {
    return TICKET_PATH.test(new URL(text).pathname);
  } catch {
    return false;
  }
}

// Must run before the first detect; otherwise the wasm is fetched from cdn.jsdelivr.net.
prepareZXingModule({
  overrides: {
    locateFile: (path, prefix) => (path.endsWith(".wasm") ? `/zxing/${path}` : prefix + path),
  },
});

export function ScanTest() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runRef = useRef(0); // bumped on stop so an old loop exits
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const native = useSyncExternalStore(
    () => () => {},
    () => "BarcodeDetector" in window,
    () => null,
  );

  useEffect(() => {
    return stop;
  }, []);

  function stop() {
    runRef.current++;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setRunning(false);
  }

  async function start() {
    setError(null);
    if (!window.isSecureContext) {
      setError("Trang không chạy trên HTTPS nên trình duyệt chặn camera. Hãy mở bằng link https://.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "Trình duyệt này không cho dùng camera (thường gặp khi mở link trong Zalo, Facebook, Messenger). Hãy mở link bằng Safari hoặc Chrome.",
      );
      return;
    }
    const run = ++runRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      if (run !== runRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setRunning(true);
      void loop(run, video, performance.now());
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Bạn chưa cho phép dùng camera. Hãy bật quyền camera cho trang này trong cài đặt trình duyệt rồi thử lại."
          : name === "NotFoundError" || name === "OverconstrainedError"
            ? "Không tìm thấy camera trên thiết bị này."
            : name === "NotReadableError"
              ? "Camera đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng đó rồi thử lại."
              : `Không bật được camera (${name || "lỗi không rõ"}).`,
      );
      stop();
    }
  }

  async function loop(run: number, video: HTMLVideoElement, startedAt: number) {
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    const lastSeen = new Map<string, number>();
    // Sequential awaits: detect calls never overlap.
    while (run === runRef.current) {
      if (video.readyState >= 2) {
        const t0 = performance.now();
        try {
          const codes = await detector.detect(video);
          const now = performance.now();
          for (const { rawValue } of codes) {
            if (now - (lastSeen.get(rawValue) ?? -Infinity) < DEDUPE_MS) continue;
            lastSeen.set(rawValue, now);
            const r: Result = {
              text: rawValue,
              detectMs: Math.round(now - t0),
              sinceStartMs: Math.round(now - startedAt),
              isTicket: looksLikeTicket(rawValue),
            };
            setResults((prev) => [r, ...prev].slice(0, MAX_RESULTS));
          }
        } catch (e) {
          setError(`Lỗi giải mã: ${e instanceof Error ? e.message : String(e)}`);
          stop();
          return;
        }
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }

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
        &quot;Bắt đầu quét&quot; đến lúc thấy mã. Cùng một mã trong 2,5 giây chỉ ghi một lần.
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
