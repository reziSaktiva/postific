## Decision ADR-083

### Title

Queue (KSP-03) Murni Urutan Waktu Publish — Hapus Reorder Manual & Status Chip per Item, Entity `QueueSlot` Dihapus dari Baseline

### Status

Accepted

### Date

2026-08-19

### Context

King Rezi menunjukkan screenshot halaman Queue Buffer (`publish.buffer.com/schedule`)
sebagai referensi UX yang diinginkan untuk T-032 (Queue management, v0.2
Publishing MVP), lalu meminta mockup Claude Design (`templates/publish-queue.html`)
diselaraskan lewat 2 putaran revisi di sesi yang sama (detail lengkap:
`project-os/COMPLETE_TASK.md` entri 2026-08-19 "T-032.0 selesai").
Hasil akhirnya:

1. Queue murni terurut berdasarkan waktu publish (ascending) — **tidak ada
   reorder manual** (tombol ↑/↓ dihapus total).
2. Post dikelompokkan per tanggal, lalu per jam di dalamnya.
3. Status chip (`Scheduled`/`Failed`/`Ready to Schedule`) **dihapus total**
   dari tampilan Queue.
4. 1 Card Astryx per schedule/post (bukan satu card menaungi seluruh list).
5. 3 tombol aksi eksplisit per post: **Publish Now**, **Edit**, **Cancel
   Schedule** (icon merah) — menggantikan kombinasi badge status + dropdown
   "More options".

