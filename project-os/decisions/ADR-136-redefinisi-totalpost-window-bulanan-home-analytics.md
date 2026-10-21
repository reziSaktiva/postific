## Decision ADR-136

### Title

Redefinisi Sumber `totalPosts` Home (DB Internal, bukan Outstand
`posts_count`) dan Window Kalender Bulan untuk Periode "Bulanan"
Home/Analytics

### Status

Accepted

### Date

2026-10-21

### Decision

Dua definisi metric dashboard yang terlihat user diubah, hasil investigasi
King Rezi atas ketidaksesuaian data Supabase vs Outstand (2026-10-19/21,
melahirkan KI-093/094/095/096, tiket T-130/T-134/T-135/T-136):

**1. Sumber `totalPosts` Home pindah dari Outstand `posts_count` ke status
internal `PublishingPost` (T-130/T-136, KI-093/KI-096).**

`AnalyticsIngestionUseCase.syncWorkspaceSnapshot`
(`apps/web/src/domains/analytics/services/analytics-ingestion.use-case.ts`)
tidak lagi menjumlahkan field `data.posts_count` dari
`IOutstandAdapter.fetchWorkspaceMetrics` per akun untuk mengisi
`totalPosts` di `AnalyticsWorkspaceSnapshot`. Sumber baru: port
`TerminalPostsCountPort.countTerminalPosts({ workspaceId, since, until },
userId)` — interface lokal structural typing (pola sama `ActiveAccountsPort`)
yang diimplementasikan `IPublishingRepository.countTerminalPosts`
(`tx.publishingPost.count` dengan filter `status: { in:
HISTORY_TERMINAL_STATUSES }` yaitu `Published`/`Failed`/`Imported`, dan
`publishedAt` half-open `[since, until)` — konsisten `listHistory`/
`getPostPerformance`). Post `Failed` punya `publishedAt` yang di-null-kan
(KI-081) sehingga efektif hanya `Published`+`Imported` yang terhitung.
`totalReach`/`totalEngagements` Home **tidak** berubah, tetap dari Outstand.

**Granularitas Home vs Analyze TIDAK disamakan — diterima sebagai definisi
yang memang berbeda (King Rezi, via `AskUserQuestion`, 2026-10-21):** port
baru ini menghitung baris `PublishingPost` distinct ("jumlah post"), BUKAN
baris post × target seperti `PublishingService.getAnalyzeSummary.totalPosts`
(Analyze menghitung target berstatus `published` per post, jadi satu post
yang dipublish ke beberapa akun dihitung berkali-kali). Untuk post
single-platform kedua angka sama; untuk post multi-akun, angka Home akan
lebih kecil dari Analyze. King Rezi memutuskan ini **tidak perlu** dipaksa
match persis — Home mengartikan "post" sebagai satu konten, Analyze
mengartikan "post" sebagai satu slot publish per akun, keduanya valid untuk
konteksnya masing-masing.

**2. Window snapshot "bulanan" pindah dari rolling 30 hari ke kalender bulan
(T-135, KI-095).**

`resolveAnalyticsSnapshotWindow`
(`apps/web/src/domains/analytics/services/analytics-sync-job-handler.ts`)
cabang `monthly`: `periodStart` sekarang tanggal 1 bulan berjalan jam
00:00:00 UTC (`Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0,
0)`), `periodEnd` tetap `now` (TIDAK dimajukan ke akhir bulan kalau bulan
belum selesai) — menggantikan window lama rolling 30 hari dari `now`. Window
`weekly` tidak berubah (tetap rolling 7 hari). Perubahan ini membuat angka
"bulan ini" Home/Analyze bisa dibandingkan apple-to-apple dengan dashboard
native Outstand, yang memakai kalender bulan.

**Label UI tidak berubah.** `DashboardHome.tsx` (`StatTile label="Post
terpublikasi"`, `value={summary.totalPosts}`) tidak disentuh — King Rezi
memilih (T-136.1) mengganti SUMBER data (poin 1 di atas) alih-alih mengganti
teks label jadi lebih "jujur" (mis. "Post di akun terhubung"), karena sumber
baru sudah akurat secara makna untuk label yang sudah ada.

**Backfill snapshot lama — segera, bukan menunggu siklus alami (King Rezi,
2026-10-21).** Baris `AnalyticsWorkspaceSnapshot` yang ditulis sebelum
perubahan ini (window rolling 30 hari) di-backfill manual untuk seluruh 13
workspace pada 2026-10-21, bukan dibiarkan "basi" menunggu job cron
`analytics.sync` berikutnya menimpanya secara alami. Eksekusi backfill
dilakukan coordinator secara operasional (bukan kode/tiket baru).

### Reason

