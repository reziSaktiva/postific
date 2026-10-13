## Decision ADR-059

### Title

Fake OutstandAdapter — persistensi nyata "Schedule" tanpa kredensial Outstand asli

### Status

Accepted — Amended by ADR-079 (2026-08-13). ADR-079 menggantikan Decision item 1 dan 4 untuk scope Analytics dan lokasi contract `IOutstandAdapter`. Amended by ADR-119 (2026-09-25): mekanisme switch poin 3 (fallback Fake saat `OUTSTAND_API_KEY` kosong) diganti — factory hanya mengembalikan Real adapter; tanpa key throw; kelas produksi `FakeOutstandAdapter` dihapus. Poin 5 dan 6 tidak dicabut.

### Date

2026-08-03

### Decision

King Rezi belum punya `OUTSTAND_API_KEY`/`OUTSTAND_WEBHOOK_SECRET` asli dari
Outstand, sehingga integrasi publishing sungguhan (ADR-040) tertahan. Next
Tasks direorder: bikin Fake/mock `OutstandAdapter` dulu supaya fitur
"Schedule" di Draft Editor bisa lanjut dikerjakan dan diuji tanpa menunggu
kredensial asli.

1. **Scope:** implementasi Fake adapter **hanya** mencakup method Publishing
   (`schedulePost`). Engagement (comments), Analytics (metrics), dan
   `connectAccount` OAuth **di luar scope** — akan ditambah bertahap saat
   domain itu benar-benar dikerjakan (YAGNI), bukan dibangun sekaligus di
   awal.
2. **Fidelitas:** instant always-success. Fake adapter tidak mensimulasikan
   delay, webhook, maupun skenario gagal.
3. **Switch mechanism:** auto-detect dari env. `getOutstandAdapter()`
   (`apps/web/src/lib/adapters/outstand/index.ts`) memakai `FakeOutstandAdapter`
   kalau `OUTSTAND_API_KEY` kosong. Kalau env sudah terisi tapi real adapter
   belum ada kodenya, factory **throw error jelas** (bukan diam-diam tetap
   memakai Fake) — supaya nanti saat ADR-040 (real adapter) diimplementasikan
   dan seseorang lupa update factory ini, kegagalan terjadi **loud**, bukan
   silent.
4. **Lokasi kontrak:** `IOutstandAdapter` didefinisikan di domain `publishing`
   dulu (satu-satunya pemakai saat ini), bukan di lokasi cross-domain —
   dipromosikan nanti kalau Workspace (`connectAccount`)/Engagement/Analytics
   benar-benar membutuhkannya.
5. **Pola arsitektur baru — Use Case terpisah untuk dependency tambahan:**
   `SchedulePostsUseCase` (bukan method tambahan di `PublishingService`)
   dipakai untuk operasi yang butuh dependency di luar `IPublishingRepository`
   (yaitu `IOutstandAdapter`) — supaya constructor `PublishingService` tetap
   sederhana untuk operasi CRUD draft biasa (tidak ada parameter opsional yang
   bisa lupa di-pass), sementara operasi yang butuh adapter punya
   constructor-nya sendiri yang type-safe. Ini precedent baru yang relevan
   dipakai lagi untuk `PublishNowUseCase`/`CancelScheduleUseCase` (ADR-047/
   ADR-049) nanti.
6. **Guard ownership di level repository:** validasi `connectedAccountId`
   milik `workspaceId` yang sama ditegakkan di dalam transaksi Prisma
   `IPublishingRepository.schedulePost` — bukan hanya di Server Action —
   supaya mencegah IDOR cross-workspace untuk entry point manapun di masa
   depan (termasuk API mobile ADR-043 nanti), bukan hanya web.

### Reason

* Kredensial Outstand asli belum tersedia dan bergantung pada pihak
  eksternal (Outstand) — memblokir seluruh alur "Schedule" di Draft Editor
  kalau harus menunggu, padahal domain logic dan persistensi Prisma-nya bisa
  dikerjakan dan diuji sepenuhnya tanpa network call sungguhan.
* Scope minimal (hanya `schedulePost`) menghindari over-engineering — domain
  Engagement/Analytics/OAuth belum dikerjakan, jadi kontrak method-nya di
  `IOutstandAdapter` bisa berubah bentuk begitu domain itu benar-benar
  digarap; membangunnya sekarang berisiko menghasilkan interface yang salah
  tebak.
* Auto-detect + throw loud saat env terisi tapi real adapter belum ada
  mencegah bug silent yang berbahaya: kalau nanti King Rezi mengisi env asli
  tapi kode real adapter belum sempat ditulis, sistem tidak boleh terlihat
  "berhasil" tapi sebenarnya masih memakai Fake.
* Guard ownership di level repository (bukan cuma Server Action) konsisten
  dengan pola defense-in-depth yang sudah dipakai di baseline arsitektur
  (RLS + Application Service RBAC) — satu titik guard di layer paling dalam
  melindungi semua entry point masa depan sekaligus.
* Use Case terpisah (bukan method opsional di `PublishingService`) menjaga
  type-safety constructor — ditemukan sebagai salah satu dari 2 temuan
  review arsitektur Ridwan pada siklus fix bug, sudah ditutup.

### Alternatives Considered

* **Menunggu kredensial Outstand asli sebelum lanjut fitur Schedule** —
  ditolak karena akan memblokir progress fitur yang sepenuhnya bisa
  dikerjakan tanpa network call sungguhan (domain logic, persistensi
  Prisma, UI Draft Editor).
* **Fake adapter simulasi delay/webhook/skenario gagal** — ditolak untuk
  scope ini; fidelitas instant always-success cukup untuk memverifikasi
  jalur happy-path persistensi, skenario gagal/webhook adalah pekerjaan
  ADR-040 (real adapter) sendiri.
* **`IOutstandAdapter` di lokasi cross-domain sejak awal** — ditolak (YAGNI),
  domain `publishing` satu-satunya pemakai saat ini.
* **Method `schedulePost` langsung ditambahkan ke `PublishingService`** —
  ditolak karena constructor perlu parameter opsional (`IOutstandAdapter`)
  yang berisiko lupa di-pass di operasi lain; dipisah jadi
  `SchedulePostsUseCase` dengan constructor sendiri yang type-safe.
