import { afterEach, describe, expect, test, vi } from "vitest";
import { enqueue, flushQueue, keepOnReplay, loadQueue, remove, saveQueue, upsertEntry, type QueuedScan } from "@/lib/scan-queue";

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

  test("keepOnReplay: only forbidden keeps the item (re-login replays it); other outcomes remove it", () => {
    expect(keepOnReplay({ kind: "forbidden" })).toBe(true);
    expect(keepOnReplay({ kind: "ok", name: "A", studentId: null, checkedInAt: "" })).toBe(false);
    expect(keepOnReplay({ kind: "already", name: "A", studentId: null, checkedInAt: "", by: "B" })).toBe(false);
    expect(keepOnReplay({ kind: "invalid", reason: "cancelled" })).toBe(false);
  });

  test("upsertEntry updates in place, keeping position and time", () => {
    const h = [
      { id: "b", at: "2026-11-19T10:00:00.000Z", v: 1 },
      { id: "a", at: "2026-11-19T09:00:00.000Z", v: 1 },
    ];
    expect(upsertEntry(h, { id: "a", at: "2026-11-19T11:00:00.000Z", v: 2 }, 10)).toEqual([h[0], { id: "a", at: "2026-11-19T09:00:00.000Z", v: 2 }]);
  });

  test("upsertEntry inserts a new entry by time, newest first, capped", () => {
    const h = [
      { id: "c", at: "2026-11-19T12:00:00.000Z" },
      { id: "a", at: "2026-11-19T09:00:00.000Z" },
    ];
    expect(upsertEntry(h, { id: "b", at: "2026-11-19T10:00:00.000Z" }, 10).map((e) => e.id)).toEqual(["c", "b", "a"]);
    expect(upsertEntry(h, { id: "z", at: "2026-11-18T00:00:00.000Z" }, 2).map((e) => e.id)).toEqual(["c", "a"]);
  });
});
