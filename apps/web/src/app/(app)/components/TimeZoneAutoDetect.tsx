"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { normalizeDetectedTimeZone } from "@/domains/identity";

import { detectTimeZoneAction } from "../settings/account/actions";

/**
 * T-147 (ADR-146): pada kunjungan pertama pengguna baru (`pending`), kirim
 * zona browser ke server untuk disimpan SEKALI. Server menolak bila sudah
 * pernah dideteksi/diatur, jadi pilihan manual tidak pernah tertimpa. Tidak
 * merender apa pun.
 */
export function TimeZoneAutoDetect({ pending }: { pending: boolean }) {
  const router = useRouter();
  const attempted = useRef(false);

  useEffect(() => {
    if (!pending || attempted.current) return;
    attempted.current = true;

    const detected = normalizeDetectedTimeZone(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    if (!detected) return;

    void detectTimeZoneAction(detected)
      .then((result) => {
        if (result.ok && result.applied) router.refresh();
      })
      .catch(() => {
        // Deteksi best-effort; gagal tidak mengganggu pengguna, dicoba lagi
        // pada kunjungan berikutnya selama masih "pending".
      });
  }, [pending, router]);

  return null;
}
