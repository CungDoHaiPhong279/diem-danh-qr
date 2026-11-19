"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BarcodeDetector, prepareZXingModule } from "barcode-detector/ponyfill";

export const DEDUPE_MS = 2500;

export type ScanMeta = { detectMs: number; sinceStartMs: number };

// Must run before the first detect; otherwise the wasm is fetched from cdn.jsdelivr.net.
prepareZXingModule({
  overrides: {
    locateFile: (path, prefix) => (path.endsWith(".wasm") ? `/zxing/${path}` : prefix + path),
  },
});

/**
 * "Last seen" dedupe: a code held in front of the camera keeps refreshing its timestamp and never fires again.
 * Returns true when `raw` was seen within DEDUPE_MS (and refreshes it).
 */
export function seenRecently(lastSeen: Map<string, number>, raw: string, now: number): boolean {
  const prev = lastSeen.get(raw);
  if (prev === undefined || now - prev >= DEDUPE_MS) return false;
  lastSeen.set(raw, now);
  return true;
}

/**
 * Camera + zxing loop. `onCode` returning `false` means "not taken" (e.g. busy): the code is not marked seen,
 * so it fires again on the next frame once the caller is ready.
 */
export function useQrScanner(onCode: (raw: string, meta: ScanMeta) => boolean | void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runRef = useRef(0); // bumped on stop so an old loop exits
  const onCodeRef = useRef(onCode);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onCodeRef.current = onCode;
  });

  const stop = useCallback(() => {
    runRef.current++;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setRunning(false);
  }, []);

  useEffect(() => stop, [stop]);

  const loop = useCallback(
    async (run: number, video: HTMLVideoElement, startedAt: number) => {
      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      const lastSeen = new Map<string, number>();
      // Sequential awaits: detect calls never overlap.
      while (run === runRef.current) {
        if (video.readyState >= 2) {
          const t0 = performance.now();
          try {
            const codes = await detector.detect(video);
            if (run !== runRef.current) return;
            const now = performance.now();
            for (const { rawValue } of codes) {
              if (seenRecently(lastSeen, rawValue, now)) continue;
              const taken = onCodeRef.current(rawValue, { detectMs: Math.round(now - t0), sinceStartMs: Math.round(now - startedAt) });
              if (taken !== false) lastSeen.set(rawValue, now);
            }
          } catch (e) {
            if (run !== runRef.current) return;
            setError(`Lỗi giải mã: ${e instanceof Error ? e.message : String(e)}`);
            stop();
            return;
          }
        }
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
    },
    [stop],
  );

  const start = useCallback(async () => {
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
    setRunning(true); // show "Dừng" during the permission prompt; blocks a second start
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
      void loop(run, video, performance.now());
    } catch (e) {
      if (run !== runRef.current) return; // stopped meanwhile
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
  }, [loop, stop]);

  return { videoRef, running, error, start, stop };
}
