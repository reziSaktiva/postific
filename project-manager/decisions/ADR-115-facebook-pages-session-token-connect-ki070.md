## Decision ADR-115

### Title

Connect Account — Facebook Pages via Session-Token + Page-Selection
(Amandemen ADR-112, menutup KI-070)

### Status

Proposed — Amended by ADR-116 (2026-09-24). Menunggu review Elon Backend
Engineer/Ridwan Architecture Reviewer sebelum implementasi, dan verifikasi
wire-format terhadap OpenAPI spec resmi Outstand (`api.outstand.so`) yang
tidak bisa diakses langsung dari sesi ini (lihat bagian **Belum
Terverifikasi** di bawah — pola yang sama pernah terjadi di ADR-105,
dikoreksi ADR-112 setelah verifikasi nyata). **Update 2026-09-24:**
verifikasi wire-format sudah dilakukan Elon Backend Engineer dan dicatat
sebagai amandemen terpisah **ADR-116** — 4 poin "Belum Terverifikasi" di
bawah sekarang terjawab, kontrak `packages/shared` di sini tetap berlaku
apa adanya (lihat ADR-116 untuk detail koreksi mapping wire↔domain).
Implementasi kode sudah selesai (backend) dan lolos review Ridwan
Architecture Reviewer 0 temuan — lihat `PROJECT_STATE.md` § KI-070 dan
`tasks/v02-publishing-mvp.md` § T-025.4 untuk status terkini (UI masih
pending).

### Date

2026-09-24

### Decision

ADR-112 menyempitkan `resolveConnectCallback` ke platform **single-page**
saja (Instagram/X/LinkedIn/Threads/TikTok/YouTube/Pinterest, dst — satu
login = satu akun, data akun lengkap di query param callback) dan
men-throw eksplisit `OutstandIntegrationError` untuk
`platform === SocialPlatform.Facebook`
(`apps/web/src/lib/adapters/outstand/real-outstand-adapter.ts`, method
`resolveConnectCallback`, baris 478–485), mencatat sisa scope-nya sebagai
**KI-070**. ADR ini mengisi gap itu: kontrak, boundary RBAC/IDOR, dan alur
UI untuk Facebook Pages — flow **session-token** yang benar-benar berbeda
bentuknya dari single-page.

Desain UI (dialog page-selection, 4 state: loading/default/selected/empty)
sudah **CONFIRMED King Rezi** di Claude Design
(`templates/settings-connect-facebook-pages.html`,
`.dialog-md`/`.fbpage-*` di `styles.css`) — lihat `PROJECT_STATE.md` §
KI-070. ADR ini menerjemahkan desain itu ke kontrak backend.

#### 1. Kenapa Facebook butuh flow terpisah

Satu login Facebook bisa mengelola banyak **Facebook Page** (Page bisnis).
Outstand tidak bisa langsung memberi tahu kita "akun mana yang
terhubung" seperti platform single-page — sebagai gantinya, redirect OAuth
Facebook kembali ke `redirect_uri` KITA (`CONNECT_CALLBACK_PATH`, TIDAK
berubah dari ADR-105/112 — lihat poin 2) membawa query param
**`session_token`** (nama param **belum terverifikasi**, lihat bagian
**Belum Terverifikasi**), BUKAN `account_id`/`username`/`network_unique_id`.
`session_token` itu dipakai untuk:

- `GET /v1/social-accounts/pending/{sessionToken}` → daftar Facebook Page
  yang tersedia untuk dipilih dari login Facebook itu.
- `POST /v1/social-accounts/pending/{sessionToken}` (body membawa Page
  yang dipilih user) → konfirmasi, mengembalikan data akun (Page) yang
  berhasil terhubung — kemungkinan besar **array**, bukan satu object
  (beda dari `ConnectedAccountData` tunggal di ADR-105/112), karena user
  boleh memilih **lebih dari satu Page sekaligus** (keputusan UI King
  Rezi, KI-070: checkbox multi-select, minimum 1).

