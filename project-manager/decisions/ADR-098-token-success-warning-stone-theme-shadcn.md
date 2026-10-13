## Decision ADR-098

### Title

Tambah Token `--success`/`--warning` ke Stone Theme shadcn (Amandemen T-095.5)

### Status

Accepted — Amended by ADR-111 (2026-09-23)

### Date

2026-09-04

### Decision

1. Menambah **4 token CSS variable baru** ke pemetaan Stone theme →
   shadcn/ui (`apps/web/src/app/globals.css`), untuk light **dan** dark
   mode: `--success`, `--success-foreground`, `--warning`,
   `--warning-foreground`. Sebelumnya Stone theme shadcn hanya punya
   `--destructive` sebagai token status semantik (KI-041).
2. Nilai final:
   * **Light** — `--success: #3d5240`, `--success-foreground: #eef1ec`,
     `--warning: #6b5228`, `--warning-foreground: #f4ede0`.
   * **Dark** — `--success: #c3d1c5`, `--success-foreground: #1c2a1e`,
     `--warning: #e2c896`, `--warning-foreground: #2e2412`.
   * Desaturated, konsisten dengan gaya `--destructive` yang sudah ada
     (bukan warna hijau/kuning saturated generik) — kontras diverifikasi
     ≥6.3:1 WCAG AA untuk pasangan foreground/background masing-masing.
3. Ini **mengamandemen T-095.5** (pemetaan token Stone → CSS variable
   shadcn, dikunci saat setup fondasi migrasi rilis v0.7) — bukan
   mengamandemen ADR-097 secara keseluruhan (ADR-097 poin 9 secara
   eksplisit menyatakan token Stone dipakai sebagai acuan, bukan
   membekukan daftar token final).
4. Desain didokumentasikan di Claude Design, project "Social Media
   Management", `foundations/color.html` § "Stone/shadcn semantic tokens
   (KI-041)".
5. Implementasi kode: state "success"/"expired" di
   `AcceptInvitePageClient.tsx` (state "invalid" tetap `text-destructive`,
   tidak diubah), badge "Pending" di `MembersTable.tsx`
   (`Badge variant="secondary"` + className token `--warning`, `badge.tsx`
   sendiri tidak diubah).

### Reason

* **KI-041** (ditemukan T-097.3, meluas di T-099.2 dan T-101/T-102.6)
  mencatat Stone theme shadcn belum punya token warna semantik untuk state
  success/warning — Accept Invite dan badge status "Pending" terpaksa
  dipetakan ke token netral/`destructive` yang tidak sesuai makna, atau ke
  variant shadcn generik (`outline`/`secondary`) tanpa warna semantik.
* King Rezi memutuskan menambah token baru (bukan tetap netral selamanya
  untuk kedua state itu) — opsi yang lebih konsisten dengan sistem desain
  jangka panjang daripada terus menghindari warna semantik di seluruh app.

### Alternatives Considered

* **Tetap netral permanen** (state success/expired/Pending dipetakan ke
  token existing tanpa warna semantik) — ditolak; King Rezi menilai gap
  ini akan terus berulang setiap kali fitur baru butuh indikator status
  warna (sudah terjadi 3x: T-097.3, T-099.2, T-101/T-102.6).
* **Warna saturated generik** (hijau/kuning standar, tidak diturunkan dari
  palet Stone) — ditolak; tidak konsisten dengan estetika desaturated
  Stone theme (ADR-087) yang sudah dipakai `--destructive`.

---