- Dicek dokumentasi resmi Outstand `GET /v1/social-accounts/{id}/metrics`
  (raw HTML docs, bukan ringkasan, 2026-10-21): baris Facebook hanya
  menyebut "page followers/fans, engagement (impressions, reach,
  post_engagements)" — `posts_count` **tidak disebut sama sekali** untuk
  Facebook. Pinterest dan BlueSky eksplisit disebut, contoh JSON
  `posts_count: 150` di docs memakai `"network": "tiktok"`, bukan Facebook.
  Live test MCP `outstand` (2026-10-19) mengonfirmasi `posts_count: null`
  untuk akun Facebook Page nyata ("Cook It Real Good") sementara
  `engagement.reach`/`engagement.likes` di response yang sama tetap valid —
  field ini memang tidak didukung/didokumentasikan Outstand untuk Facebook
  Page, bukan bug sementara yang perlu ditunggu konfirmasi vendor.
- User melaporkan Outstand dashboard menunjukkan 12 post bulan ini sedangkan
  Home menunjukkan 3 — investigasi membuktikan window rolling 30 hari adalah
  salah satu kontributor (bukan satu-satunya, lihat juga T-130/T-134) karena
  tidak bisa dibandingkan apple-to-apple dengan kalender bulan yang dipakai
  dashboard native Outstand.
- Keduanya (sumber data, window) adalah definisi metric/periode yang
  langsung terlihat user di Home dan Analyze — perubahan material terhadap
  business requirement dashboard, bukan sekadar detail implementasi internal,
  sehingga dicatat sebagai ADR per konvensi project (AGENTS.md aturan 2).

### Alternatives Considered

- **Tetap pakai `posts_count` Outstand, hanya ganti label jadi lebih jujur**
  (mis. "Post di akun terhubung") — ditolak King Rezi (T-136.1); sumber data
  yang terbukti tidak reliable (null untuk Facebook Page) tetap jadi akar
  masalah meskipun labelnya diperbaiki.
- **Paksa granularitas Home match persis dengan Analyze (post × akun-target)**
  — dipertimbangkan sebagai opsi follow-up kalau King Rezi ingin angka match
  persis di semua skenario (bukan cuma single-platform); ditolak/tidak
  diperlukan — King Rezi menerima beda granularitas sebagai definisi yang
  memang berbeda, bukan bug.
- **Window "bulanan" tetap rolling 30 hari** — ditolak King Rezi (T-135.1);
  tidak bisa dibandingkan dengan dashboard native Outstand yang memakai
  kalender bulan, sumber kebingungan user yang dilaporkan langsung.
- **Window "bulanan" dimajukan ke akhir bulan (`periodEnd` = akhir bulan,
  bukan `now`)** — ditolak secara implisit; `periodEnd = now` dipilih supaya
  angka "bulan ini" mencerminkan progres real-time bulan berjalan, konsisten
  perilaku snapshot window lain (`weekly`).
- **Snapshot lama dibiarkan basi, menimpa otomatis lewat siklus cron
  `analytics.sync` berikutnya** — ditolak King Rezi; dipilih backfill segera
  manual untuk seluruh 13 workspace supaya data production langsung
  konsisten dengan formula baru, bukan menunggu jadwal alami yang tidak
  pasti kapan selesai untuk semua workspace.
- **Panggil Outstand `DELETE /v1/social-accounts/{id}` saat disconnect**
  (dipertimbangkan di scope awal T-134) — ditolak eksplisit King Rezi;
  endpoint ini irreversible ("Cannot be undone... to reconnect, you will
  need to complete the full OAuth flow again", OpenAPI resmi Outstand) dan
  berkonflik langsung dengan flow reaktivasi ADR-127 yang menghidupkan
  kembali row `disconnected`/`reconnect-required` tanpa OAuth ulang. Scope
  T-134 direvisi jadi trigger recompute `AnalyticsWorkspaceSnapshot` saja,
  tanpa kontrak Outstand baru — **tidak mengamendemen** ADR-048/ADR-049
  (`WorkspaceService.disconnectAccount` sengaja tidak memanggil Outstand),
  keduanya tetap berlaku apa adanya.

### Related

- Menutup T-130 (KI-093), bagian T-134 (KI-094 — lihat `Alternatives
Considered` untuk opsi yang ditolak), T-135 (KI-095), T-136 (KI-096).
  Detail implementasi, checklist, dan status verifikasi E2E browser tertunda
  ada di `tickets/known-issues.md`.
- ADR-048, ADR-049 — disconnect akun tidak memanggil Outstand API. Tidak
  diamendemen oleh ADR ini.
- ADR-127 — reaktivasi `WorkspaceConnectedAccount` tanpa OAuth ulang. Alasan
  utama penolakan opsi Outstand DELETE di atas.
- ADR-135 — pola serupa (perluasan kontrak berbasis temuan analytics resmi
  Outstand) untuk klasifikasi `ContentFormat`, sesi investigasi sebelumnya.

---
