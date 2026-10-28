"use client";

import { useThemeMode } from "@/components/Providers";
import { Toaster } from "@/components/ui/sonner";

/**
 * Toaster sonner untuk area `(app)` (T-102.6, dipindah dari `Providers` di
 * T-160). Seluruh pemakai `toast()` ada di `(app)`; rute publik `/u/*` tidak
 * memuatnya karena sonner menyuntik `<style>` runtime yang melanggar CSP
 * nonce. `theme` memakai `mode` context (`components/ui/sonner.tsx` sengaja
 * tanpa `next-themes`).
 */
export function AppToaster() {
  const { mode } = useThemeMode();
  return <Toaster theme={mode} />;
}
