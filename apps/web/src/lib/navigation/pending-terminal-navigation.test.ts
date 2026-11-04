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
});

describe("isTerminalNavigationPending", () => {
  it("false bila tidak ada navigasi yang ditandai", () => {
    expect(isTerminalNavigationPending("/publish/queue", 0)).toBe(false);
  });

  it("true selama belum sampai di tujuan dan belum lewat batas waktu", () => {
    markTerminalNavigationPending("/publish/drafts", 1_000);
    expect(isTerminalNavigationPending("/publish/queue", 1_001)).toBe(true);
  });

  it("false begitu path saat ini sama dengan tujuan", () => {
    markTerminalNavigationPending("/publish/drafts", 1_000);
    expect(isTerminalNavigationPending("/publish/drafts", 1_001)).toBe(false);
    expect(isTerminalNavigationPending("/publish/queue", 1_002)).toBe(false);
  });

  it("false tepat di batas waktu", () => {
    markTerminalNavigationPending("/publish/drafts", 1_000);
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
});
