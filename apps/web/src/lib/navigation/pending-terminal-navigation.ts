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

/**
 * Batas atas menunggu navigasi sebelum dianggap gagal. Sengaja panjang: lewat
 * batas ini event yang tertahan dilepas ke handler layar asal, yaitu jalur
 * yang diduga menggagalkan navigasi, jadi hanya dipakai bila navigasi memang
 * macet (build produksi atau jaringan lambat bisa melebihi beberapa detik).
 */
export const TERMINAL_NAVIGATION_TIMEOUT_MS = 30_000;

interface PendingNavigation {
  origin: string;
  deadline: number;
}

let pending: PendingNavigation | null = null;
let watcher: ReturnType<typeof setInterval> | undefined;

/** Jeda pemantauan path; cukup rapat supaya Back cepat tetap tertangkap. */
const WATCH_INTERVAL_MS = 100;

function stopWatching() {
  if (watcher !== undefined) clearInterval(watcher);
  watcher = undefined;
}

/**
 * Bersihkan penanda begitu navigasi selesai (path bukan `origin` lagi) atau
 * batas waktu lewat, tanpa menunggu ada yang memanggil
 * `isTerminalNavigationPending`. Tanpa ini, layar tujuan yang tidak punya
 * event Realtime membiarkan penanda hidup, dan Back ke layar asal dalam batas
 * waktu menahan event layar asal. Hanya jalan di browser (tidak di SSR/tes
 * tanpa `window`).
 */
function startWatching() {
  stopWatching();
  if (typeof window === "undefined") return;
  watcher = setInterval(() => {
    if (!pending) {
      stopWatching();
      return;
    }
    // Membersihkan `pending` lewat pemeriksaan yang sama dengan gerbang.
    if (!isTerminalNavigationPending()) stopWatching();
  }, WATCH_INTERVAL_MS);
}

function currentPathname(): string {
  return typeof window === "undefined" ? "" : window.location.pathname;
}

/**
 * Tandai navigasi terminal sebagai berjalan, dari layar asal `origin` (bawaan
 * path saat ini). `origin` menentukan kapan penanda berakhir: begitu path
 * saat ini bukan `origin` lagi, navigasi dianggap selesai atau pemakai sudah
 * pindah ke layar lain, sehingga event Realtime layar itu tidak ikut tertahan.
 */
export function markTerminalNavigationPending(options?: {
  now?: number;
  origin?: string;
}): void {
  const now = options?.now ?? Date.now();
  const origin = options?.origin ?? currentPathname();
  pending = { origin, deadline: now + TERMINAL_NAVIGATION_TIMEOUT_MS };
  startWatching();
}

/**
 * `true` selama layar asal masih tampil dan batas waktu belum lewat.
 * `currentPath` dan `now` bisa disuntikkan untuk tes.
 */
export function isTerminalNavigationPending(
  currentPath: string = currentPathname(),
  now: number = Date.now(),
): boolean {
  if (!pending) return false;
  if (now >= pending.deadline || currentPath !== pending.origin) {
    pending = null;
    return false;
  }
  return true;
}

export function resetTerminalNavigationForTests(): void {
  pending = null;
  stopWatching();
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
    for (const task of tasks) {
      try {
        task();
      } catch (error) {
        console.error("pending-navigation gate: held task failed", error);
      }
    }
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
