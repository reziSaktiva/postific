/**
 * Teks dan aturan scope di layar persetujuan (KSP-09-F04, rancangan
 * ScreenOauthConsent). Kunci memakai nama scope di kabel OAuth (`mcp:read`,
 * ...), sama dengan yang dibaca plugin consent. `publish` dan `reply` sengaja
 * tidak ada: ditunda (ADR-138), jadi tidak pernah ditampilkan.
 */
export type ConsentScopeCopy = {
  scope: "mcp:read" | "mcp:draft" | "mcp:schedule";
  /** Nama logis (ADR-138), tampil dengan font mono. */
  code: "read" | "draft" | "schedule";
  title: string;
  description: string;
  /** Scope berdampak: tidak tercentang bawaan dan diberi penanda "Berdampak". */
  impactful: boolean;
};

/** Urutan tampil kanonikal. */
export const CONSENT_SCOPES: readonly ConsentScopeCopy[] = [
  {
    scope: "mcp:read",
    code: "read",
    title: "Baca",
    description:
      "Melihat akun terhubung, draft, antrean, riwayat, dan analitik workspace. Tidak mengubah apa pun.",
    impactful: false,
  },
  {
    scope: "mcp:draft",
    code: "draft",
    title: "Buat dan ubah draft",
    description:
      "Membuat draft baru dan mengedit draft. Tidak menyentuh post yang sudah terjadwal dan tidak mempublikasikan apa pun.",
    impactful: false,
  },
  {
    scope: "mcp:schedule",
    code: "schedule",
    title: "Jadwalkan post",
    description:
      "Menjadwalkan post ke akun terhubung — post akan terbit otomatis pada waktunya. Pembatalan jadwal hanya bisa dilakukan di aplikasi.",
    impactful: true,
  },
];

/**
 * Scope yang boleh dipilih pengguna: hanya yang diminta klien (plugin menolak
 * scope di luar yang diminta) dan dikenal produk, urut kanonikal.
 */
export function selectableConsentScopes(
  requestedWireScopes: readonly string[],
): ConsentScopeCopy[] {
  return CONSENT_SCOPES.filter((copy) =>
    requestedWireScopes.includes(copy.scope),
  );
}

/** Tercentang bawaan: semua yang tidak berdampak (`read`, `draft`); `schedule` harus dicentang sengaja. */
export function defaultGrantedScopes(
  selectable: readonly ConsentScopeCopy[],
): string[] {
  return selectable.filter((copy) => !copy.impactful).map((copy) => copy.scope);
}

/** Scope non-MCP yang harus ikut dikirim agar tidak dibuang dari consent (refresh token). */
export function passthroughScopes(
  requestedWireScopes: readonly string[],
): string[] {
  return requestedWireScopes.filter(
    (scope) => scope === "offline_access" || scope === "openid",
  );
}
