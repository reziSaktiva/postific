## Decision ADR-105

### Title

Fake `connectAccount`/`exchangeConnectCode` — split 2-method OAuth + redirect loopback ke callback sendiri

### Status

Accepted — Amended by ADR-112 (2026-09-23)

### Date

2026-09-11

### Decision

T-015.3 (Reconnect flow saat token expired) ternyata membutuhkan alur
redirect OAuth yang SAMA dengan T-013.1/T-013.2 (Connect Account) — yang
belum diimplementasikan sama sekali (`IOutstandAdapter` belum punya method
`connectAccount` sejak scope-nya sengaja dikeluarkan di ADR-059 poin 1).
King Rezi dikonfirmasi lewat AskUserQuestion: bangun Fake `connectAccount`
sekarang mengikuti pola ADR-059 (auto-switch env, throw loud, instant
fidelity tanpa simulasi) sesuai AGENTS.md rule 19, supaya T-015.3 tidak
mandek menunggu kredensial Outstand asli (`OUTSTAND_API_KEY`).

1. **Gap spesifikasi ditemukan, bukan ditebak liar:**
   `integration-layer.md` ("Alur Connect Account") menyebut "Request OAuth
   URL" sebagai langkah narasi terpisah dari "exchange code", tapi tabel
   kontrak `OutstandAdapter` di dokumen yang sama hanya mencantumkan satu
   `connectAccount(params) → ConnectedAccountData` — tidak konsisten dengan
   narasinya sendiri (2 tahap network call vs 1 method). ADR ini menutup
   gap tersebut dengan keputusan desain eksplisit, bukan mengasumsikan salah
   satu versi dokumen benar.

2. **Split 2 method**, mengikuti pola yang sudah ada di kontrak ini
   (`schedulePost`/`publishNow` = inisiasi sinkron, `fetchPostOutcome` =
   resolve belakangan):
   - `connectAccount(input: ConnectAccountInput) → ConnectAccountResult`
     — `ConnectAccountInput = { workspaceId, platform, redirectAccountId? }`,
     `ConnectAccountResult = { redirectUrl }`. `redirectAccountId` diisi HANYA
     untuk reconnect akun existing (T-015.3) — kosong berarti connect baru
     (T-013). Method ini murni membentuk URL redirect, tidak
     membuat/mengubah `ConnectedAccount` apa pun.
   - `exchangeConnectCode(input: ExchangeConnectCodeInput) → ConnectedAccountData`
     — `ExchangeConnectCodeInput = { code, state }`, `ConnectedAccountData =
     { outstandAccountId, platform, handle, status: "active" }`. Dipanggil
     Route Handler callback (Prabowo Feature Engineer, giliran setelah ADR
     ini) — `WorkspaceService` yang memutuskan CREATE vs UPDATE
     `ConnectedAccount` berdasarkan `redirectAccountId` yang dibawa lewat
     `state`, bukan tanggung jawab adapter.

3. **Fake redirect ke callback route KITA SENDIRI (loopback), bukan skip
   langsung ke sukses instan:** `fakeOutstandAdapter.connectAccount`
   mengembalikan `redirectUrl` relatif ke
   `/api/integrations/outstand/callback?code=...&state=...` (bukan URL
   domain eksternal apa pun, dan bukan langsung memanggil
   `WorkspaceService.completeAccountConnection` dari dalam adapter). Alasan:
   arsitektur Route Handler callback (CSRF-check `state`, pemanggilan
   `exchangeConnectCode`, keputusan create/update `ConnectedAccount`) tetap
   teruji end-to-end SEKARANG dengan Fake, bukan baru pertama kali diuji
   nanti saat real adapter (T-025) masuk. Trade-off: Fake sedikit lebih
   kompleks (perlu encode/decode `state`) dibanding auto-approve instan,
   tapi risiko "code path callback belum pernah tereksekusi sebelum
   production" jauh lebih mahal untuk arsitektur OAuth (CSRF, race
   create/update) dibanding untuk publishing (`schedulePost`, tanpa
   redirect browser).

4. **`state` di Fake** — base64url JSON `{ workspaceId, platform,
   redirectAccountId?, nonce }`, bukan JWT bertanda tangan sungguhan (Fake
   tidak butuh keamanan produksi, murni supaya `state` tetap satu string
   opaque sesuai bentuk kontrak, konsisten dengan cara Outstand asli
   membawa `state` bolak-balik lewat redirect browser). CSRF-check nyata
   (`nonce` dicocokkan sisi cookie/session) adalah tanggung jawab Route
   Handler (Prabowo), bukan adapter — adapter hanya membentuk/mendecode.