#### 2. `connectAccount` (langkah 1, ADR-105) — TIDAK berubah

Sama seperti ADR-112 poin 2: `connectAccount()` membentuk URL redirect
OAuth yang SAMA persis untuk semua platform termasuk Facebook
(`https://www.outstand.so/app/api/socials/{network}/{orgId}?redirect_uri=...`,
`state` KITA tetap disisipkan sebagai query param
`redirect_uri`). Tidak ada percabangan Facebook di method ini — perbedaan
murni terjadi di SISI OUTSTAND saat proses OAuth Facebook selesai (mereka
yang memutuskan redirect balik membawa `session_token` alih-alih
`account_id`/`username`, bukan sesuatu yang kita minta secara eksplisit di
langkah 1).

#### 3. Kontrak baru `packages/shared/src/contracts/outstand-adapter.ts`

Dua method baru ditambahkan ke `IOutstandAdapter` (bukan mengubah
`resolveConnectCallback` — Facebook TETAP throw di situ, lihat poin 6):

```ts
export interface FacebookPendingPage {
  /** Opaque page id dari Outstand — dipakai balik sebagai anggota `selectedPageIds` di confirm, bukan `outstandAccountId` (belum tentu sama bentuknya). */
  pageId: string;
  name: string;
  pictureUrl?: string;
  category?: string;
}

export interface ListPendingFacebookPagesInput {
  sessionToken: string;
}

export interface ListPendingFacebookPagesResult {
  pages: FacebookPendingPage[];
}

export interface ConfirmFacebookPagesInput {
  sessionToken: string;
  /** Minimum 1 elemen — divalidasi UI (tombol disabled) DAN adapter (defense-in-depth, jangan cuma percaya client). */
  selectedPageIds: string[];
}

export interface ConfirmFacebookPagesResult {
  /** Satu entri per Page yang berhasil dikonfirmasi Outstand — platform SELALU SocialPlatform.Facebook untuk tiap entri. */
  accounts: ConnectedAccountData[];
}
```

```ts
  listPendingFacebookPages(
    input: ListPendingFacebookPagesInput,
  ): Promise<ListPendingFacebookPagesResult>;

  confirmFacebookPagesConnection(
    input: ConfirmFacebookPagesInput,
  ): Promise<ConfirmFacebookPagesResult>;
```

`ConnectedAccountData` (bentuk hasil per-Page, ADR-105) **tidak berubah** —
`{ outstandAccountId, platform, handle, status: "active" }`. Untuk
Facebook, `outstandAccountId` diisi dari `FacebookPendingPage.pageId` yang
dikonfirmasi Outstand (bukan `pageId` mentah dari `listPendingFacebookPages`
— Outstand bisa saja mengembalikan id yang berbeda di response confirm,
sama seperti pola "jangan asumsikan" yang sudah ada di ADR-039/114 soal
`board_id` Pinterest) dan `handle` dari `name` Page.

#### 4. Real adapter — implementasi baru, bukan throw

