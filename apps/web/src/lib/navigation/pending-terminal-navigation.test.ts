import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TERMINAL_NAVIGATION_TIMEOUT_MS,
  createPendingNavigationGate,
  isTerminalNavigationPending,
  markTerminalNavigationPending,
  resetTerminalNavigationForTests,
} from "./pending-terminal-navigation";

afterEach(() => {
  resetTerminalNavigationForTests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("isTerminalNavigationPending", () => {
  it("false bila tidak ada navigasi yang ditandai", () => {
    expect(isTerminalNavigationPending("/publish/queue", 0)).toBe(false);
  });

  it("true selama layar asal masih tampil dan belum lewat batas waktu", () => {
    markTerminalNavigationPending({ now: 1_000, origin: "/publish/queue" });
    expect(isTerminalNavigationPending("/publish/queue", 1_001)).toBe(true);
  });

  it("false begitu path berubah dari layar asal, dan tetap false sesudahnya", () => {
    markTerminalNavigationPending({ now: 1_000, origin: "/publish/queue" });
    expect(isTerminalNavigationPending("/publish/drafts", 1_001)).toBe(false);
    // Pemakai kembali ke layar asal: penanda sudah dibersihkan, tidak basi.
    expect(isTerminalNavigationPending("/publish/queue", 1_002)).toBe(false);
  });

  it("flag basi tidak menahan layar lain yang dibuka sebelum batas waktu", () => {
    markTerminalNavigationPending({ now: 1_000, origin: "/publish/queue" });
    expect(isTerminalNavigationPending("/publish/calendar", 2_000)).toBe(false);
  });

  it("false tepat di batas waktu", () => {
    markTerminalNavigationPending({ now: 1_000, origin: "/publish/queue" });
    expect(
      isTerminalNavigationPending(
        "/publish/queue",
        1_000 + TERMINAL_NAVIGATION_TIMEOUT_MS - 1,
      ),
    ).toBe(true);
    expect(
      isTerminalNavigationPending(
        "/publish/queue",
        1_000 + TERMINAL_NAVIGATION_TIMEOUT_MS,
      ),
    ).toBe(false);
  });

  it("origin bawaan memakai path jendela saat ini", () => {
    vi.stubGlobal("window", { location: { pathname: "/publish/calendar" } });
    markTerminalNavigationPending({ now: 1_000 });
    expect(isTerminalNavigationPending(undefined, 1_001)).toBe(true);
    vi.stubGlobal("window", { location: { pathname: "/publish/drafts" } });
    expect(isTerminalNavigationPending(undefined, 1_002)).toBe(false);
  });
});

describe("createPendingNavigationGate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("menjalankan tugas langsung bila tidak ada navigasi tertunda", () => {
    const gate = createPendingNavigationGate({ isPending: () => false });
    const task = vi.fn();
    gate.run("a", task);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("menahan tugas selama tertunda lalu menjalankannya setelah selesai", () => {
    let pendingNow = true;
    const gate = createPendingNavigationGate({
      isPending: () => pendingNow,
      pollMs: 100,
    });
    const task = vi.fn();
    gate.run("a", task);
    vi.advanceTimersByTime(300);
    expect(task).not.toHaveBeenCalled();
    pendingNow = false;
    vi.advanceTimersByTime(100);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("kunci sama: hanya tugas terakhir yang jalan; urutan kunci terjaga", () => {
    let pendingNow = true;
    const order: string[] = [];
    const gate = createPendingNavigationGate({
      isPending: () => pendingNow,
      pollMs: 100,
    });
    gate.run("a", () => order.push("a1"));
    gate.run("b", () => order.push("b1"));
    gate.run("a", () => order.push("a2"));
    pendingNow = false;
    vi.advanceTimersByTime(100);
    expect(order).toEqual(["a2", "b1"]);
  });

  it("tugas baru ikut antre di belakang yang tertahan walau sudah tidak tertunda", () => {
    let pendingNow = true;
    const order: string[] = [];
    const gate = createPendingNavigationGate({
      isPending: () => pendingNow,
      pollMs: 100,
    });
    gate.run("a", () => order.push("a"));
    pendingNow = false;
    gate.run("b", () => order.push("b"));
    expect(order).toEqual([]);
    vi.advanceTimersByTime(100);
    expect(order).toEqual(["a", "b"]);
  });

  it("dispose membuang tugas tertahan dan menolak tugas baru", () => {
    let pendingNow = true;
    const gate = createPendingNavigationGate({
      isPending: () => pendingNow,
      pollMs: 100,
    });
    const task = vi.fn();
    gate.run("a", task);
    gate.dispose();
    pendingNow = false;
    vi.advanceTimersByTime(1_000);
    gate.run("b", task);
    expect(task).not.toHaveBeenCalled();
  });

  it("jalur bawaan: menahan selama layar asal tampil, melepas setelah pindah", () => {
    vi.stubGlobal("window", { location: { pathname: "/publish/queue" } });
    markTerminalNavigationPending();
    const gate = createPendingNavigationGate({ pollMs: 100 });
    const task = vi.fn();
    gate.run("a", task);
    vi.advanceTimersByTime(200);
    expect(task).not.toHaveBeenCalled();
    vi.stubGlobal("window", { location: { pathname: "/publish/drafts" } });
    vi.advanceTimersByTime(100);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("tugas yang melempar error tidak menghilangkan tugas tertahan lain", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    let pendingNow = true;
    const gate = createPendingNavigationGate({
      isPending: () => pendingNow,
      pollMs: 100,
    });
    const after = vi.fn();
    gate.run("a", () => {
      throw new Error("gagal");
    });
    gate.run("b", after);
    pendingNow = false;
    vi.advanceTimersByTime(100);
    expect(after).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});
