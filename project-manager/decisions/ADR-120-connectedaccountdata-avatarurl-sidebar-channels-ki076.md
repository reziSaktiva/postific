## Decision ADR-120

### Title

`avatarUrl` di `ConnectedAccountData`/`ConnectedAccountRecord`/`SidebarChannelAccount` + network call tambahan `resolveConnectCallback` (amandemen ADR-112) — menutup backend KI-076

### Status

Accepted

### Date

2026-09-26

### Decision

KI-076: avatar/foto profil akun Instagram & Facebook tidak pernah tampil di
sidebar Channels. Root cause terkonfirmasi King Rezi (retest browser akun
nyata) — field avatar tidak pernah didesain masuk ke pipeline data di 5
lapisan (kontrak ACL → adapter → Prisma schema → domain type → UI). ADR ini
menutup 4 dari 5 lapisan (backend); lapisan ke-5 (UI
`ChannelsSection.tsx`) di luar scope, dikerjakan Mark UI Engineer terpisah
memakai kontrak final yang dikunci di sini.

#### 1. Kontrak ACL — `ConnectedAccountData.avatarUrl`

`packages/shared/src/contracts/outstand-adapter.ts` menambah
`avatarUrl?: string | null` ke `ConnectedAccountData` (dan mendokumentasikan
ulang `ConfirmFacebookPagesResult.accounts` yang SELALU `avatarUrl: null`
dari method itu sendiri). **Field ini opsional di level TypeScript**
(`avatarUrl?:`, bukan `avatarUrl:`) — keputusan sadar untuk membatasi blast
radius: kontrak ini dipakai puluhan mock `IOutstandAdapter` di domain lain
(publishing/engagement/analytics, semuanya di luar scope KI-076 dan sedang
dikerjakan paralel oleh agent lain di sesi yang sama) yang sama sekali tidak
peduli avatar. Field wajib (`avatarUrl:`) akan memaksa update mekanis di
±15 file test lintas domain yang bukan tanggung jawab task ini. Kedua
implementasi NYATA (`resolveConnectCallback`, `confirmFacebookPagesConnection`
di `real-outstand-adapter.ts`) tetap SELALU mengisinya secara eksplisit
(`null` atau URL) — opsional di kontrak murni kompatibilitas mock lama,
bukan izin mengabaikannya di kode produksi baru.

Pola yang sama diulang untuk `ConnectedAccountRecord.avatarUrl` (domain
`workspace`, `workspace.repository.ts`) dan parameter `avatarUrl` di
`createConnectedAccount`/`createConnectedAccounts`/`reconnectAccount` —
semuanya opsional di level TypeScript, tapi implementasi Prisma nyata
(`lib/repositories/workspace/workspace.repository.ts`) selalu menormalkan
`avatarUrl ?? null` sebelum menulis ke DB.

`SidebarChannelAccount.avatarUrl` (domain `workspace/types.ts`, dipakai UI)
SEBALIKNYA **wajib** (`avatarUrl: string | null`, bukan opsional) — ini
adalah kontrak akhir yang dikonsumsi Mark UI Engineer, harus selalu ada.
`WorkspaceService.listSidebarChannels` menormalkan `?? null` saat memetakan
dari `ConnectedAccountRecord` (opsional) ke `SidebarChannelAccount` (wajib).

#### 2. Adapter — `resolveConnectCallback` (amandemen ADR-112)

