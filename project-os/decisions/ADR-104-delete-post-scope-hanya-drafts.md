## Decision ADR-104

### Title

Delete Post — Entry Point Hanya di Drafts, Guard Status Draft-Only

### Status

Accepted

### Date

2026-09-10

### Context

`project-os/tickets/v02-publishing-mvp.md` § T-035 mendefinisikan
T-035.3 sebagai "Aksi tersedia dari Drafts + Queue + History" — daftar 3
screen ini ditulis di masa perencanaan awal tanpa verifikasi ke Claude
Design. Saat implementasi dimulai sesi ini (2026-09-10), sesuai AGENTS.md
rule 17 (gate stop-and-ask untuk task UI/UX), dicek dulu ke Claude Design
project "Social Media Management" untuk 3 mockup terkait sebelum menulis
kode UI:

- `templates/publish-drafts.html` — tiap baris draft klik-penuh (buka Edit
  Draft), **tidak ada icon aksi apa pun** di baris manapun.
- `templates/publish-queue.html` — sudah ada 3 icon aksi per item (Publish
  Now, Edit, Cancel Schedule warna merah), **tidak ada Delete**.
- `templates/publish-history.html` — baris murni `<a>` link penuh ke
  halaman detail, **tidak ada icon aksi sama sekali**.

Tidak satu pun dari ketiga mockup punya rancangan tombol Delete Post —
bukan kasus ambigu (>1 pola shadcn valid), tapi benar-benar kosong.
Implementasi UI di-**STOP** dulu sesuai rule 17, ditanyakan ke King Rezi
lewat `AskUserQuestion` (pola sama ADR-103).

### Decision

1. Entry point Delete Post **hanya ada di Drafts**. Queue dan History
   TIDAK diberi tombol delete sama sekali.
2. **Queue** (post berstatus `Scheduled`): tidak bisa dihapus langsung.
   Harus di-**Cancel Schedule** dulu (T-030, sudah ada — mengembalikan
   status ke `Draft`), baru post itu muncul di Drafts dan bisa dihapus
   dari sana.
3. **History** (post berstatus `Published`/`Failed`): tidak bisa dihapus
   sama sekali dari UI manapun — post yang sudah diproses (baik sukses
   tayang maupun gagal) dianggap final.
4. Konsekuensi di backend: `PublishingService.deletePost` diberi guard
   status — **hanya post berstatus `ContentStatus.Draft` yang boleh
   di-soft-delete**. Status lain (`InReview`, `ReadyToSchedule`,
   `Scheduled`, `Published`, `Failed`) ditolak dengan `ConflictError`.
   Guard ini dua lapis: service (fetch dulu via `findDraftById`, cek
   eksplisit) dan repository (`updateMany` dengan `where: { status: Draft
}` sebagai safety net race condition, mencegah TOCTOU kalau status
   berubah tepat di antara fetch dan write).
5. Pola visual tombol delete di Drafts: icon trash merah (`icon-btn-danger`)
   selalu terlihat per baris — King Rezi tidak punya preferensi spesifik
   soal posisi persis, dipakai rekomendasi yang konsisten dengan pola
   `Cancel Schedule` yang sudah established di Queue.

### Reason

- **Konsistensi dengan Cancel Schedule (ADR-049)**: Cancel Schedule sudah
  jadi jalur resmi untuk "menarik kembali" post terjadwal — menambah jalur
  Delete langsung dari Queue akan jadi 2 cara berbeda untuk mencapai efek
  serupa (post batal terjadwal), membingungkan dan berisiko duplikasi
  logic. Cancel Schedule dulu → Draft → Delete dari Drafts adalah satu
  jalur linear yang lebih sederhana.
- **Post published/failed di History bersifat final**: menghapus record
  History akan menyembunyikan jejak audit post yang benar-benar sudah
  diproses (baik sukses maupun gagal) — bertentangan dengan tujuan History
  sebagai riwayat, dan tidak ada kebutuhan produk nyata untuk "menghapus"
  post yang sudah live di platform sosial (post itu sendiri tidak ikut
  terhapus dari platform, DB-D03).
- **Guard status Draft-only lebih ketat dari desain awal T-035.1** ("post
  yang sudah published tidak dihapus dari platform") — desain awal hanya
  melarang pemanggilan API Outstand untuk hapus dari platform, tapi tidak
  eksplisit melarang soft-delete record DB untuk status lain. Keputusan
  ini memperjelas: soft-delete DB pun dibatasi hanya untuk `Draft`, selaras
  dengan scope entry point yang sekarang hanya di Drafts — tidak ada jalur
  UI yang bisa memanggil `deletePost` untuk status lain, jadi guard backend
  ini murni defense-in-depth (pola sama ADR-059 poin 6, T-091.1).

### Alternatives Considered

- **Entry point di ketiga screen (Drafts + Queue + History), sesuai draft
  awal T-035.3** — ditolak; King Rezi eksplisit menyatakan Queue dan
  History tidak boleh delete sama sekali.
- **Delete di Queue langsung memicu cancel + delete sekaligus (satu
  klik)** — tidak dipilih; King Rezi memilih jalur eksplisit dua langkah
  (Cancel Schedule dulu, baru Delete dari Drafts) tanpa mengusulkan
  shortcut gabungan.
- **Draft desain dulu ke Claude Design sebelum implementasi** (opsi lain
  yang ditawarkan lewat `AskUserQuestion`) — tidak dipilih; King Rezi
  langsung menentukan scope + pola di chat, dicatat sebagai deviasi
  eksplisit dari alur biasa (pola sama KI-048).

### Impact / Baseline yang diamandemen

- `project-os/tickets/v02-publishing-mvp.md` § T-035 — T-035.3
  dipersempit dari "Drafts + Queue + History" menjadi "Drafts" saja,
  dicatat eksplisit di task file. **T-035 tuntas 3/3 subtask, `✅ Done`**.
- File kode: `apps/web/src/domains/publishing/services/publishing.service.ts`
  (`deletePost` + guard status), `apps/web/src/domains/publishing/repositories/publishing.repository.ts`
  (interface `softDeletePost`), `apps/web/src/lib/repositories/publishing/publishing.repository.ts`
  (implementasi Prisma, `updateMany` where `status: Draft`),
  `apps/web/src/domains/publishing/rbac.ts` (`assertActorCanDeletePost`,
  Owner/Admin/Creator), `apps/web/src/app/(app)/publish/drafts/actions.ts`
  (baru, `deletePostAction`), `apps/web/src/app/(app)/publish/drafts/components/DraftsList.tsx`
  (icon delete + reuse `ConfirmActionDialog`/`useConfirmAction`).
- Tidak ada perubahan di `QueueList.tsx`/`QueueScreen.tsx` atau file
  History manapun — diverifikasi eksplisit lewat `git status` + QA
  browser (Najwa QA Engineer).
- Lolos review arsitektur Ridwan Architecture Reviewer (0 temuan
  blocking) dan QA Najwa QA Engineer (311 test pass/5 skip, browser
  end-to-end PASS golden path + regresi Queue/History + RBAC Creator).
