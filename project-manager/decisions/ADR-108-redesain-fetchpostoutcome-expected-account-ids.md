## Decision ADR-108

### Title

Redesain kontrak `IOutstandAdapter.fetchPostOutcome` — tambah parameter
`expectedOutstandAccountIds`, hilangkan state in-memory `FakeOutstandAdapter`

### Status

Accepted

### Date

2026-09-17

### Decision

T-027.5 (job handler `ResolveScheduledPostOutcomeJobHandler`) menemukan bug
correctness lewat QA Najwa QA Engineer: post yang dijadwalkan (`Scheduled`)
tidak pernah selesai resolve outcome-nya walau job runner (T-027.1–.3)
berjalan normal dan tidak error.

**Root cause:** `FakeOutstandAdapter` (ADR-059) mengimplementasikan
`fetchPostOutcome(outstandPostId)` dengan bergantung pada `Map` in-memory
level-modul (`targetsByOutstandPostId`) untuk "mengingat" akun target dari
panggilan `schedulePost`/`publishNow` sebelumnya — kontrak lama tidak
membawa informasi akun target sama sekali di parameter `fetchPostOutcome`,
jadi implementasi Fake terpaksa menyimpannya sendiri di sisi state adapter.

Pola ini valid untuk `PublishNowUseCase`: `publishNow` dan `fetchPostOutcome`
dipanggil berurutan dalam **1 request/Server Action yang sama**, jadi
berbagi module instance yang sama persis. Tapi pola ini **rusak** untuk
T-027.5: `schedulePost` dipanggil dari Server Action (saat user men-Schedule
post), sedangkan `fetchPostOutcome` (lewat job `publishing.scheduled_post.resolve_outcome`)
dipanggil **belakangan**, dari **Route Handler `/api/jobs/run` yang
terpisah**. Elon Backend Engineer membuktikan lewat inspeksi build
production (`.next/server`) bahwa Next.js membundle Server Action dan Route
Handler menjadi **4 module chunk terpisah**, masing-masing dengan instance
`Map` sendiri — bukan artefak dev/Turbopack saja, melainkan perilaku nyata
di production build. Akibatnya `fetchPostOutcome` yang dipanggil dari job
selalu melihat `Map` kosong, tidak pernah menemukan target akun yang
"diingat" saat `schedulePost`.

**Keputusan (King Rezi, via `AskUserQuestion`):** pilih **Opsi A
(root-cause)** — ubah kontrak `IOutstandAdapter.fetchPostOutcome` supaya
caller wajib mengirim ulang daftar akun target secara eksplisit, bukan
mengandalkan adapter "mengingat" state dari panggilan sebelumnya:

```
fetchPostOutcome(
  outstandPostId: string,
  expectedOutstandAccountIds: string[],
): Promise<PostTargetOutcome[]>
```

Konsekuensi implementasi:

1. **`FakeOutstandAdapter` jadi pure function tanpa state sama sekali** —
   `Map targetsByOutstandPostId`, method `rememberTargets`, dan konstanta
   `MAX_REMEMBERED_POSTS` dihapus total. `fetchPostOutcome` sekarang
   menghasilkan outcome deterministik langsung dari
   `expectedOutstandAccountIds` yang dikirim caller, tanpa bergantung pada
   riwayat panggilan apa pun sebelumnya.
2. **`deletePost` jadi no-op murni** — sebelumnya method ini (dipakai
   ADR-103, retry manual) juga menyentuh `Map` yang sama untuk membersihkan
   entry; setelah state dihapus, tidak ada lagi yang perlu dibersihkan.
   Ridwan Architecture Reviewer memverifikasi tidak ada caller yang
   bergantung pada efek lama `deletePost` menghapus state in-memory.