`listPendingFacebookPages`: `GET /v1/social-accounts/pending/{sessionToken}`
— murni pass-through + mapping response ke `FacebookPendingPage[]`. Tidak
ada RBAC/business logic di adapter (ACL boundary, AGENTS.md #6) — itu
tanggung jawab `WorkspaceService`.

`confirmFacebookPagesConnection`: `POST
/v1/social-accounts/pending/{sessionToken}` dengan body membawa
`selectedPageIds` (nama field body **belum terverifikasi**, lihat bagian
**Belum Terverifikasi**) — response dipetakan ke
`ConfirmFacebookPagesResult.accounts`.

#### 5. Fake adapter — mock deterministik (ADR-059)

Mengikuti pola ADR-059/110 (auto-switch via `getOutstandAdapter()`, instant
always-success, tanpa simulasi delay/failure): `listPendingFacebookPages`
mengembalikan 3 Page tetap (deterministik dari `sessionToken` sebagai seed,
pola sama `buildFakeHandle`) — bisa reuse persis 3 fixture yang sudah
dipakai draft desain King Rezi di Claude Design ("Kopi Selasar", "Kopi
Selasar — Cabang Selatan", "Roti Selasar") supaya QA/demo konsisten dengan
apa yang sudah direview King Rezi. `confirmFacebookPagesConnection`
langsung mengembalikan `ConnectedAccountData` untuk tiap `selectedPageIds`
yang cocok dengan salah satu dari 3 fixture itu (deterministik, tanpa
network call).

#### 6. `resolveConnectCallback` — TIDAK diubah, Facebook tetap throw di sana

Throw eksplisit untuk `platform === Facebook` di `resolveConnectCallback`
(ADR-112 §5) **dipertahankan apa adanya** — method itu HANYA untuk flow
single-page (`account_id`/`username` langsung di query callback). Kalau
Facebook somehow mendarat di situ, itu tetap bug di tempat lain (mis. Route
Handler salah mendeteksi `session_token` vs `account_id`), harus tetap
gagal keras, bukan diam-diam ditangani lewat jalur yang salah.

#### 7. Route Handler callback — percabangan baru, bukan handler baru

`apps/web/src/app/api/integrations/outstand/callback/route.ts` TETAP SATU
route untuk semua platform (tidak ada route terpisah per-Facebook) —
dibaca query param TAMBAHAN `session_token` SEBELUM pengecekan
`account_id`/`username`/`state` yang sudah ada:

```ts
const sessionToken = request.nextUrl.searchParams.get("session_token");
```

- Kalau `sessionToken` ADA (dan `accountId`/`username` TIDAK ada) →
  cabang Facebook: CSRF-check nonce cookie SAMA seperti sekarang (baris
  99–105 existing, `outstandConnectNonceCookieName(decoded.nonce)`) — TAPI
  **cookie TIDAK dihapus di sini** (beda dari `redirectWithStatus`
  existing) karena flow belum selesai, user masih perlu memilih Page.
  Redirect ke
  `${CONNECTED_ACCOUNTS_PATH}?connectFacebookSessionToken=<sessionToken>&connectFacebookState=<state>`
  — Connected Accounts page (client component) membaca 2 query param ini
  saat mount dan otomatis membuka dialog `.dialog-md` Facebook Pages
  (desain confirmed), memanggil Server Action baru (poin 8) untuk
  `listPendingFacebookPages`.
- Kasus no-op prefetch (baris 66–68 existing, `!accountId && !username &&
  !state`) diperluas: no-op HANYA kalau `sessionToken` JUGA kosong.
- Kasus "ada salah satu field tapi tidak lengkap" (baris 69–73 existing)
  tidak berubah untuk jalur single-page; jalur Facebook punya pengecekan
  sendiri (`sessionToken` + `state` keduanya wajib ada bareng, kalau cuma
  satu → `?connect=error`).

#### 8. `WorkspaceService` — 2 method baru, bukan mengubah `completeAccountConnection`

```ts
async listFacebookPendingPages(input: {
  workspaceId: WorkspaceId;
  actorId: UserId;
  sessionToken: string;
}): Promise<FacebookPendingPage[]>
```

- RBAC Owner/Admin (reuse `assertActorCanManageConnectedAccounts`, gate
  yang sama dipakai `initiateConnectAccount`/`completeAccountConnection`).
- Tidak ada IDOR check tambahan di sini (belum ada `ConnectedAccount` yang
  disentuh — murni membaca daftar Page dari Outstand).
- Delegasi ke `requireOutstandAdapter().listPendingFacebookPages()`.

```ts
async confirmFacebookPagesConnection(input: {
  workspaceId: WorkspaceId;
  actorId: UserId;
  sessionToken: string;
  selectedPageIds: string[];
}): Promise<ConnectedAccountRecord[]>
```

- RBAC Owner/Admin (gate sama).
- Validasi `selectedPageIds.length >= 1` (defense-in-depth — UI sudah
  disable tombol di 0 dipilih, tapi Server Action tidak boleh percaya
  client, `ValidationError` kalau kosong).
- SATU panggilan `requireOutstandAdapter().confirmFacebookPagesConnection()`
  untuk SEMUA Page yang dipilih (bukan N panggilan terpisah — endpoint
  Outstand menerima banyak Page dalam satu `POST`, jadi atomicity di sisi
  Outstand bukan tanggung jawab kita untuk simulasikan ulang).
- Loop hasil (`ConfirmFacebookPagesResult.accounts`) memanggil
  `this.repository.createConnectedAccount(...)` **satu per Page** (reuse
  method existing, TIDAK ada repository method baru) — **kalau salah satu
  Page sudah pernah terhubung sebelumnya** (unique constraint
  `[workspaceId, outstandAccountId]`, `ConflictError`), **skip Page itu
  (idempoten, bukan gagal total)** dan lanjut ke Page berikutnya — konsisten
  dengan filosofi idempotent-guard yang sudah ada di codebase ini (mis.
  `markPostPublished`'s `updateMany` guard, ADR-109). Kembalikan HANYA Page
  yang benar-benar baru dibuat (Page yang di-skip TIDAK ikut di return
  value — caller/UI menampilkan toast merangkum "N Page terhubung" dari
  panjang array yang dikembalikan, bukan dari jumlah yang dipilih).
- **Reconnect (T-015.3-style) untuk Facebook Page tunggal yang sudah
  ada — DI LUAR SCOPE ADR ini.** Method ini SELALU CREATE, tidak menerima
  `redirectAccountId`. Kalau nanti dibutuhkan reconnect untuk satu Facebook
  Page yang sudah `disconnected`/`reconnect-required`, itu perlu keputusan
  scope terpisah (apakah reconnect Facebook tetap lewat flow session-token
  penuh — pilih ulang dari daftar Page — atau ada jalur pintas) — dicatat
  sebagai KI baru terpisah oleh Gibran Project Manager saat implementasi
  menyentuh kasus ini, bukan diasumsikan sekarang.
- JOB-03 engagement sync seeding (`engagementSyncSeeder?.onAccountConnected`,
  Temuan #1 Ridwan) dipanggil SEKALI PER Page yang berhasil dibuat, sama
  seperti `completeAccountConnection`.

#### 9. Server Actions baru

Dua Server Action baru (pola sama `initiateConnectAccountAction`, di
folder Server Actions Connected Accounts yang sudah ada):

- `listFacebookPendingPagesAction({ sessionToken, state })` — decode
  `state` untuk `nonce` (reuse `decodeConnectAccountState`, TIDAK
  menghapus cookie), cocokkan cookie CSRF (baca saja, jangan hapus),
  delegasi ke `WorkspaceService.listFacebookPendingPages`. Dipanggil
  dialog saat mount (state Loading → Default).
- `confirmFacebookPagesConnectionAction({ sessionToken, state,
  selectedPageIds })` — decode `state` lagi, cocokkan cookie CSRF LAGI
  (defense-in-depth sama seperti `completeAccountConnection`, parameter
  round-trip lewat browser/dialog bisa ditamper antara list dan confirm),
  **HAPUS cookie nonce di sini** (baik sukses maupun gagal — titik akhir
  flow, sama seperti `redirectWithStatus` existing), delegasi ke
  `WorkspaceService.confirmFacebookPagesConnection`.

#### 10. UI — pemetaan ke desain confirmed

`templates/settings-connect-facebook-pages.html` (Claude Design,
CONFIRMED) jadi acuan struktur persis: dialog `.dialog-md`, state Loading
(skeleton) saat `listFacebookPendingPagesAction` berjalan, state Default
(checkbox list, tombol disabled 0 dipilih), tombol dinamis "Hubungkan N
Page Terpilih", state Empty (0 Page ditemukan → tombol "Login Ulang dengan
Facebook" yang mengulang `initiateConnectAccount` dari awal untuk
`platform: Facebook`). Connected Accounts page membuka dialog ini otomatis
kalau query param `connectFacebookSessionToken`/`connectFacebookState` ada
saat mount (poin 7) — bukan dipicu tombol "Connect Account" yang sudah ada
(tombol itu tetap generik, memicu `initiateConnectAccount` untuk platform
apa pun termasuk Facebook; hasil approaching-nya yang beda: single-page
langsung selesai, Facebook mendarat balik di dialog ini).

### Reason

- Facebook Pages secara struktural berbeda dari setiap platform single-page
  lain (satu login → banyak akun yang bisa dipilih) — memaksakan kontrak
  `resolveConnectCallback` yang sama (ADR-112) untuk kasus ini terbukti
  salah sejak awal (kenapa ADR-112 sengaja mempersempit scope-nya dan
  men-throw eksplisit, bukan menebak bentuk yang belum tentu benar).
- Endpoint session-token (`GET/POST .../pending/{sessionToken}`) dan flow
  UI page-selection butuh keputusan UI/UX (desain dialog, minimum
  selection, dst.) yang tidak bisa diputuskan backend sendirian — sudah
  diselesaikan lebih dulu (Claude Design, King Rezi confirm 2026-09-24)
  sebelum ADR ini ditulis, mengikuti gate rule #17 AGENTS.md.
- SATU panggilan `confirmFacebookPagesConnection` untuk semua Page yang
  dipilih (bukan N panggilan) dipilih karena bentuk endpoint Outstand-nya
  sendiri (`POST` ke SATU `sessionToken`, bukan per-Page) sudah
  mengisyaratkan itu — meniru bentuk request N kali ke endpoint yang sama
  cuma menambah kompleksitas tanpa manfaat.
- Skip (bukan gagal total) untuk Page yang sudah pernah terhubung
  mengikuti filosofi idempotent-guard yang sudah konsisten dipakai di
  codebase ini (ADR-109) — user yang mencentang ulang Page yang kebetulan
  sudah terhubung sebelumnya seharusnya tidak kehilangan progress untuk
  Page lain yang baru dipilih di request yang sama.
- Reconnect Facebook Page tunggal sengaja TIDAK diputuskan sekarang (YAGNI)
  — belum ada kebutuhan konkret yang mendesak, dan memaksa desain
  universal connect+reconnect sebelum ada use-case nyata berisiko menebak
  bentuk yang keliru (persis pelajaran ADR-105 → ADR-112).

### Alternatives Considered

- **Overload `resolveConnectCallback` untuk menerima `sessionToken` juga**
  (union type input). Ditolak — nama method sudah menyiratkan "callback
  tunggal, satu akun" (ADR-112 poin alasan penamaan); memaksakan Facebook
  ke situ mengulang kesalahan yang sama seperti kontrak lama ADR-105 yang
  mengasumsikan bentuk universal sebelum terverifikasi.
- **N panggilan `confirmFacebookPagesConnection`, satu per Page dipilih**
  (bukan satu panggilan batch). Ditolak — endpoint Outstand sendiri
  sudah berbentuk "satu sessionToken, banyak Page" dalam satu `POST`;
  memecahnya jadi N request menambah latency dan titik gagal tanpa
  manfaat, dan tidak merepresentasikan bentuk API yang sebenarnya.
- **Rollback semua Page kalau salah satu gagal saat persist lokal**
  (`$transaction` penuh). Ditolak untuk sekarang — `IWorkspaceRepository`
  belum punya primitive transaksi lintas-row di layer ini, dan kasus
  gagalnya (`ConflictError` — Page sudah terhubung sebelumnya) bukan
  kegagalan yang seharusnya membatalkan Page lain yang berhasil; menambah
  transaksi penuh sekarang menambah kompleksitas untuk kasus yang
  penanganannya (skip + lanjut) sudah cukup aman.
- **Route Handler terpisah khusus Facebook**
  (`/api/integrations/outstand/callback-facebook`). Ditolak — `state`
  (nonce, CSRF) dan `redirect_uri` dasarnya sama; cabang di dalam handler
  yang sudah ada lebih sederhana daripada menduplikasi seluruh
  boilerplate CSRF/session-check di route baru.

### Belum Terverifikasi (wajib dicek Elon Backend Engineer sebelum/-saat implementasi)

ADR ini ditulis **tanpa akses langsung** ke OpenAPI spec resmi Outstand
(`api.outstand.so`) — percobaan mengaksesnya lewat browser sesi ini
ditolak/gagal, dan MCP `mcp__outstand__*` yang terpasang tidak
mengekspos tool operasional untuk flow session-token Facebook (dicek:
`list_social_accounts`, `get_social_account`, `create_social_network`,
`get_more_tools` — tidak ada satu pun yang menyinggung "Facebook Pages"/
"session token"/"pending"). Bagian berikut adalah **desain terbaik yang
bisa disusun dari nama endpoint yang sudah dikonfirmasi ADR-112**
(`GET/POST /v1/social-accounts/pending/{sessionToken}`), BUKAN hasil
verifikasi langsung — pola yang sama persis dengan ADR-105 yang kemudian
dikoreksi ADR-112 setelah verifikasi nyata:

1. Nama query param redirect (`session_token`) — belum terverifikasi;
   bisa saja bentuknya beda (`token`, `pending_token`, dst).
2. Bentuk body `POST /v1/social-accounts/pending/{sessionToken}` — belum
   terverifikasi; bisa saja key-nya bukan `selectedPageIds` (mis.
   `page_ids`, `accounts`, dst) atau butuh field tambahan per-Page.
3. Bentuk response `GET .../pending/{sessionToken}` (field `pageId`/`name`/
   `pictureUrl`/`category` di `FacebookPendingPage`) — belum
   terverifikasi field-per-field terhadap response asli.
4. Apakah `session_token` bisa expired sebelum user selesai memilih Page
   (butuh UX untuk itu — mungkin re-init dari awal) — belum diverifikasi
   ke dokumentasi Outstand soal TTL session-token.

**Elon Backend Engineer WAJIB memverifikasi keempat poin ini** (lewat
OpenAPI spec resmi, atau MCP `mcp__outstand__get_auth_url` dengan
`network: "facebook"` di lingkungan testing kalau perlu, dikoordinasikan
dengan King Rezi dulu karena itu network call sungguhan) **sebelum**
implementasi final — kalau ada perbedaan bentuk, tulis ADR amandemen baru
(pola sama ADR-105→ADR-112), JANGAN diam-diam menambal kode tanpa
mencatat ADR baru (rule #4 AGENTS.md).

### References

- KI-070 (`PROJECT_STATE.md` § Known Issues) — temuan awal gap, sekarang
  ditutup ADR ini (implementasi masih pending, lihat status di atas).
- ADR-112 — amandemen ADR-105, sumber scope-split single-page vs
  Facebook Pages yang di-follow-up ADR ini.
- ADR-105 — kontrak `connectAccount` asli (tidak berubah, poin 2).
- ADR-059 — pola Fake adapter (auto-switch, instant always-success).
- ADR-109 — preseden idempotent-guard (skip bukan gagal, poin 8).
- `packages/shared/src/contracts/outstand-adapter.ts` — kontrak final
  (method baru ditambahkan di sini).
- `apps/web/src/lib/adapters/outstand/real-outstand-adapter.ts` — Facebook
  throw di `resolveConnectCallback` (baris 478–485, TIDAK diubah).
- `apps/web/src/lib/adapters/outstand/fake-outstand-adapter.ts` — Fake
  adapter baru untuk 2 method ini.
- `apps/web/src/domains/workspace/services/workspace.service.ts` —
  `initiateConnectAccount`/`completeAccountConnection` (pola RBAC/IDOR
  yang di-reuse), 2 method baru ditambahkan.
- `apps/web/src/app/api/integrations/outstand/callback/route.ts` —
  percabangan `session_token` baru.
- `templates/settings-connect-facebook-pages.html` (Claude Design,
  CONFIRMED King Rezi 2026-09-24) — acuan desain UI.
- `tasks/v02-publishing-mvp.md` § T-025 (T-025.4).
