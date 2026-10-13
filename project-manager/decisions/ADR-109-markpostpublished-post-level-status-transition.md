## Decision ADR-109

### Title

Method baru `IPublishingRepository.markPostPublished` — transisi status
`PublishingPost` level-post melengkapi gap pre-existing T-026

### Status

Accepted

### Date

2026-09-17

### Decision

Selama implementasi T-027.5 (job handler `ResolveScheduledPostOutcomeJobHandler`),
ditemukan gap pre-existing sejak T-026 (✅ Done, 2026-09-07) yang baru
kentara sekarang: `PublishingPost.status` **tidak pernah** ditransisikan ke
`Published` walau seluruh `PublishingPostTarget` miliknya sudah resolved
sukses — hanya kolom `status` di level `PublishingPostTarget` (per akun)
yang ter-update lewat `updateTargetOutcome`. Akibatnya post yang dijadwalkan
lewat Schedule bisa tayang sepenuhnya di semua akun, tapi status
post-level-nya stuck selamanya di `Scheduled`.

Ditambahkan method baru simetris dengan `markPostFailed` yang sudah ada:

```
markPostPublished(postId: PublishingPostId): Promise<void>
```

* **Idempoten** — implementasi memakai `updateMany` dengan guard
  `WHERE id = :postId AND status = 'Scheduled'`, tidak throw kalau 0 baris
  ter-update (beda desain eksplisit dari `markPostFailed` yang throw kalau
  post tidak ditemukan — di sini post yang sudah `Published`/`Failed`
  dipanggil ulang dianggap wajar, bukan error).
* **Dipanggil dari satu titik**: `OutstandWebhookProcessor.resolvePostOutcome`
  (dipakai bersama webhook T-026 dan job T-027.5), persis pada saat semua
  `PublishingPostTarget` milik post itu sudah resolved (tidak ada status
  `pending` yang tersisa) **dan** tidak semua `failed` — konsisten dengan
  aturan baseline `integration-layer.md`: "post.error hanya terjadi kalau
  SEMUA target gagal; post tetap dianggap `Published` kalau minimal satu
  target sukses (partial success)".
* **`PublishNowUseCase` sengaja tidak disentuh** — use case ini sudah
  punya jalur transisi ke `Published` sendiri di muka (langsung setelah
  `publishNow` sukses), tidak lewat `resolvePostOutcome`, jadi tidak
  terdampak gap yang sama.

### Reason

* Ini adalah **bug-fix yang melengkapi T-026**, bukan perubahan scope baru
  — T-026 sudah menangani transisi status per-target dengan benar, tapi
  luput mengagregasi ke status post-level. Dicatat sebagai ADR (bukan
  sekadar catatan task) karena menambah method baru ke kontrak
  `IPublishingRepository` yang dipakai lintas use case (`OutstandWebhookProcessor`,
  berpotensi dipakai lagi oleh handler job masa depan).
* Idempotensi lewat guard `status = 'Scheduled'` (bukan cek-lalu-update
  terpisah) menghindari race condition antara webhook dan job yang
  keduanya bisa memanggil `resolvePostOutcome` untuk post yang sama.
* Tidak mengubah status T-026 (`✅ Done`) — gap ini dicatat sebagai catatan
  tambahan di task tersebut, task tidak dibuka ulang, karena implementasi
  aslinya sudah benar untuk scope yang dikerjakan saat itu (transisi
  per-target), gap hanya di agregasi level-post yang baru relevan sekarang
  T-027.5 membuat jalur Schedule benar-benar berjalan end-to-end.

### Alternatives Considered

* **Hitung status post-level secara lazy setiap kali dibaca** (mis. di
  query `listHistory`/`getCalendarPostById`, bandingkan status seluruh
  target on-the-fly) alih-alih menyimpan `Published` secara eksplisit di
  kolom `PublishingPost.status`. Ditolak — kolom `status` di level post
  sudah dipakai luas sebagai sumber kebenaran di banyak query/filter
  (Drafts, Queue, Calendar, History) dan mengubahnya jadi computed value
  butuh perubahan lebih besar di banyak tempat untuk manfaat yang sama.
* **Perluas `markPostFailed` jadi satu method generik `resolvePostStatus`**
  yang menangani baik sukses maupun gagal. Ditolak — `markPostFailed` sudah
  punya semantik throw-kalau-tidak-ditemukan yang berbeda sengaja dari
  kebutuhan idempoten `markPostPublished`; menggabungkan keduanya berarti
  salah satu caller harus menerima semantik yang tidak sesuai
  kebutuhannya.

### References

* `apps/web/src/domains/publishing/repositories/publishing.repository.ts`
  — `markPostPublished`, `markPostFailed`.
* `apps/web/src/domains/publishing/services/outstand-webhook-processor.ts`
  — `resolvePostOutcome`, titik pemanggilan `markPostPublished`.
* `product-discovery/05-architecture/integration-layer.md` — aturan
  "post.error hanya kalau semua target gagal".
* ADR-099 — T-026 webhook handler (task yang gap-nya dilengkapi ADR ini).
* ADR-108 — keputusan terkait di sesi yang sama (`fetchPostOutcome`).
* `tasks/v02-publishing-mvp.md` § T-026, § T-027 (T-027.5).
