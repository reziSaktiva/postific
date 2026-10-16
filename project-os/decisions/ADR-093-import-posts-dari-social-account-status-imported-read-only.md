## Decision ADR-093

### Title

Import Posts dari Social Account — status `Imported` (read-only), trigger otomatis + periodik + manual dengan pengaman biaya

### Status

Accepted

### Date

2026-08-28

### Context

Outstand API menyediakan endpoint berbayar `POST /v1/social-accounts/{id}/imports`
(docs: outstand.so/docs/import-posts-from-a-social-account) untuk menarik post
yang sudah ada di akun sosial — post yang dibuat **langsung di platform**,
bukan lewat tool kita. Sifatnya async: enqueue job, hasil diketahui lewat
polling job ID atau webhook `import.completed`/`import.failed`. Tidak
didukung untuk X/Twitter.

Baseline saat ini (`domain-model.md`, `integration-layer.md`) tidak
mengakomodasi post yang asalnya dari luar tool — `PublishingPost` hanya
pernah dibuat lewat aksi user di aplikasi ini (Create Draft →
Schedule/Publish Now). Calendar (T-033) dan History (T-034, belum
dikerjakan) karena itu tidak pernah menampilkan post yang di-posting manual
di platform.

King Rezi memutuskan (sesi diskusi 2026-08-28) untuk membangun ini sebagai
fitur terpisah dari rencana Realtime Calendar (belum ada ADR-nya, dibahas
terpisah dan belum dieksekusi), dengan scope:

1. Post hasil import tampil di **Calendar dan History**.
2. **Tiga jalur trigger:** otomatis saat `WorkspaceConnectedAccount` baru
   terkoneksi, periodik (cron), dan manual lewat Settings → Connected
   Accounts (re-trigger per akun kapan saja).
3. Post hasil import **selalu read-only** — tidak bisa diedit/dihapus/
   dijadwal ulang lewat tool kita.
4. **Karena endpoint ini berbayar**, jalur manual butuh pengaman ketat
   terhadap penyalahgunaan yang bisa membengkakkan tagihan.

King Rezi belum punya `OUTSTAND_API_KEY` asli (blocker yang sama dengan
ADR-059) — rule 19 `AGENTS.md` mewajibkan Fake adapter dulu, bukan menunda
task.

**Terkait tapi terpisah:** bug-fix "post `Published`/`Failed` dari tool kita
sendiri juga harus jadi read-only" ditemukan di sesi diskusi yang sama, tapi
sengaja ditrack sebagai task independen (bukan bagian ADR ini) — status
`Imported` di ADR ini read-only sejak lahir, bukan hasil fix.

### Decision

1. **Status domain baru** `Imported` ditambahkan ke `ContentStatus`
   (`packages/shared/src/enums.ts`): `Imported = "imported"`. Status ini
   **terminal dan immutable** — tidak ada transisi dari/ke status lain, dan
   tidak ada RBAC action (`updateDraft`, `deletePost`, `cancelSchedule`,
   `scheduleUpdate`, dst.) yang diizinkan untuk post berstatus ini. Guard
   ditegakkan di level repository (pola ADR-059 poin 6 — defense-in-depth,
   bukan cuma disembunyikan di UI).
2. **Aturan grid Calendar diamandemen** (sebelumnya di
   `v02-publishing-mvp.md` T-033: grid cuma tampilkan
   `Scheduled`/`Published`/`Failed`) — sekarang **plus `Imported`**. History
   (T-034, saat ditulis nanti) wajib menampilkan `Imported` sejak awal
   desainnya, bukan ditambah belakangan.
3. **`PublishingPost.authorId` jadi nullable** (`String?`, sebelumnya
   wajib) — invariant: `null` **hanya** kalau `status = Imported` (post
   tidak punya "penulis" internal karena dibuat di luar tool). Semua status
   lain tetap wajib punya `authorId`.
4. **Idempotency import** memakai `PublishingPostTarget.platformPostId`
   yang sudah ada dari ADR-092 — sebelum insert, cek existing target dengan
   `connectedAccountId` + `platformPostId` yang sama; kalau sudah ada, skip
   (bukan duplikat).
5. **Kontrak ACL baru** di `IOutstandAdapter`:
   - `importPosts(outstandAccountId, { since?, until?, limit? }): Promise<ImportJobHandle>`
     — mapping 1:1 ke `POST /v1/social-accounts/{id}/imports`.
   - `fetchImportJobStatus(importJobId): Promise<ImportJobOutcome>` —
     resolve status job (polling), pasangan `fetchPostOutcome` (ADR-092).
   - Default untuk trigger **awal** (on-connect): `since` = 90 hari ke
     belakang, `limit` = 100.
