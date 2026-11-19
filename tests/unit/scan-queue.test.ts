import { afterEach, describe, expect, test, vi } from "vitest";
import { enqueue, flushQueue, loadQueue, remove, saveQueue, type QueuedScan } from "@/lib/scan-queue";

const scan = (n: number): QueuedScan => ({ scanId: `s${n}`, eventId: "e", ticketId: `t${n}`, scannedAt: `2026-11-19T00:00:0${n}.000Z` });

describe("scan queue", () => {
  afterEach(() => vi.unstubAllGlobals());

  test("enqueue ignores a scanId already queued and keeps order", () => {
    let q = enqueue([], scan(1));
    q = enqueue(q, scan(2));
    q = enqueue(q, scan(1));
    expect(q.map((s) => s.scanId)).toEqual(["s1", "s2"]);
  });

  test("remove drops only that scanId", () => {
    expect(remove([scan(1), scan(2)], "s1")).toEqual([scan(2)]);
  });

  test("flushQueue stops at the first throw; the rest count as failed and are never sent", async () => {
    const send = vi.fn(async (s: QueuedScan) => {
      if (s.scanId === "s2") throw new Error("offline");
      return { kind: "ok" };
    });
    const r = await flushQueue([scan(1), scan(2), scan(3)], send);
    expect(r).toEqual({ sent: ["s1"], failed: ["s2", "s3"] });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls.map(([s]) => s.scanId)).toEqual(["s1", "s2"]);
  });

  test("loadQueue returns [] when localStorage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
    });
    expect(loadQueue("e")).toEqual([]);
  });

  test("saveQueue then loadQueue round-trips under scan-queue:<eventId>; save errors are swallowed", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
    saveQueue("e", [scan(1)]);
    expect([...store.keys()]).toEqual(["scan-queue:e"]);
    expect(loadQueue("e")).toEqual([scan(1)]);
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(() => saveQueue("e", [scan(1)])).not.toThrow();
  });
});