5. **`exchangeConnectCode` Fake instant always-success** (konsisten
   ADR-059): `code` diterima apa adanya tanpa verifikasi tambahan (Fake
   tidak menyimpan daftar code yang pernah diterbitkan — tidak ada state
   server-side untuk itu). `outstandAccountId`/`handle` deterministik dari
   `redirectAccountId` (kalau reconnect) atau `workspaceId:code` (kalau
   connect baru) — reconnect akun yang sama menghasilkan handle yang
   konsisten dipanggil ulang, bukan acak setiap kali. Tidak ada simulasi
   delay/gagal.

6. **Scope ADR ini murni kontrak adapter + Fake** (`packages/shared/src/contracts/outstand-adapter.ts`,
   `apps/web/src/lib/adapters/outstand/fake-outstand-adapter.ts`) — Route
   Handler `/api/integrations/outstand/callback`, perubahan
   `WorkspaceService` (`completeAccountConnection`), Server Action, dan UI
   (`ConnectPlatformMenu.tsx`, dst.) di luar scope, dikerjakan Prabowo
   Feature Engineer di giliran berikutnya memakai kontrak yang ditetapkan
   di sini.

### Reason

* Rule 19 AGENTS.md: task yang terhambat kredensial Outstand tidak boleh
  mandek — Fake mengikuti pola ADR-059 yang sudah terbukti (auto-switch env,
  throw loud, instant fidelity) daripada menunggu `OUTSTAND_API_KEY`.
* Split 2-method konsisten dengan pola yang sudah ada di kontrak ini
  (inisiasi vs resolve terpisah untuk `schedulePost`/`fetchPostOutcome`) —
  bukan pola baru yang perlu dipelajari ulang, dan cocok dengan narasi
  2-langkah `integration-layer.md` yang sebenarnya tidak match dengan tabel
  kontraknya sendiri.
* Loopback ke callback sendiri (bukan bypass) memastikan bug di Route
  Handler callback (CSRF, race create/update `ConnectedAccount` connect vs
  reconnect) ketemu SEKARANG lewat Fake, bukan pertama kali saat real
  adapter (T-025, kredensial belum ada) baru diimplementasikan — biaya
  ketemu bug arsitektur OAuth di production jauh lebih mahal.
* `redirectAccountId` eksplisit di `ConnectAccountInput` (bukan disimpulkan
  dari `state` sisi domain) membuat niat connect-baru vs reconnect eksplisit
  di boundary adapter, sesuai prinsip ACL: adapter tidak menyembunyikan
  informasi yang dibutuhkan domain untuk membuat keputusan bisnisnya
  sendiri (create vs update).

### Alternatives Considered

* **Fake `connectAccount` auto-approve instan (skip redirect browser sama
  sekali, langsung kembalikan `ConnectedAccountData`).** Ditolak — lebih
  simpel, tapi berarti Route Handler callback, CSRF `state` check, dan
  keputusan create/update `WorkspaceService` tidak pernah benar-benar
  dieksekusi sebelum real adapter ada; T-015.3 secara eksplisit tentang
  "mengulangi redirect flow", jadi flow itu sendiri yang perlu diuji.
* **Satu method `connectAccount(code)` saja** (bentuk yang tertulis di
  tabel kontrak `integration-layer.md` sebelum ADR ini) — ditolak, karena
  tidak match dengan narasi 2-langkah dokumen yang sama dan tidak ada
  tempat eksplisit untuk membentuk OAuth URL sebelum redirect terjadi.
* **`state` sebagai JWT bertanda tangan (HMAC)** menggunakan
  `OUTSTAND_WEBHOOK_SECRET` atau secret baru — ditolak untuk Fake:
  menambah kompleksitas tanpa manfaat (Fake tidak punya ancaman replay
  nyata, tidak ada network eksternal yang bisa memalsukan `state`); base64url
  JSON polos cukup untuk membawa data structural. Real adapter (T-025)
  boleh memilih pendekatan berbeda kalau Outstand mensyaratkan `state`
  opaque dari sisi mereka — di luar scope ADR ini.

### References

* `product-discovery/05-architecture/integration-layer.md` — "Alur Connect
  Account" (baris ~143-198).
* ADR-040 — kontrak resmi Outstand.
* ADR-059 — pola Fake adapter (auto-switch, throw loud, instant fidelity).
* ADR-079 — promosi `IOutstandAdapter` ke `packages/shared`.
* `packages/shared/src/contracts/outstand-adapter.ts` — kontrak final
  `ConnectAccountInput`/`ConnectAccountResult`/`ExchangeConnectCodeInput`/
  `ConnectedAccountData`.
* `apps/web/src/lib/adapters/outstand/fake-outstand-adapter.ts` —
  implementasi Fake (`connectAccount`/`exchangeConnectCode`).
* `tasks/v01-foundation.md` § T-015 (T-015.3), § T-013 (T-013.1/T-013.2).
