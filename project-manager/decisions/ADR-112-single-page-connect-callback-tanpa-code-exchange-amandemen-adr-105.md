## Decision ADR-112

### Title

Single-page Connect Callback tanpa Code Exchange — amandemen ADR-105
(`resolveConnectCallback` menggantikan `exchangeConnectCode` untuk
Instagram/X/LinkedIn/Threads/TikTok/YouTube/Pinterest, dst.)

### Status

Accepted — Amends ADR-105 — Amended by ADR-120 (2026-09-26)

### Date

2026-09-23

### Decision

KI-067 menemukan kontrak `IOutstandAdapter.exchangeConnectCode({code, state})`
(ADR-105) tidak cocok dengan realita API Outstand untuk platform
**single-page** (satu akun per koneksi — Instagram, X, LinkedIn, Threads,
TikTok, YouTube, Pinterest, dan platform sejenis lain di luar Facebook
Pages). Setelah King Rezi memasang MCP resmi `mcp.outstand.so` dan sesi
T-025 (2026-09-23) memeriksa perilaku redirect asli (dicatat di docstring
`real-outstand-adapter.ts`, ditulis SEBELUM ADR ini di sesi yang sama hari
ini — bukan tebakan baru), ditemukan: Outstand **tidak** mengirim `code`
yang bisa ditukar lewat call server-side terpisah. Setelah user
menyelesaikan OAuth di sisi Outstand, browser diarahkan balik ke
`redirect_uri` KITA dengan query param **`account_id`, `network_unique_id`,
`username`** langsung — data akun sudah lengkap di URL callback itu
sendiri, tidak ada endpoint "exchange code → account data" untuk kasus ini.