3. **3 call site diupdate** untuk mengirim `expectedOutstandAccountIds`
   secara eksplisit:
   - `PublishNowUseCase` — mengirim daftar `outstandAccountId` dari target
     yang baru saja di-publish di request yang sama.
   - `RetryFailedTargetUseCase` — mengirim `outstandAccountId` target yang
     di-retry (ADR-103).
   - `OutstandWebhookProcessor.resolvePostOutcome` (dipakai bersama webhook
     T-026 dan job T-027.5) — mengirim seluruh `outstandAccountId` dari
     `PublishingPostTarget` milik post yang sedang di-resolve, dibaca dari
     DB (bukan dari memori proses).
4. **Domain `analytics` dikonfirmasi tidak terdampak** — tidak memakai
   `fetchPostOutcome` di kode produksi manapun, hanya ada stub di test.

### Reason

* Bug ini adalah **correctness bug nyata di production**, bukan hipotetis —
  tanpa fix, setiap post yang dijadwalkan lewat Schedule (bukan Publish Now)
  akan **selamanya stuck** tidak pernah resolve ke `Published`/`Failed`
  begitu T-027.5 di-deploy, karena job selalu berjalan di proses/module
  chunk terpisah dari Server Action yang men-schedule-nya.
* **Root-cause lebih baik daripada band-aid**: opsi alternatif
  (`globalThis` untuk berbagi `Map` lintas module chunk) hanya menutupi
  gejala untuk kasus Fake — begitu Real adapter (T-025) ditulis, ia harus
  memanggil Outstand API asli yang **memang tidak mengembalikan daftar akun
  target** dari `fetchPostOutcome` tanpa diberi tahu ulang (lihat referensi
  `integration-layer.md`); mengubah kontrak sekarang menghindari perlu
  redesain ulang saat T-025 dikerjakan.
* Perubahan kontrak murah — hanya 3 call site produksi, dan seluruhnya
  sudah punya akses ke daftar akun target di titik pemanggilan (baik dari
  input use case maupun dari DB), tidak perlu network call tambahan.

### Alternatives Considered

* **Band-aid `globalThis`** untuk membuat `Map` `FakeOutstandAdapter`
  benar-benar singleton lintas module chunk Next.js. Ditolak — hanya
  berlaku untuk Fake, tidak menyelesaikan gap desain kontrak nyata (Real
  adapter tetap butuh cara mengetahui akun target tanpa bergantung pada
  memori proses), dan `globalThis` di server Next.js punya risiko
  tersendiri (state lintas request yang tidak di-reset, berbahaya untuk
  multi-tenant).
* **Simpan target akun ke tabel `BackgroundJob.payload`** dan biarkan
  kontrak `fetchPostOutcome` tidak berubah, job handler membaca dari
  payload sendiri lalu memfilter hasil. Ditolak — masih menyembunyikan
  informasi yang seharusnya jadi bagian eksplisit kontrak adapter (ACL),
  dan tidak menyelesaikan masalah untuk pemanggil `fetchPostOutcome` lain
  di luar job (webhook, retry) yang tetap butuh sumber akun target yang
  konsisten.

### References

* `packages/shared/src/contracts/outstand-adapter.ts` — kontrak final
  `fetchPostOutcome(outstandPostId, expectedOutstandAccountIds)`.
* `apps/web/src/lib/adapters/outstand/fake-outstand-adapter.ts` —
  implementasi Fake tanpa state.
* `apps/web/src/domains/publishing/services/outstand-webhook-processor.ts`
  — `resolvePostOutcome` (dipakai bersama webhook T-026 dan job T-027.5).
* `apps/web/src/domains/publishing/services/resolve-scheduled-post-outcome-job-handler.ts`
  — pemicu ditemukannya bug ini.
* ADR-059 — pola Fake adapter awal (auto-switch, throw loud, instant
  fidelity) yang diamandemen soal statefulness-nya di sini.
* ADR-092 — kontrak `fetchPostOutcome` asli yang diredesain lebih lanjut
  oleh ADR ini.
* ADR-109 — keputusan terkait di sesi yang sama (`markPostPublished`).
* `tasks/v02-publishing-mvp.md` § T-027 (T-027.5).