6. **Field watermark & cooldown baru** di `WorkspaceConnectedAccount`:
   - `lastImportedUntil` (nullable timestamp) — di-update saat `JOB-06`
     sukses menyelesaikan sebuah import; dipakai sebagai `since` untuk
     trigger periodik & manual berikutnya (bukan mengulang 90 hari tiap
     kali).
   - `lastImportRequestedAt` (nullable timestamp) — di-update setiap kali
     import **direquest** (dari jalur manapun: auto/periodik/manual);
     dipakai untuk cooldown per-akun jalur manual (poin 9).
7. **Dua job type baru** (pola sama JOB-01/JOB-02 — pemisah trigger vs
   processing):
   - **`JOB-05 — Import Posts Trigger`** (tipe `import.sync`): memanggil
     `OutstandAdapter.importPosts(outstandAccountId, { since, until: now, limit: 100 })`,
     menyimpan `importJobId` yang dikembalikan untuk tracking — tidak
     memproses hasil sendiri. Di-enqueue dari **3 sumber**:
     - **Otomatis on-connect** (sekali) — `since` = 90 hari ke belakang
       (`lastImportedUntil` masih kosong).
     - **Periodik** (Railway Cron harian `0 0 * * *`, pola sama JOB-04 —
       iterasi semua `WorkspaceConnectedAccount` `active`) — `since` =
       `lastImportedUntil` (watermark), bukan 90 hari ulang.
     - **Manual** (Server Action baru dipicu dari Settings → Connected
       Accounts, tombol "Sync Now" per akun) — `since` = `lastImportedUntil`
       juga (logika sama persis dengan periodik, cuma dieksekusi on-demand,
       bukan custom date-range — YAGNI untuk MVP).
   - **`JOB-06 — Import Posts Webhook Processing`** (tipe
     `outstand.import.process`, pola sama JOB-01): dipicu oleh receipt
     durable webhook `import.completed`/`import.failed` → upsert
     `PublishingPost`/`PublishingPostTarget` (status `Imported`, dedup via
     `platformPostId` per poin 4) → update `lastImportedUntil` ke nilai
     `until` yang dipakai job itu.
8. **Guard concurrent import per akun** — sebelum enqueue `JOB-05` baru
   untuk sebuah `connectedAccountId` (dari sumber manapun), cek dulu apakah
   ada `JOB-05` yang statusnya `pending`/`running` **atau** sudah `done`
   tapi `JOB-06` pasangannya belum `done` (masih menunggu webhook) untuk
   akun yang sama → kalau ada, **tolak** dengan pesan jelas, bukan
   diantrekan.