Setelah desain ini selesai, audit dokumentasi (diminta eksplisit King Rezi:
"apakah aman tidak ada gap atau ui/ux yang berlawanan dengan design system
yang baru?") menemukan 3 dokumen baseline **secara eksplisit bertentangan**
dengan keputusan ini — bukan sekadar detail implementasi UI yang terbuka
seperti sempat dicatat di `tickets/v02-publishing-mvp.md` T-032.1:

- **`04-ux/key-screen-patterns.md` KSP-03**: `KSP-03-F02` ("Status setiap
  item terlihat jelas: Scheduled, In Review, Ready to Schedule, Draft,
  Failed") dan `KSP-03-F05` ("Reorder Item — Pengguna dapat memindahkan
  item ke slot waktu yang berbeda") adalah spesifikasi resmi yang langsung
  bertentangan dengan poin 1 dan 3 di atas. Wireframe ASCII-nya juga sudah
  usang (filter+New Post satu baris, tanpa grouping tanggal/jam, tanpa
  1-card-per-post, tanpa 3 tombol aksi).
- **`04-ux/user-flows.md` UF-02**: langkah "Raka mengubah urutan item ...
  memindahkan jadwal ke slot yang lebih tepat" dan prinsip **UXP-04**
  ("Status yang selalu terlihat di Queue ... membangun kepercayaan")
  eksplisit menegaskan reorder dan status-selalu-terlihat sebagai bagian
  resmi alur — bukan cuma detail visual.
- **`05-architecture/domain-model.md`** (entity `QueueSlot`, field
  `order: number`) dan **`application-layer.md`** (`getQueueSlots`/
  `setQueueSlots`, "Konfigurasi slot antrian harian") mendefinisikan model
  arsitektur "slot waktu berulang yang bisa diisi + disusun ulang" — konsep
  yang berbeda dari "murni urutan waktu publish, tanpa reorder, tanpa
  slot". Model Prisma `PublishingQueueSlot` yang cocok dengan definisi lama
  ini **sudah ada secara fisik** di `apps/web/prisma/schema.prisma`. Nol
  referensi di kode **service/aplikasi** (dikonfirmasi di
  `tickets/v02-publishing-mvp.md` T-032: "Model `PublishingQueueSlot` sudah
  ada di schema tanpa service apapun") — tapi **tetap dipakai langsung**
  di `apps/web/src/lib/repositories/workspace/workspace.repository.delete-cascade.test.ts`
  (baris 81, 129) sebagai bagian test integrasi cascade-delete T-008.2.
  Migration penghapusan di T-032.5 wajib mengecek/menyesuaikan test ini
  dulu, bukan berasumsi aman dihapus begitu saja.

Pertanyaan kunci yang perlu dijawab sebelum menghapus status chip: apakah
ini melanggar **UXP-04** (Publishing Trust — "Status konten harus selalu
terlihat") dan **UXP-06** (Status Jelas, Proses Ringan) secara prinsip,
bukan cuma di satu layar? Jawabannya tidak, **dengan syarat** cakupan Queue
dipersempit: Queue hanya menampung post berstatus `Scheduled` (homogen),
sehingga status jadi implisit dari keberadaan item itu sendiri di tab ini.
Item `Failed` **tidak lagi ditampilkan di Queue** — pindah ke **History**
(T-034, yang sudah merencanakan query "published / error" per target) begitu
percobaan publish selesai. Item `Draft`/`Ready to Schedule` tetap di
**Drafts** (T-022, sudah menampilkan status heterogen di sana). Dengan
pembagian ini, UXP-04/UXP-06 tetap ditegakkan secara produk — hanya
mekanismenya berpindah dari "badge per item di satu layar campuran" menjadi
"cakupan homogen per layar + status jelas di layar yang memang heterogen
(Drafts, History)".

### Decision

1. **Queue (KSP-03) murni menampilkan post berstatus `Scheduled`**, terurut
   ascending berdasarkan `Post.scheduledAt`, dikelompokkan per tanggal lalu
   per jam. Tidak ada mekanisme reorder manual dalam bentuk apapun.
2. **Tidak ada badge/chip status per item di Queue** — status implisit dari
   cakupan homogen (semua Scheduled). Item `Failed` pindah ke History
   (T-034) begitu percobaan publish gagal; item `Draft`/`Ready to Schedule`
   tetap di Drafts (T-022) — kedua layar itu tetap wajib menampilkan status
   heterogen per item sesuai UXP-04/UXP-06 yang tidak berubah di sana.
3. Memindahkan jadwal sebuah post berarti **mengedit `scheduledAt`-nya**
   lewat Draft Editor (KSP-05) — bukan menyusun ulang urutan tampilan Queue.
4. **Entity `QueueSlot` dihapus dari `domain-model.md`** — Queue adalah
   _computed view_ atas `Post`/`PostTarget`, bukan entity persisten dengan
   field `order` independen. Kontrak `getQueueSlots`/`setQueueSlots` di
   `application-layer.md` diganti `listQueue` (Server Component) yang
   query langsung `Post`/`PostTarget`.
5. Model Prisma `PublishingQueueSlot` (kolom `order`, `postId?` nullable)
   **dianggap deprecated** — dijadwalkan dihapus lewat migration di subtask
   terpisah `T-032.5` (bukan bagian `T-032.2`/`PublishingService.listQueue`,
   supaya kewajiban cek `workspace.repository.delete-cascade.test.ts` dulu
   tidak keliru dianggap selesai begitu `listQueue` jalan), bukan dihapus
   sekarang (di luar scope sesi dokumentasi ini) dan bukan dibiarkan
   selamanya sebagai sumber kebenaran kedua yang membingungkan.
6. Cancel Schedule (T-030) menjadi jalur resmi untuk menarik post kembali
   ke Draft dari Queue — tombol icon merah eksplisit + dialog konfirmasi
   Tier 2 (ADR-049), menggantikan alur lama "buka Draft Editor lalu ubah
   status manual".
7. Baseline berikut diamandemen mengikuti keputusan ini (detail per file di
   section Impact): `key-screen-patterns.md` (KSP-03-F02 diamandemen,
   KSP-03-F05 dihapus, KSP-03-F07 baru ditambahkan, wireframe & state
   handling digambar ulang), `user-flows.md` (UF-02 happy path + alternate
   path + UXP-04 ditulis ulang), `domain-model.md` (entity `QueueSlot` +
   `QueueSlotId` dihapus), `application-layer.md` (`IQueueSlotRepository`
   - `getQueueSlots`/`setQueueSlots` dihapus, `listQueue` ditambahkan),
     `information-architecture.md` (frasa "per akun" diperjelas).

### Reason

- Mengikuti pola Buffer (referensi eksplisit King Rezi) sebagai baseline
  UX untuk Queue lebih konsisten dan lebih ringan secara kognitif — satu
  layar dengan satu makna implisit ("ini akan tayang sesuai jadwal") lebih
  mudah dipindai daripada daftar campuran status yang perlu dibaca satu
  per satu.
- Menyederhanakan model data: tanpa entity `QueueSlot`/field `order`
  terpisah, tidak ada risiko `scheduledAt` dan `order` saling tidak
  sinkron (dua sumber kebenaran untuk "urutan" yang sama).
- UXP-04/UXP-06 tetap terpenuhi di level produk (Drafts + History tetap
  wajib status jelas) — pemisahan cakupan per layar bukan pelanggaran
  prinsip, melainkan penerapan yang lebih presisi: setiap layar punya satu
  tanggung jawab status yang jelas (Drafts = belum terjadwal, Queue = akan
  tayang, History = hasil akhir).
- Ditemukan lewat audit eksplisit yang diminta King Rezi — mencegah drift
  dokumentasi lebih lanjut sebelum implementasi kode (T-032.2/.3/.4) mulai
  dan mewarisi asumsi arsitektur yang sudah ditolak di level desain.

### Alternatives Considered

- **Pertahankan status chip di Queue, hanya hapus reorder** — ditolak;
  audit menemukan alasan chip ada justru untuk membedakan `Failed` dari
  `Scheduled` dalam satu list campuran. Kalau `Failed` tetap muncul di
  Queue, menghapus chip akan jadi regresi nyata (melanggar UXP-04 "error
  harus ditampilkan jelas"). Solusi yang lebih bersih: pindahkan `Failed`
  keluar dari Queue sepenuhnya (ke History), bukan pertahankan chip.
- **Pertahankan entity `QueueSlot` tapi berhenti memakai field `order`** —
  ditolak; entity yang separuh dipakai (field `scheduledAt`/`postId` jalan,
  `order` mati) lebih membingungkan daripada dihapus total dan Queue
  dihitung langsung dari `Post`/`PostTarget` yang sudah jadi source of
  truth untuk jadwal.
- **Biarkan `key-screen-patterns.md`/`user-flows.md` apa adanya, anggap
  Claude Design sebagai satu-satunya sumber kebenaran baru** — ditolak;
  bertentangan langsung dengan `context/ctx-design.md` poin 1 ("`04-ux/`
  tetap SoT untuk alur, IA, dan fungsi layar — Claude Design hanya
  representasi visual yang diturunkan darinya") dan poin 8 (larangan
  mengarang flow baru yang bertentangan dengan `04-ux/` tanpa ADR).

### Impact / Baseline yang diamandemen

- `product-discovery/04-ux/key-screen-patterns.md` — section KSP-03:
  Tujuan, `KSP-03-F02` (diamandemen), `KSP-03-F05` (dihapus, ID tidak
  didaur ulang), `KSP-03-F07` (baru), wireframe ASCII, Zona list, State
  Handling, baris "Ringkasan Pola per Layar".
- `product-discovery/04-ux/user-flows.md` — UF-02: Happy Path, Alternate
  Path, UXP-04.
- `product-discovery/05-architecture/domain-model.md` — diagram bounded
  context (kotak "Queue Slot" dihapus), tabel Core Entities (`QueueSlot`
  dihapus), Key Attributes (`QueueSlot` diganti catatan computed-view),
  branded type `QueueSlotId` dihapus.
- `product-discovery/05-architecture/application-layer.md` — tabel
  repository (`IQueueSlotRepository` dihapus), `getQueueSlots`/
  `setQueueSlots` diganti `listQueue`.
- `product-discovery/05-architecture/database-strategy.md` — baris mapping
  `QueueSlot` → `publishing_queue_slots` ditandai deprecated (dicoret,
  bukan dihapus baris-nya, supaya jejak tabel fisik yang masih ada di DB
  tetap terlihat sampai migration penghapusannya benar-benar dijalankan).
- `product-discovery/04-ux/information-architecture.md` — frasa "antrean
  posting berurutan per akun" diperjelas.
- `project-os/TASKS.md` — baris "Keputusan terbuka" untuk T-032
  dihapus (sudah resolved, bukan lagi menunggu keputusan).
- `project-os/tickets/v02-publishing-mvp.md` — T-032.0/.1 (sudah
  dicatat sebelum ADR ini ditulis, sekarang diformalkan resminya lewat ADR
  ini alih-alih dianggap "bukan perubahan baseline").
- `apps/web/prisma/schema.prisma` — model `PublishingQueueSlot` **belum**
  dihapus di ADR ini (tidak ada migration dijalankan) — dijadwalkan sebagai
  subtask terpisah `T-032.5` (bukan `T-032.2`, karena `PublishingQueueSlot`
  masih dipakai `workspace.repository.delete-cascade.test.ts` dan butuh
  penyesuaian test dulu sebelum drop), dicatat di sini supaya tidak
  terlewat.
- Tidak menyentuh `04-ux/navigation-patterns.md` (tab bar Calendar/Queue/
  Drafts/History tidak berubah) maupun ADR-023 (Realtime tetap dibatasi
  tabel `notifications`; Queue tetap manual refresh seperti Calendar).

---
