import * as React from "react";

const MOBILE_BREAKPOINT = 768;

// T-105.3 (KI-066): file ini di-generate ulang oleh `shadcn add sidebar`
// (registry upstream) — snippet aslinya memanggil `setIsMobile(...)`
// langsung di body `useEffect` (bukan cuma di dalam callback listener),
// yang kena error `react-hooks/set-state-in-effect` di lint project ini
// (rule sudah ditegakkan di tempat lain, lihat
// `app/(app)/engage/components/EngageInboxView.tsx` dan
// `app/(app)/components/draft-editor/Modal.tsx`, keduanya MEREPLIKASI ulang
// pola supaya lolos rule ini, bukan suppress). Diganti `useSyncExternalStore`
// — API React yang memang didesain untuk subscribe ke sistem eksternal
// (di sini: `window.matchMedia`/`window.innerWidth`) tanpa effect+setState
// terpisah, dan `getServerSnapshot` menjaga hasil SSR tetap `false` (sama
// seperti `!!undefined` di snippet asli) supaya tidak ada hydration
// mismatch.
function subscribe(onChange: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function getServerSnapshot() {
  return false;
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