**Verifikasi tambahan sesi ini:** MCP `mcp.outstand.so` yang di-load di
sesi ini (`mcp__outstand__*`) hanya berisi tools operasional (create_post,
list_social_accounts, get_auth_url, dst.) — dipanggil `get_more_tools`
dengan context permintaan dokumentasi OAuth callback, tapi server
menjawab tidak ada tool tambahan ("we have shown you the full tool
list"). `get_auth_url` (yang men-generate URL otorisasi NYATA) sengaja
TIDAK dipanggil untuk verifikasi read-only sesuai arahan King Rezi. ADR ini
karena itu bersandar pada temuan OpenAPI spec resmi (`api.outstand.so`) dan
observasi format redirect yang sudah didokumentasikan di
`real-outstand-adapter.ts` pada sesi yang sama (2026-09-23), bukan temuan
baru dari MCP.

**Scope ADR ini SEMPIT: single-page account SAJA** (dikonfirmasi King
Rezi). Flow **multi-halaman (Facebook Pages dkk)** — yang butuh
session-token (`GET/POST /v1/social-accounts/pending/{sessionToken}`) dan
UI page-selection baru — **DI LUAR SCOPE**, dicatat sebagai **KI-070**
(baru, backlog terpisah), BUKAN dihapus dari backlog.

#### 1. Kontrak baru menggantikan `exchangeConnectCode`

`ExchangeConnectCodeInput`/method `exchangeConnectCode` **dihapus**, diganti:

```ts
export interface ConnectCallbackInput {
  state: string;
  outstandAccountId: string; // dari query param `account_id`
  username: string; // dari query param `username`
  networkUniqueId?: string; // dari query param `network_unique_id`, opsional
}
```

```ts
resolveConnectCallback(input: ConnectCallbackInput): Promise<ConnectedAccountData>;
```

`ConnectedAccountData` (bentuk hasil) **tidak berubah** dari ADR-105 —
`{ outstandAccountId, platform, handle, status: "active" }`. `platform`
tetap diambil dari `state` (di-decode adapter, sama seperti ADR-105 poin
4 — `state` sepenuhnya dibentuk KITA sendiri saat `connectAccount`, jadi
sudah membawa `platform` yang diminta; Outstand tidak pernah mengembalikan
`platform`/`network` lewat query callback). `handle` dipetakan langsung
dari `username`.

**Bukan "exchange" sama sekali** — nama method diganti dari
`exchangeConnectCode` ke `resolveConnectCallback` supaya nama tidak
menyiratkan network call server-to-server yang tidak pernah terjadi untuk
kasus ini. Implementasi real adapter murni validasi/normalisasi (semua
field wajib ada, non-empty) + decode `state` untuk `platform` — **tidak
ada HTTP call ke Outstand** di method ini untuk single-page.

#### 2. `connectAccount` (langkah 1, ADR-105) tetap valid, tidak diamandemen

Verifikasi sesi ini mengonfirmasi `connectAccount` (bentuk
`https://www.outstand.so/app/api/socials/{network}/{orgId}?redirect_uri=...`,
`state` disisipkan sebagai query param pada `redirect_uri`) sudah benar —
tidak ada perubahan di method ini. Satu-satunya penyesuaian: Fake adapter
(§4 di bawah) tidak lagi menyertakan `code` palsu di `redirectUrl`-nya,
supaya bentuk loopback Fake tetap merepresentasikan bentuk nyata (`account_id`/
`username`/`network_unique_id`, bukan `code`).

#### 3. Route Handler callback — baca query param baru, bukan `code`

`apps/web/src/app/api/integrations/outstand/callback/route.ts` diubah:

- Baca `account_id`, `username`, `network_unique_id` (opsional), `state`
  dari `request.nextUrl.searchParams` — **bukan** `code`.
- CSRF-check `state` (cookie nonce, ADR-105 poin 4) **tidak berubah** —
  tetap decode `state` lewat `decodeConnectAccountState` untuk
  `nonce`/`redirectAccountId`, tetap cocokkan cookie `outstandConnectNonceCookieName`.
- Kasus "no-op" prefetch Next.js (bug QA Najwa, T-015, dicatat di route
  yang ada): sebelumnya dicek `!code && !state`. Sekarang dicek
  `!accountId && !username && !state` (ketiganya kosong = request
  prefetch tanpa query string sama sekali → diamkan, redirect polos).
  Kalau ADA salah satu dari `accountId`/`username`/`state` tapi tidak
  lengkap ketiganya → tetap dianggap request bermasalah (`?connect=error`),
  sama seperti pola `!code || !state` sebelumnya. `network_unique_id`
  TIDAK ikut menentukan lengkap/tidaknya (opsional, sesuai §1).
- Panggilan ke `WorkspaceService` berganti dari
  `completeAccountConnection({ code, state, redirectAccountId })` menjadi
  `completeAccountConnection({ accountId, username, networkUniqueId, state, redirectAccountId })`.

#### 4. `FakeOutstandAdapter` — loopback tanpa `code`

`connectAccount` Fake sekarang membentuk `redirectUrl` loopback dengan
`account_id`/`username`/`network_unique_id` palsu (deterministik dari
`state`/seed, pola sama `buildFakeHandle`) alih-alih `code` — supaya Route
Handler yang sudah diubah tetap teruji end-to-end lewat Fake (alasan yang
sama dengan ADR-105 poin 3: loopback bukan bypass). `resolveConnectCallback`
Fake instant always-success: decode `state` untuk `platform`, terima
`outstandAccountId`/`username` apa adanya (tidak ada network call), map ke
`ConnectedAccountData` — TIDAK ada validasi tambahan di luar bentuk (Fake
tidak butuh keamanan produksi, ADR-059).

#### 5. Real adapter — validasi murni, tanpa HTTP call; Facebook eksplisit throw

`resolveConnectCallback` real adapter: decode `state` (reuse
`parseBase64UrlJson`) untuk `platform`; kalau `platform === Facebook`,
**throw eksplisit** `OutstandIntegrationError` mengarahkan ke KI-070 (Facebook
Pages tidak pernah mendarat di callback ini lewat `account_id`/`username`
langsung — Outstand mengarahkannya ke flow session-token yang berbeda
sama sekali, jadi kalaupun kontrak ini dipanggil untuk Facebook itu berarti
ada bug di tempat lain, bukan kasus yang perlu didukung senyap). Selain
itu murni validasi field wajib (`outstandAccountId`, `username`,
`state` non-empty) — tidak ada request Outstand API sama sekali,
konsisten dengan temuan §Decision.

#### 6. T-013/T-015 — tidak perlu rework mendalam sekarang

`WorkspaceService.completeAccountConnection`/`initiateConnectAccount` (T-013.1/
T-013.2/T-015.3) sudah didesain ADR-105 supaya `WorkspaceService` TIDAK
mendekode bentuk wire `state`/parameter callback sendiri — cukup ganti
signature input (`code` → `accountId`/`username`/`networkUniqueId`) dan
field yang diteruskan ke `resolveConnectCallback`. Logika CREATE vs UPDATE
`ConnectedAccount` (berdasarkan `redirectAccountId`), RBAC, dan IDOR
defense-in-depth-nya **tidak berubah sama sekali** — perubahan murni di
boundary parameter, bukan alur bisnis. Tidak ada follow-up T-013/T-015
yang diperlukan akibat ADR ini.

### Reason

* Kontrak lama (`code`+`state` exchange) adalah desain best-effort
  ADR-105 yang eksplisit menyatakan dirinya bisa salah tanpa dokumentasi
  resmi (ADR-105 poin 1) — begitu bentuk nyata terverifikasi (OpenAPI spec
  + observasi redirect langsung), rule AGENTS.md #4 mewajibkan ADR baru
  untuk mengubah baseline, bukan diam-diam menambal kode.
* Nama method diganti (`exchangeConnectCode` → `resolveConnectCallback`)
  supaya nama method mencerminkan perilaku sesungguhnya (tidak ada network
  call/"exchange" apa pun untuk single-page) — mencegah pembaca kode masa
  depan salah asumsi ada HTTP call tersembunyi di real adapter.
* `platform` tetap dari `state` (bukan dari Outstand) karena Outstand
  memang tidak pernah mengirim `network`/`platform` di query callback-nya —
  satu-satunya sumber tepercaya untuk itu adalah `state` yang kita bentuk
  sendiri di `connectAccount`, konsisten dengan prinsip ADR-105 poin 4
  (adapter yang membentuk/mendekode `state`, bukan menerima dari luar
  begitu saja).
* Split scope single-page vs multi-halaman (KI-070) mengikuti instruksi
  eksplisit King Rezi — flow Facebook Pages butuh keputusan UI/UX
  (page-selection) yang tidak bisa diputuskan backend sendirian, beda
  sifat dari amandemen kontrak murni di ADR ini.
* Throw eksplisit untuk `platform === Facebook` (bukan silent best-effort)
  mengikuti pola ADR-105/ADR-106/ADR-110 di kontrak Outstand ini: gap yang
  belum bisa diselesaikan HARUS gagal keras dengan pesan jelas, bukan
  berpura-pura berhasil dengan asumsi yang belum tentu benar.

### Alternatives Considered

* **Pertahankan nama `exchangeConnectCode`, cuma ganti bentuk input**
  (`code` → `accountId`/`username`). Ditolak — nama itu sendiri menyiratkan
  "code exchange" (network call), yang sudah terbukti tidak terjadi untuk
  single-page; mempertahankan nama lama berisiko sesi masa depan
  menambahkan network call yang tidak perlu karena "namanya begitu".
* **Satu kontrak universal yang menangani single-page maupun
  multi-halaman sekaligus** (union type/optional session-token field).
  Ditolak untuk sekarang — scope eksplisit King Rezi membatasi ke
  single-page saja; memaksa desain universal sebelum UI page-selection
  Facebook ada berisiko menebak bentuk yang keliru (sama seperti kegagalan
  ADR-105 awal). KI-070 akan mendesain kontrak Facebook terpisah setelah
  UI-nya jelas.
* **`resolveConnectCallback` tetap memanggil endpoint Outstand untuk
  validasi/enrich data akun** (mis. `GET /v1/social-accounts/{id}`)
  meski tidak wajib. Ditolak — YAGNI (prinsip yang sama dipakai
  `IOutstandAdapter` sejak ADR-059/redesain 2026-08-26): tidak ada
  kebutuhan konkret sekarang untuk data tambahan di luar
  `account_id`/`username`, dan menambah network call yang tidak perlu
  hanya menambah titik gagal.

### References

* KI-067 (`PROJECT_STATE.md` § Known Issues) — temuan awal gap.
* KI-070 (baru, dicatat Gibran Project Manager) — flow multi-halaman
  Facebook Pages, di luar scope ADR ini.
* ADR-105 — kontrak asli `connectAccount`/`exchangeConnectCode` yang
  diamandemen ADR ini (poin 2, 4 khususnya).
* ADR-040 — kontrak resmi Outstand.
* `apps/web/src/lib/adapters/outstand/real-outstand-adapter.ts` —
  docstring gap (ditulis sesi T-025 2026-09-23, sebelum ADR ini) yang jadi
  dasar temuan; implementasi `resolveConnectCallback` real adapter.
* `apps/web/src/lib/adapters/outstand/fake-outstand-adapter.ts` — Fake
  loopback baru.
* `packages/shared/src/contracts/outstand-adapter.ts` — kontrak final
  `ConnectCallbackInput`/`resolveConnectCallback`.
* `apps/web/src/app/api/integrations/outstand/callback/route.ts` — Route
  Handler yang membaca query param baru.
* `tasks/v02-publishing-mvp.md` § T-025 (T-025.4).