**Mengubah invariant asli ADR-112** ("`resolveConnectCallback` TIDAK ada
network call ke Outstand sama sekali"). Setelah validasi callback params
lolos, method ini sekarang melakukan SATU network call tambahan
`GET /v1/social-accounts/{outstandAccountId}` untuk mengambil foto profil.
Ini disengaja dan dicatat di sini (bukan regresi diam-diam) — ADR-112 benar
bahwa Outstand tidak punya endpoint "exchange code" untuk single-page
account, tapi endpoint TERPISAH untuk detail akun tetap ada dan dipakai di
sini murni untuk foto, bukan untuk data yang sudah didapat dari query
param callback.

**Verifikasi field:** dilakukan langsung lewat MCP resmi `mcp.outstand.so`
(tool `get_social_account`/`list_social_accounts`, sesi 2026-09-26) terhadap
data akun NYATA di org Outstand (bukan tebakan) — response:
`{ success: true, data: { id, ..., profile_picture_url: string | null, ... } }`.
Contoh nyata: akun Facebook Page mengembalikan
`profile_picture_url: "https://scontent-....fbcdn.net/..."`; akun Instagram
personal di org yang sama mengembalikan `profile_picture_url: null` (foto
memang kosong di akun test itu, bukan bug parsing).

**Path exact `GET /v1/social-accounts/{id}` DIINFERENSI**, bukan
dikonfirmasi dari OpenAPI JSON — `api.outstand.so/openapi.json` tetap tidak
bisa diakses via WebFetch (limitasi yang sama persis dengan sesi-sesi
sebelumnya, ADR-116/ADR-118). Inferensi berdasar: (a) endpoint list resmi
`GET https://api.outstand.so/v1/social-accounts` terkonfirmasi via
WebFetch ke docs resmi outstand.so, (b) tool MCP `get_social_account`
menerima `account_id` tunggal (konsisten dengan REST get-by-id), (c) pola
path serupa sudah dipakai di adapter ini untuk endpoint lain (mis.
`GET /v1/pinterest/accounts/{id}/boards`). **Ini gap yang belum
terverifikasi 100%** — kalau path ternyata salah di produksi, kegagalan
panggilan DITELAN oleh try/catch (lihat poin berikutnya), avatar tetap
`null`, TIDAK menggagalkan connect account. Perlu diverifikasi ulang kalau
suatu saat OpenAPI JSON resmi bisa diakses.

**Best-effort, bukan wajib** — kegagalan panggilan foto profil (404,
network error, timeout, field hilang) SELALU jatuh ke `avatarUrl: null`,
tidak pernah dilempar sebagai error yang menggagalkan connect account itu
sendiri. Ini keputusan teknis (ketahanan alur connect terhadap satu field
non-kritikal), bukan pola arsitektur baru — konsisten dengan filosofi
best-effort yang sudah ada di kontrak ini untuk `deletePost`/
`cancelScheduledPost`.

#### 3. Adapter — Facebook Pages (`confirmFacebookPagesConnection`)

`listPendingFacebookPages` SUDAH menangkap `pictureUrl` (dari wire
`profilePictureUrl`, ADR-116) sejak awal — gap-nya HANYA di
`confirmFacebookPagesConnection`, yang membangun `ConnectedAccountData` dari
response `finalize` (`GET/POST .../pending/{sessionToken}/finalize`) yang
TIDAK PERNAH membawa foto sama sekali. Method adapter ini sekarang SELALU
mengisi `avatarUrl: null` secara eksplisit (bukan dibiarkan `undefined`) —
adapter TIDAK menggabungkan foto sendiri karena data foto ada di response
CALL LAIN (`listPendingFacebookPages`), dan adapter tidak boleh menyimpan
state lintas panggilan (ACL boundary).

Join balik dilakukan di `WorkspaceService.confirmFacebookPagesConnection`:
method ini memanggil `adapter.listPendingFacebookPages({ sessionToken })`
LAGI (GET, read-only) SEBELUM memanggil `finalize`, membangun
`Map<pageId, pictureUrl>`, lalu mencocokkan `pictureUrl` ke
`ConnectedAccountData.outstandAccountId` hasil finalize. Asumsi
`pageId === outstandAccountId` (antara response list dan response finalize)
ini SAMA PERSIS dengan asumsi yang SUDAH dipakai `selectConfirmedFacebookAccounts`
di adapter (irisan pertama, fallback tetap aman) — bukan asumsi baru.
Kegagalan re-fetch `listPendingFacebookPages` (best-effort, sesi kadaluwarsa
di antara langkah) jatuh ke `avatarUrl: null` untuk SEMUA Page yang
dikonfirmasi batch itu, TIDAK menggagalkan proses connect Page yang
sebenarnya.

**Kenapa re-fetch, bukan meneruskan data dari UI/Server Action:** opsi lain
(dialog picker `FacebookPagesPickerDialog.tsx` meneruskan `pictureUrl` yang
sudah dimilikinya lewat Server Action) juga valid, tapi memaksa perubahan
di `actions.ts` + komponen dialog — di luar batas aman task ini (agent lain
sedang bekerja paralel di area UI/dialog terkait dalam sesi yang sama).
Re-fetch dari `WorkspaceService` menjaga seluruh perubahan 100% di lapisan
backend (kontrak, adapter, service, repository, schema) tanpa menyentuh
Server Action atau komponen React sama sekali.

#### 4. Prisma schema — kolom `avatar_url`

`WorkspaceConnectedAccount.avatarUrl String? @map("avatar_url")` —
mengikuti pola persis `StartPagePage.avatarUrl`. Migration
`20260926090000_ki076_add_avatar_url_to_workspace_connected_accounts`
(single `ALTER TABLE ... ADD COLUMN "avatar_url" TEXT;`, nullable, tanpa
default/backfill — akun existing tetap valid tanpa foto sampai
di-reconnect).

**Migration file dibuat TAPI SENGAJA TIDAK diterapkan ke database mana pun**
(local/shadow/staging), berbeda dari instruksi baku "generate + jalankan di
local/shadow db". Alasan: (a) worktree sesi ini tidak punya Postgres lokal
maupun Docker terinstal untuk shadow db; (b) `ctx-technical-context.md`/
ADR-081 menetapkan "local" project ini SENGAJA menumpang ke project
Supabase **staging** yang sama (`ndcrkzqgqukqfmekgoze`, tidak ada isolasi)
— berarti `bun run db:migrate` (`prisma migrate dev`) akan APPLY LANGSUNG ke
staging; (c) sesi ini berjalan **paralel** dengan agent lain (KI-073) di
worktree/branch yang sama, memodifikasi domain lain secara bersamaan —
menjalankan migrate ke staging shared DB dari sesi paralel berisiko
race/interleave dengan migrasi skema lain yang mungkin berjalan bersamaan.
`prisma migrate diff` (yang read-only murni) juga tidak bisa dipakai untuk
generate SQL dari `--from-migrations` tanpa shadow DB nyata
(`--from-migrations` mensyaratkan `shadowDatabaseUrl` untuk replay migrasi).
Migration SQL karena itu ditulis manual mengikuti pola persis migrasi
`ADD COLUMN` sejenis di repo ini (mis.
`20260909024403_t034_4_retry_outstand_post_id`) — `bunx prisma validate`
dan `bunx prisma generate` (keduanya tidak butuh koneksi DB) sudah
dijalankan dan lolos, memverifikasi schema.prisma + migration.sql
konsisten satu sama lain secara sintaksis, tapi migrasi INI BELUM PERNAH
dieksekusi terhadap database nyata mana pun. King Rezi/Gibran perlu
menjalankan `bun run db:migrate` (atau `db:deploy`) secara eksplisit —
idealnya setelah sesi paralel lain selesai — sebelum kolom `avatar_url`
benar-benar ada di database.

#### 5. Domain type — `SidebarChannelAccount` + wiring

`apps/web/src/domains/workspace/types.ts` menambah
`avatarUrl: string | null` (wajib). `WorkspaceService.listSidebarChannels`
memetakan dari `ConnectedAccountRecord.avatarUrl` (via
`repository.listConnectedAccounts`, yang otomatis membawa kolom Prisma baru
karena query tanpa `select` eksplisit).

### Consequences

- Menutup 4 dari 5 lapisan backend **KI-076**. Lapisan ke-5 (UI
  `ChannelsSection.tsx`, render `avatarUrl` di sidebar) **belum
  dikerjakan** — scope Mark UI Engineer, kontrak `SidebarChannelAccount.avatarUrl`
  di atas sudah final untuk dikonsumsi.
- **Gap terbuka #1:** path exact `GET /v1/social-accounts/{id}` untuk
  `resolveConnectCallback` diinferensi (bukan diverifikasi OpenAPI JSON
  resmi) — kalau salah, avatar single-page (Instagram/X/dst) akan selalu
  `null` secara silent (tidak error, tidak terlihat sebagai bug kecuali
  dites manual dengan foto profil yang seharusnya ada). Perlu retest
  browser nyata untuk memverifikasi (di luar scope sesi ini — Najwa QA atau
  King Rezi).
- **Gap terbuka #2:** migration Prisma belum diterapkan ke database mana
  pun (lihat poin 4) — kolom `avatar_url` TIDAK ADA di staging sampai
  migration dijalankan manual.
- Kolom baru nullable tanpa backfill — akun yang sudah terhubung SEBELUM
  migrasi ini tetap tanpa foto sampai user melakukan Reconnect (yang akan
  mengisi ulang `avatarUrl` lewat jalur `resolveConnectCallback`/
  `reconnectAccount`).
- `avatarUrl` opsional (bukan wajib) di `ConnectedAccountData`/
  `ConnectedAccountRecord` — desain sadar untuk membatasi blast radius ke
  domain lain yang sedang dikerjakan paralel; `SidebarChannelAccount.avatarUrl`
  tetap wajib sebagai kontrak akhir ke UI.
- Test baru: `real-outstand-adapter.test.ts` (avatar fetch + best-effort
  fallback untuk `resolveConnectCallback`; `avatarUrl: null` eksplisit untuk
  `confirmFacebookPagesConnection`), `workspace.service.test.ts` (forward
  avatarUrl create/reconnect; join balik pictureUrl Facebook Pages +
  fallback saat re-fetch gagal; mapping ke `SidebarChannelAccount`). Seluruh
  suite (`bun run typecheck` + `lint` + `vitest run`, 574 test) lolos tanpa
  menyentuh file domain lain (publishing/engagement/analytics) yang sedang
  dikerjakan paralel.

### Related

- KI-076 (backend Resolved oleh ADR ini; UI belum)
- ADR-112 (amandemen — invariant "tanpa network call" `resolveConnectCallback` tidak lagi berlaku mutlak)
- ADR-115/ADR-116 (Facebook Pages session-token flow, `FacebookPendingPage.pictureUrl`)
- ADR-081 (local menumpang staging — alasan migration tidak diterapkan)
- `packages/shared/src/contracts/outstand-adapter.ts`,
  `apps/web/src/lib/adapters/outstand/real-outstand-adapter.ts`,
  `apps/web/src/domains/workspace/`,
  `apps/web/prisma/schema.prisma` +
  `apps/web/prisma/migrations/20260926090000_ki076_add_avatar_url_to_workspace_connected_accounts/`
