"use client";

import { useThemeMode } from "@/components/Providers";
import { Toaster } from "@/components/ui/sonner";

/**
 * Toaster sonner untuk area `(app)` (T-102.6, dipindah dari `Providers` di
 * T-160). Seluruh pemakai `toast()` ada di `(app)`; rute publik `/u/*` tidak
 * memuatnya karena sonner menyuntik `<style>` runtime yang melanggar CSP
 * nonce. `theme` memakai `mode` context (`components/ui/sonner.tsx` sengaja
 * tanpa `next-themes`). `position="top-center"` (T-170, keputusan King Rezi):
 * posisi default kanan-bawah menutupi tombol aksi di kartu (mis. Publish di
 * `/start-page`).
 */
export function AppToaster() {
  const { mode } = useThemeMode();
  return (
    <Toaster
      theme={mode}
      position="top-center"
      // Di mobile header (tombol "Buka menu") ada di y 8-52: geser toast ke bawahnya.
      mobileOffset={{ top: 64 }}
    />
  );
}
