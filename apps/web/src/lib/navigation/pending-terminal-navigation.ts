/**
 * T-208 (KI-108, ADR-054) — navigasi pascaaksi terminal Draft Editor tidak
 * boleh berebut dengan server action milik Realtime di layar asal.
 *
 * Gejala: dari `/publish/queue`, Save as Draft memanggil `router.push` ke
 * `/publish/drafts`, lalu event Realtime INSERT milik draft itu memicu server
 * action `getQueuePostAction` saat navigasi masih berjalan. Navigasi tidak
 * pernah selesai dan pemakai tertinggal di layar asal. Selama navigasi
 * tertunda, layar asal akan di-unmount bila navigasinya berhasil, jadi event
 * Realtime di jendela itu tidak perlu diproses; bila navigasi gagal, event
 * diproses setelah batas waktu supaya layar tidak basi.
 */

/** Batas atas menunggu navigasi sebelum dianggap gagal. */
export const TERMINAL_NAVIGATION_TIMEOUT_MS = 8_000;

interface PendingNavigation {
  destination: string;
  deadline: number;
}

let pending: PendingNavigation | null = null;

export function markTerminalNavigationPending(
  destination: string,
  now: number = Date.now(),
): void {
  pending = { destination, deadline: now + TERMINAL_NAVIGATION_TIMEOUT_MS };
}

/**
 * `true` selama navigasi terminal belum sampai di tujuan dan belum lewat
 * batas waktu. `currentPath` dan `now` bisa disuntikkan untuk tes.
 */
export function isTerminalNavigationPending(
  currentPath: string = typeof window === "undefined"
    ? ""
    : window.location.pathname,
  now: number = Date.now(),
): boolean {
  if (!pending) return false;
  if (now >= pending.deadline || currentPath === pending.destination) {
    pending = null;
    return false;
  }
  return true;
}

export function resetTerminalNavigationForTests(): void {
  pending = null;
}

export interface PendingNavigationGate {
  /**
   * Jalankan `task` sekarang bila tidak ada navigasi tertunda; bila ada,
   * tahan sampai selesai. `key` yang sama menimpa tugas yang masih ditahan
   * (yang terakhir menang, urutan kunci berbeda tetap terjaga).
   */
  run: (key: string, task: () => void) => void;
  /** Buang semua tugas tertahan (dipanggil saat layar unmount). */
  dispose: () => void;
}

export function createPendingNavigationGate(options?: {
  isPending?: () => boolean;
  pollMs?: number;
}): PendingNavigationGate {
  const isPending = options?.isPending ?? (() => isTerminalNavigationPending());
  const pollMs = options?.pollMs ?? 250;
  const held = new Map<string, () => void>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  function flush() {
    timer = undefined;
    if (disposed) return;
    if (isPending()) {
      timer = setTimeout(flush, pollMs);
      return;
    }
    const tasks = [...held.values()];
    held.clear();
    for (const task of tasks) task();
  }

  return {
    run(key, task) {
      if (disposed) return;
      if (held.size === 0 && !isPending()) {
        task();
        return;
      }
      held.set(key, task);
      timer ??= setTimeout(flush, pollMs);
    },
    dispose() {
      disposed = true;
      held.clear();
      if (timer) clearTimeout(timer);
      timer = undefined;
    },
  };
}
