## Decision ADR-099

### Title

SECURITY DEFINER System-Context Lookup untuk Webhook Outstand (T-026)

### Status

Accepted

### Date

2026-09-07

### Context

Route `/api/webhooks/outstand` (T-026) menerima event eksternal langsung
dari Outstand (`post.published`, `post.error`, `account.token_expired`) —
**tidak ada** Better Auth session, dan karena itu **tidak ada** `userId`
acting user untuk di-set lewat `withCurrentUser()`.

RLS pada `publishing_posts`, `publishing_post_targets`, dan
`workspace_connected_accounts` (migration `20260813045625_t017_add_rls_policies`)
mewajibkan `current_setting('app.current_user_id', true)` cocok dengan
baris `workspace_members` yang aktif. `DATABASE_URL` terkoneksi sebagai
role `app_runtime` yang non-`BYPASSRLS` (KI-026) — jadi query polos tanpa
session GUC yang di-set akan mengembalikan **nol baris** (default-deny).

Masalahnya bersifat ayam-telur: webhook processor butuh melakukan lookup
awal (cari post/akun dari `outstandPostId`/`outstandAccountId` yang
dikirim Outstand di payload) untuk **menemukan** `userId` yang sah dipakai
(`authorId` post untuk event publish, Owner workspace untuk event akun) —
tapi lookup itu sendiri tidak bisa lewat `withCurrentUser` karena belum
ada `userId` untuk di-pass sebelum lookup selesai.

### Decision

1. **Dua fungsi Postgres baru, `SECURITY DEFINER`**, dibuat khusus untuk
   lookup awal ini (migration `20260907120000_t026_outstand_webhook_system_lookups`):
   - `webhook_find_post_targets_by_outstand_post_id(p_outstand_post_id text)`
     — resolve `post_id`/`workspace_id`/`author_id` + seluruh
     `publishing_post_targets` terkait, exact-match pada
     `publishing_posts.outstand_post_id`.
   - `webhook_find_account_owner_by_outstand_account_id(p_outstand_account_id text)`
     — resolve `workspace_id`/`connected_account_id`/`owner_user_id`
     (dibaca langsung dari `workspaces.owner_id`), exact-match pada
     `workspace_connected_accounts.outstand_account_id`.
2. **Preseden yang direuse, bukan pola baru dari nol:** mekanisme
   `SECURITY DEFINER` (fungsi berjalan sebagai owner tabel, efektif
   bypass RLS hanya untuk isi fungsi itu sendiri) sudah dipakai di
   codebase ini untuk `current_user_workspace_ids()` (migration
   `20260813073556_t017_fix_workspace_members_rls_recursion`) dan
   `current_invite_lookup_token()`/`has_accepted_invitation` (ADR-096).
   ADR ini menetapkan pola yang sama untuk kasus "sistem butuh baca tanpa
   acting user" secara umum, bukan hanya untuk T-026.
3. **Scope sempit — exact-match lookup saja, bukan listing/broad query.**
   Kedua fungsi hanya menerima 1 parameter id eksternal dan mengembalikan
   baris yang cocok persis id itu — tidak ada kemampuan untuk
   enumerasi/scan data lintas tenant.
4. **`EXECUTE` direvoke dari `PUBLIC`, hanya di-grant ke role
   `app_runtime`.** Berbeda dari `current_user_workspace_ids()` (aman
   dibiarkan `PUBLIC`-executable karena bergantung pada session GUC yang
   tidak pernah di-set oleh caller PostgREST), kedua fungsi baru ini
   **tidak** bergantung pada session state — kalau dibiarkan
   `PUBLIC`-executable, Supabase PostgREST akan otomatis meng-expose-nya
   sebagai `/rest/v1/rpc/...` dan mengizinkan **siapa pun** (anon atau
   authenticated) membaca data lintas-tenant hanya dengan
   menebak/mengetahui `outstand_post_id`/`outstand_account_id` —
   sepenuhnya melewati RLS. Grant dijaga defensif (`DO $$ ... IF EXISTS
... $$`) supaya migration tidak gagal terhadap shadow/local DB yang
   tidak punya role `app_runtime`.
5. **Bypass RLS hanya di jalur BACA, tidak pernah di jalur TULIS.** Setelah
   lookup ini resolve `userId` yang sah, `OutstandWebhookProcessor`
   memakai `userId` itu untuk memanggil ulang method repository yang
   SUDAH ada dan tetap dibungkus `withCurrentUser` normal
   (`updateTargetOutcome`, `markPostFailed`, update
   `reconnectRequired`/`account.token_expired`) — jadi RLS tetap
   sepenuhnya berlaku untuk semua operasi mutasi.