9. **Pengaman biaya untuk jalur manual** (endpoint ini berbayar) — 3 lapis:
   - **RBAC:** tombol manual cuma untuk role dengan hak "kelola Connected
     Accounts" — **Owner & Admin**, sesuai `roles-permissions.md` yang
     sudah ada (tidak perlu aturan RBAC baru; Creator otomatis tidak punya
     akses karena haknya cuma "baca saja").
   - **Cooldown per akun — 24 jam:** tolak manual trigger kalau
     `now() - lastImportRequestedAt < 24 jam` untuk akun itu — independen
     dari kecepatan job selesai (tetap berlaku walau `FakeOutstandAdapter`
     instan, ADR-059).
   - **Cap workspace — 1x per minggu, gabungan SEMUA akun:** sebelum
     enqueue manual trigger, hitung `COUNT(*)` baris `background_jobs`
     bertipe `import.sync` dengan `payload.trigger = "manual"` milik
     `workspaceId` itu dalam 7 hari terakhir (reuse tabel `background_jobs`
     yang sudah ada sebagai audit log — **tidak perlu skema counter baru**);
     kalau ≥ 1, **tolak** dengan pesan jelas (mis. "Sudah pakai jatah sync
     manual minggu ini, coba lagi [tanggal]"). Guard ini **paling dominan**
     — jauh lebih ketat dari cooldown per-akun.
10. **`FakeOutstandAdapter.importPosts`** (pola ADR-059: instant,
    always-success, tanpa simulasi delay/failure) mengembalikan job
    `status: "completed"` langsung dengan beberapa `PublishingPost`/
    `PublishingPostTarget` sintetis berstatus `Imported` — supaya fitur ini
    bisa dibangun & diuji penuh tanpa menunggu kredensial Outstand asli.
    Real adapter (dan real polling/webhook `import.completed`) menyusul
    saat kredensial tersedia (ikut alur T-025).
11. **UI** untuk kartu `Imported` di Calendar/History, tombol "Sync Now"
    manual di Settings → Connected Accounts (+ pesan cooldown/cap), dan
    state loading/hasil job — **belum boleh diimplementasikan** sampai
    rancangannya ada/dikonfirmasi di Claude Design (rule 17 `AGENTS.md`).

### Reason

- Data post kita sendiri (Supabase, via Prisma) adalah source of truth —
  Outstand cuma perantara publish, sehingga menarik data historis dari
  Outstand dan menyimpannya sebagai `PublishingPost` kita sendiri konsisten
  dengan prinsip itu, bukan pengecualian.
- Status baru (bukan reuse `Published`) mencegah konflik dengan task
  terpisah "Published/Failed jadi read-only" yang sedang berjalan
  independen — kalau reuse `Published`, dua task ini akan saling menyenggol
  logic yang sama tanpa perlu.
- Watermark (`lastImportedUntil`) mencegah pemborosan call ke Outstand —
  tiap sync berikutnya cuma menarik delta baru, bukan mengulang seluruh
  rentang 90 hari tiap kali, langsung berdampak ke biaya per-call.
- Cap mingguan level-workspace via reuse `background_jobs` adalah guard
  paling murah untuk diimplementasikan (tidak ada skema baru) sekaligus
  paling efektif membatasi worst-case tagihan — langsung menjawab
  kekhawatiran eksplisit King Rezi soal biaya endpoint berbayar ini.
- RBAC "kelola Connected Accounts" yang sudah ada otomatis cukup ketat
  (Owner/Admin saja) tanpa perlu aturan baru — YAGNI.
- Guard read-only & guard concurrent-import di level repository/service
  (bukan cuma UI) konsisten dengan pola defense-in-depth yang sudah dipakai
  di ADR-059/074.
- Fake adapter mengikuti presedan ADR-059/079/092 — task tidak boleh
  mandek karena kredensial eksternal belum ada (rule 19 `AGENTS.md`).

### Alternatives Considered

- **Cap workspace 5x/10x/20x per hari** — ditolak; King Rezi memilih jauh
  lebih ketat (1x/minggu gabungan seluruh akun) mengingat endpoint ini
  berbayar.
- **Counter field baru untuk cap workspace** — ditolak; reuse
  `background_jobs` sebagai audit log sudah cukup, menghindari skema
  tambahan yang cuma menduplikasi informasi yang sudah tercatat.
- **Custom date-range picker di tombol manual** — ditolak untuk MVP;
  watermark yang sama dengan periodik sudah cukup, custom range adalah
  over-engineering tanpa kebutuhan nyata sekarang.
- **Hanya trigger otomatis (tanpa manual/periodik)** — ditolak; King Rezi
  eksplisit ingin ketiga jalur tersedia.
- **Antrekan (bukan tolak) saat concurrent import** — ditolak untuk MVP;
  volume rendah, penolakan dengan pesan jelas lebih sederhana daripada
  queue-per-akun.
- **Reuse status `Published` untuk post hasil import** — ditolak;
  mencampur dua asal-usul post dengan kebutuhan RBAC berbeda, berisiko bug
  silang dengan task read-only terpisah.
- **`authorId` diisi user yang connect akun** — ditolak; butuh field baru
  (`WorkspaceConnectedAccount.connectedByUserId`) yang tidak ada gunanya
  lain, nullable lebih murah dan semantiknya tepat ("tidak ada penulis
  internal").
- **Tunda task ini sampai `OUTSTAND_API_KEY` tersedia** — ditolak, sama
  seperti ADR-059/079: Fake adapter membiarkan domain logic + schema + UI
  dikerjakan dan diuji penuh sekarang.

### Impact / Baseline yang diamandemen

- `product-discovery/05-architecture/domain-model.md` — `ContentStatus`
  bertambah 1 nilai (`Imported`), `PublishingPost.authorId` jadi opsional
  untuk kasus ini, `WorkspaceConnectedAccount` bertambah
  `lastImportedUntil`/`lastImportRequestedAt`.
- `product-discovery/06-engineering/integration-layer.md` — kontrak ACL
  baru (`importPosts`, `fetchImportJobStatus`) + event vendor baru
  (`import.completed`/`import.failed`).
- `product-discovery/05-architecture/background-jobs.md` — job type baru
  `JOB-05` (trigger) dan `JOB-06` (processing).
- `product-discovery/*/roles-permissions.md` — **tidak berubah** (RBAC
  manual trigger reuse hak existing "kelola Connected Accounts").
- `project-os/tickets/v02-publishing-mvp.md` (T-033) — aturan status
  yang muncul di grid Calendar diamandemen (tambah `Imported`).
- `realtime-strategy.md` — **tidak diubah** (fitur ini tetap
  manual-refresh untuk tampilannya di Calendar/History, terpisah dari
  diskusi Realtime Calendar sebelumnya yang belum punya ADR sendiri).
- Task baru akan ditulis ke `TASKS.md` + `tickets/v02-publishing-mvp.md`
  setelah ADR ini dikonfirmasi — termasuk subtask UI yang di-gate rule 17
  (butuh mockup Claude Design dulu sebelum kode).
- **Task terpisah** (bukan bagian ADR ini, dicatat sebagai referensi
  silang): "Post `Published`/`Failed` dari tool kita sendiri jadi
  read-only" — ditemukan di sesi diskusi yang sama, ditrack independen di
  `TASKS.md`.

---
