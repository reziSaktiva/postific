## Decision ADR-122

### Title

Reconnect untuk Akun `disconnected` + Disambiguasi `AlreadyConnectedError` vs Double-Submit — menutup KI-078/KI-079

### Status

Accepted

### Date

2026-09-26

### Decision

KI-078 dan KI-079 ditemukan King Rezi + AI (2026-09-26) saat verifikasi
live KI-076 (lihat `PROJECT_STATE.md` § Known Issues untuk detail
penemuan). Keduanya diperbaiki bersama karena root cause-nya saling
terkait (constraint `[workspaceId, outstandAccountId]` yang sama).

1. **KI-078 — Reconnect untuk akun `disconnected`.** `ConnectedAccountAction`
   (`ConnectedAccountsList.tsx`) sebelumnya sengaja merender `null` untuk
   status `disconnected` (beda dari `reconnect-required` yang sudah punya
   tombol Reconnect) — keputusan desain lama yang membuat disconnect
   eksplisit jadi FINAL/permanen. **Bukan gap backend** —
   `WorkspaceService.initiateConnectAccount` sudah generik menerima
   `redirectAccountId` untuk akun `reconnect-required`/`disconnected`
   apa pun (docstring method itu sudah menyebut keduanya). Fix murni UI:
   gabungkan `case "reconnect-required"` dan `case "disconnected"` ke
   cabang yang sama (`ReconnectButton`), sesuai pola Claude Design
   (`templates/settings-connected-accounts.html` — chip "Disconnected"
   berpasangan dengan tombol "Reconnect"). Karena `ReconnectButton` mengisi
   `redirectAccountId`, `completeAccountConnection` memakai
   `IWorkspaceRepository.reconnectAccount` (UPDATE baris existing) — BUKAN
   `createConnectedAccount` (INSERT) — sehingga tidak lagi menabrak unique
   constraint dari baris `disconnected` lama.

   **Batasan yang TIDAK ditutup (ditemukan code review PR #139):** guard
   `if (account.platform === SocialPlatform.Facebook) return null` di
   `ConnectedAccountAction` berlaku untuk KEDUA case yang digabung di sini
   — Facebook Pages disconnected TETAP tidak punya jalur reconnect apa pun
   (alasan lama: reconnect multi-page belum punya UPDATE path). KI-078
   HANYA resolved untuk platform non-Facebook; belum ada task formal untuk
   Facebook Pages reconnect.

2. **KI-079 — Disambiguasi `ConflictError` genuine.** Route Handler callback
   (`/api/integrations/outstand/callback`) sebelumnya memperlakukan SEMUA
   `ConflictError` dari `createConnectedAccount` sebagai redirect
   `"success"` diam-diam — didesain untuk double-submit genuine (request
   susulan Next.js untuk akun yang baru saja dibuat, lihat docstring route
   itu), tapi juga menutupi kegagalan genuine: user "Connect Account"
   generik ke akun yang sudah pernah terhubung (dari flow terpisah, bisa
   jadi lama) menabrak constraint yang sama tapi TIDAK seharusnya dianggap
   sukses. Fix: `WorkspaceService.createOrRecoverConnectedAccount`
   (wrapper baru `createConnectedAccount`) membedakan dua kasus via
   `connectedAt` baris yang bentrok (kolom ini TIDAK PERNAH berubah setelah
   `create`, termasuk lewat `reconnectAccount` — selalu mencerminkan momen
   `create` ASLINYA):
   - Baris bentrok dibuat dalam **15 detik terakhir**
     (`DOUBLE_SUBMIT_RECOVERY_WINDOW_MS`) → idempotent, kembalikan baris
     yang sudah ada sebagai sukses (perilaku lama untuk kasus ini
     dipertahankan).
   - Lebih lama dari itu → `AlreadyConnectedError` (subclass baru
     `ConflictError`, `@/lib/utils/errors`) dilempar ke atas. Route Handler
     memetakannya ke status baru `?connect=already-connected` (BUKAN
     `success` atau `error` generik) — `ConnectedAccountsList.tsx`
     menampilkan toast spesifik ("sudah terhubung ... gunakan tombol
     Reconnect"), bukan copy "Coba lagi" yang menyesatkan (retry tidak
     akan membantu, akun memang sudah ada).

   Repository dapat method baru `findConnectedAccountByOutstandId`
   (`workspaceId` + `outstandAccountId` → `ConnectedAccountRecord | null`)
   untuk lookup baris yang bentrok.

### Reason

* KI-078: mengikuti pola yang SUDAH dikunci di Claude Design (bukan
  keputusan baru yang ditebak) — rule 17 `AGENTS.md` dicek, mockup
  `settings-connected-accounts.html` sudah menunjukkan tombol Reconnect
  berpasangan dengan chip status non-active, jadi tidak perlu
  `AskUserQuestion` tambahan.
* KI-079: `connectedAt` dipilih sebagai sinyal (bukan menambah kolom/state
  baru) karena sudah ADA dan sudah immutable-by-design setelah `create`
  (`reconnectAccount` sengaja mempertahankannya, T-015.3) — pengukuran yang
  tepat untuk "kapan baris ini benar-benar pertama kali dibuat", tanpa
  perlu infrastruktur idempotency-key baru (Redis/tabel terpisah) yang
  jauh lebih berat untuk skala masalah ini (dua request duplikat dalam
  hitungan detik, per docstring Route Handler).
* 15 detik dipilih sebagai jendela toleransi: `docstring` Route Handler
  mendeskripsikan request susulan Next.js (prefetch/revalidasi) terjadi
  "nyaris seketika" — 15 detik memberi headroom besar untuk variasi
  network/timing tanpa menyamarkan percobaan connect genuinely terpisah
  (menit/jam/hari kemudian, skenario KI-079 asli) sebagai "aman
  diabaikan".
* `AlreadyConnectedError` dibuat sebagai subclass `ConflictError` (bukan
  error hierarchy baru dari `ApplicationError` langsung) — kode existing
  yang menangani `ConflictError` secara umum (mis. `toActionError`, kalau
  ada jalur lain yang memanggilnya) tetap bekerja tanpa perubahan;
  Route Handler cukup memeriksa subclass yang lebih spesifik LEBIH DULU.
* **Update (code review PR #139):** jendela 15 detik semula dihitung
  `Date.now() - connectedAt.getTime()` di `WorkspaceService` (Node) — rawan
  drift kalau jam app-server (Railway) dan database (Supabase) tidak
  presisi sama. Diperbaiki jadi `IWorkspaceRepository.
  isConnectedAccountWithinWindow` yang menghitung `now() - connected_at` di
  sisi Postgres lewat `$queryRaw` — jendela 15 detik dan pilihan sinyal
  `connectedAt` TIDAK berubah, cuma lokasi perbandingan waktunya dipindah
  supaya kedua sisi pembanding berasal dari jam yang sama.

### Alternatives Considered

* **Idempotency store terpisah (tabel/cache keyed by nonce OAuth) untuk
  KI-079**, bukan heuristik `connectedAt` + jendela waktu. Ditolak untuk
  scope ini — menambah infrastruktur baru (skema, TTL, cleanup) untuk
  masalah yang sudah punya sinyal cukup baik dari data yang ada
  (`connectedAt`). Bisa dipertimbangkan ulang kalau jendela waktu terbukti
  tidak cukup andal di produksi (belum ada indikasi itu).
* **Menghapus cabang `ConflictError` di Route Handler sepenuhnya**
  (biarkan semua conflict jadi `"error"` generik). Ditolak — meregresi
  UX double-submit genuine yang sudah terverifikasi aman (toast error
  palsu menimpa toast sukses dari request asli).
* **Label UI berbeda untuk `disconnected` vs `reconnect-required`** (mis.
  "Connect Ulang" vs "Reconnect"). Ditolak — Claude Design hanya
  menunjukkan SATU label ("Reconnect") untuk chip status non-active;
  membedakan copy akan jadi tebakan tanpa dasar desain.

### References

* KI-078, KI-079 — `project-manager/PROJECT_STATE.md` § Known Issues
  (ditemukan 2026-09-26, Resolved sesi ini).
* ADR-105/ADR-112 — `connectAccount`/`resolveConnectCallback`, alur
  Connect/Reconnect Account yang diamandemen di sini.
* ADR-120 — `avatarUrl` (KI-076), sesi penemuan yang sama.
* `apps/web/src/app/(app)/settings/connected-accounts/components/ConnectedAccountsList.tsx`
  — `ConnectedAccountAction`, `ReconnectButton`.
* `apps/web/src/domains/workspace/services/workspace.service.ts` —
  `createOrRecoverConnectedAccount`, `DOUBLE_SUBMIT_RECOVERY_WINDOW_MS`.
* `apps/web/src/domains/workspace/repositories/workspace.repository.ts` —
  `findConnectedAccountByOutstandId` (kontrak baru).
* `apps/web/src/lib/utils/errors.ts` — `AlreadyConnectedError`.
* `apps/web/src/app/api/integrations/outstand/callback/route.ts` —
  status redirect baru `already-connected`.
* Claude Design — `templates/settings-connected-accounts.html` (pola
  tombol Reconnect untuk chip status non-active).