6. **Defense-in-depth tambahan (migration `20260907130000_t026_unique_outstand_post_id`):**
   partial unique index global pada `publishing_posts.outstand_post_id`
   (`WHERE outstand_post_id IS NOT NULL AND deleted_at IS NULL`) — kolom
   ini sebelumnya **tidak** punya constraint unique sama sekali (berbeda
   dari `WorkspaceConnectedAccount.outstandAccountId` yang setidaknya
   unique per-workspace). Tanpa index ini, dua post (apalagi di workspace
   berbeda) yang kebetulan punya `outstand_post_id` sama bisa membuat
   fungsi lookup mencampur baris dari post/tenant yang berbeda. Index
   sengaja **global** (bukan di-scope per `workspace_id`) karena kontrak
   ADR-092 memodelkan `outstand_post_id` sebagai satu id post-level yang
   diterbitkan Outstand secara global, bukan per-tenant. Ditambah guard
   assert eksplisit di kode repository (`findPostTargetsByOutstandPostId`)
   yang throw kalau hasil query ternyata lintas post/workspace berbeda —
   lapis kedua di atas constraint DB.

### Reason

- Webhook eksternal secara fundamental tidak punya acting user — mekanisme
  `withCurrentUser`/session GUC yang dipakai di seluruh entry point lain
  (Server Action, Route Handler ber-session) tidak applicable di sini,
  tapi RLS tetap wajib berlaku (bukan alasan untuk mematikan RLS).
- Menyempitkan scope ke exact-match by external id (bukan query umum) dan
  mengunci grant `EXECUTE` ke role `app_runtime` saja meminimalkan
  permukaan serangan — konsisten dengan filosofi RLS sebagai lapisan
  pertahanan terakhir di `database-strategy.md`, bukan sekadar
  mempermudah lookup.
- Reuse pola `SECURITY DEFINER` yang sudah ada (bukan menciptakan
  mekanisme baru) mengurangi variasi pola keamanan yang perlu diaudit di
  masa depan, dan review arsitektur Ridwan sudah familiar dengan bentuk
  ini dari ADR-096.
- Partial unique index + guard assert ditambahkan setelah temuan
  "plausible" review Ridwan — tanpa constraint DB, asumsi "Outstand pasti
  generate id unik secara global" tidak pernah benar-benar ditegakkan.

### Alternatives Considered

- **Service role / connection terpisah dengan `BYPASSRLS` untuk seluruh
  webhook processor** — ditolak; terlalu luas (bypass RLS untuk semua
  query, bukan cuma lookup awal), meningkatkan blast radius kalau ada bug
  di processor.
- **Menyimpan `userId` sistem generik (mis. "system user") dan memakainya
  lewat `withCurrentUser` biasa** — ditolak; tidak menyelesaikan masalah
  inti (RLS existing memvalidasi `userId` itu terhadap `workspace_members`
  aktif, "system user" tidak akan pernah jadi member workspace manapun,
  jadi tetap default-deny).
- **Membiarkan `outstand_post_id` tanpa unique constraint (mengandalkan
  asumsi id Outstand pasti unik)** — ditolak setelah temuan review Ridwan;
  constraint DB eksplisit lebih aman daripada asumsi terhadap sistem
  eksternal yang tidak kita kontrol skemanya.

### Impact / Baseline yang diamandemen

- `apps/web/prisma/migrations/20260907120000_t026_outstand_webhook_system_lookups/`
  — 2 fungsi `SECURITY DEFINER` baru + revoke/grant `EXECUTE`.
- `apps/web/prisma/migrations/20260907130000_t026_unique_outstand_post_id/`
  — partial unique index `publishing_posts_outstand_post_id_unique`.
- `apps/web/src/lib/repositories/publishing/publishing.repository.ts` —
  `findPostTargetsByOutstandPostId` (guard assert cross-tenant) memakai
  fungsi baru ini.
- `apps/web/src/domains/publishing/services/outstand-webhook-processor.ts`
  — konsumen utama pola ini.
- Tidak mengamandemen `database-strategy.md` secara langsung — pola ini
  dicatat sebagai referensi implementasi di `tickets/v02-publishing-mvp.md`
  § T-026 dan dijadikan preseden eksplisit untuk **T-027** (job runner)
  saat butuh akses sistem serupa tanpa acting user — reuse fungsi yang
  sama, jangan diciptakan ulang.

---
