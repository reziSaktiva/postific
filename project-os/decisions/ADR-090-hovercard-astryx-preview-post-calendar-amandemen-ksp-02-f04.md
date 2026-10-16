## Decision ADR-090

### Title

HoverCard Astryx untuk Preview Post di Calendar — Amandemen KSP-02-F04 (khusus Calendar, bukan Queue/Drafts)

### Status

Accepted — Amended by ADR-091 (2026-08-26)

### Date

2026-08-26

### Context

Sesi perencanaan T-033 (Calendar view, `project-os/tickets/v02-publishing-mvp.md`)
di branch `feature/calendar-design-system`. King Rezi mengeksplorasi
halaman Calendar Buffer (`/calendar/week`, `/calendar/month`) sebagai
referensi UX dan meminta agar sejumlah elemennya diadopsi untuk Calendar
`apps/web`. Salah satu elemen: **klik post di grid Calendar membuka
popover ringkasan** (avatar akun, platform, caption/media, metrik —
Views/Reach/Replies/Eng. Rate — dan tautan "Go to post"), bukan langsung
membuka editor.

Baseline saat ini (`product-discovery/04-ux/key-screen-patterns.md`
KSP-02-F04, dan `navigation-patterns.md` § "Pola: Item → Editor") secara
eksplisit menyatakan klik item di **Calendar, Queue, maupun Drafts**
langsung membuka Draft Editor (modal, sejak ADR-052) — tanpa langkah
antara. Menambahkan popover ringkasan sebelum Draft Editor adalah
perubahan pola interaksi terhadap Critical Function yang sudah
didefinisikan di UX Baseline, sehingga sesuai AGENTS.md rule #4 perlu
dicatat sebagai ADR baru, bukan diam-diam diedit di `key-screen-patterns.md`.

Dikonfirmasi lewat `astryx component` (CLI resmi ter-pin v0.1.8,
`apps/web`) bahwa Astryx punya komponen `HoverCard`
(`@astryxdesign/core/HoverCard`) — sesuai rule 15 AGENTS.md, tidak
menebak nama komponen sebelum diverifikasi.

**Di luar cakupan ADR ini (dibahas terpisah, tidak diadopsi):** filter
Tags dan filter Timezone per-view dari referensi Buffer yang sama —
King Rezi memutuskan **tidak mengadopsi** keduanya, konsisten dengan
alasan yang sama dipakai saat menolak keduanya untuk Queue (T-032.0):
Tags tidak punya entity di domain model, Timezone per-view tidak ada di
backlog (hanya ada sebagai workspace setting). Karena keduanya **tidak
diadopsi**, tidak ada perubahan baseline yang perlu dicatat — tidak
butuh ADR untuk keputusan "tetap seperti sebelumnya" ini, cukup dicatat
sebagai catatan konteks di T-033 (`v02-publishing-mvp.md`).

**Juga di luar cakupan:** struktur route Calendar. King Rezi setuju
memakai **satu route** `/publish/calendar` dengan state di query param
(`?view=week|month&date=<timestamp>`) — bukan dua route terpisah
`/publish/calendar/week` + `/publish/calendar/month`. Ini **tidak**
mengoverride ADR-046 (yang memfiksasi `/publish/calendar` sebagai satu
route statis permanen), karena struktur route-nya tidak berubah — hanya
state tampilan (view + date) yang dibawa lewat query param, pola yang
sudah lazim dipakai di Next.js App Router untuk state non-routing. Tidak
butuh ADR untuk bagian ini.

### Decision

1. **Khusus di Calendar** (bukan Queue, bukan Drafts): klik item membuka
   **Astryx `HoverCard`** berisi ringkasan post — bukan langsung membuka
   Draft Editor. Ini mengamandemen **KSP-02-F04** dan baris Calendar di
   `navigation-patterns.md` § "Pola: Item → Editor". Queue dan Drafts
   **tidak berubah** — klik item di kedua layar itu tetap langsung
   membuka Draft Editor seperti sebelumnya (ADR-052 tidak diamandemen di
   luar Calendar).
2. **Isi HoverCard:** avatar + nama akun, platform, potongan caption,
   thumbnail media (kalau ada), status chip (Scheduled/Published/
   Failed/dst — reuse pola status existing KSP-02-F02), metrik kalau
   post sudah published (mapping ke `PostMetrics` domain BC-06 Analytics,
   `product-discovery/05-architecture/domain-model.md`):
   - "Views" (label UI) → `impressions` (field domain)
   - "Reach" → `reach`
   - "Replies" (label UI) → `comments` (field domain)
   - "Eng. Rate" → `engagementRate`
     Tidak ada field baru ditambahkan ke `PostMetrics` — murni mapping
     label UI ke field yang sudah ada, sehingga **tidak** dianggap
     perubahan domain model dan tidak butuh ADR terpisah untuk bagian ini.
     Post yang belum published (Scheduled/Draft/Ready to Schedule/Failed)
     menampilkan HoverCard tanpa section metrik (belum ada data).
3. **CTA di dalam HoverCard:** tombol/link yang membuka Draft Editor
   untuk item tersebut (melanjutkan pola existing, modal, ADR-052) —
   serta "Go to post" (tautan ke post asli di platform) untuk post yang
   sudah published, kalau datanya tersedia.
4. **Trigger:** klik pada card item di grid (bukan hover murni) — HoverCard
   Astryx dipakai sebagai komponen popover-nya (bukan sebagai
   trigger-on-hover secara harfiah), konsisten dengan pola Buffer yang
   direferensikan (klik untuk buka, bukan otomatis muncul saat mouse
   lewat).

### Reason

- **Kenapa perlu ADR, bukan langsung edit `key-screen-patterns.md`:**
  KSP-02-F04 adalah Critical Function yang sudah Accepted sejak UX
  Baseline v1.0 — mengubah pola interaksinya (tambah langkah antara)
  adalah keputusan UX material, bukan detail visual, sesuai kriteria
  rule 4 AGENTS.md.
- **Kenapa dibatasi ke Calendar saja, tidak Queue/Drafts:** permintaan
  King Rezi eksplisit soal referensi Buffer scope-nya halaman Calendar.
  Memperluas ke Queue/Drafts tanpa diminta akan jadi scope creep yang
  tidak disetujui — konsisten dengan disiplin scope di
  `.claude/skills/claude-design-scope-discipline/SKILL.md` (jangan
  mengubah state/pola lain sebagai efek samping).
- **Kenapa mapping metrik cukup di ADR ini, tidak butuh ADR domain model
  terpisah:** field yang dibutuhkan (`impressions`, `reach`, `comments`,
  `engagementRate`) semuanya sudah ada di `PostMetrics`. Perbedaan
  dengan istilah Buffer ("Views"/"Replies") murni label UI, bukan
  kebutuhan data baru.
- **Kenapa pakai Astryx `HoverCard`, bukan `Popover` atau komponen
  custom:** `HoverCard` tersedia dan dikonfirmasi via `astryx component`
  sebelum keputusan ini ditulis (rule 15 AGENTS.md) — dipilih sebagai
  default rencana karena namanya paling sesuai use-case (ringkasan info
  saat klik/hover item), verifikasi props/API final tetap lewat
  `astryx component HoverCard --dense` saat implementasi Design System
  dimulai (bukan asumsi dari nama saja).

### Alternatives Considered

- **Tetap klik → langsung Draft Editor (baseline lama, KSP-02-F04 asli)**
  — ditolak; King Rezi eksplisit ingin pola Buffer (ringkasan dulu)
  untuk mempercepat verifikasi jadwal tanpa membuka editor penuh setiap
  kali.
- **Popover custom (bukan komponen Astryx resmi)** — ditolak; melanggar
  rule 14 AGENTS.md (UI produk hanya memakai Astryx, wrapper selektif).
  `HoverCard` sudah tersedia sebagai komponen resmi.
- **Terapkan pola HoverCard yang sama ke Queue dan Drafts sekalian**
  (konsistensi lintas layar) — ditolak untuk saat ini; di luar scope
  permintaan King Rezi (Calendar saja), bisa dipertimbangkan sebagai ADR
  terpisah nanti kalau diminta eksplisit.
- **Tambah field baru ke `PostMetrics` supaya istilah 1:1 dengan Buffer
  ("views", "replies" sebagai field terpisah)** — ditolak; field yang
  sudah ada (`impressions`, `comments`) cukup merepresentasikan makna
  yang sama, menambah field baru tanpa kebutuhan data yang benar-benar
  berbeda hanya menambah kompleksitas domain model tanpa manfaat.

### Impact / Baseline yang diamandemen

- `product-discovery/04-ux/key-screen-patterns.md` § KSP-02 — F04
  direvisi (HoverCard dulu, bukan langsung Draft Editor), Critical
  Function baru **KSP-02-F08** (HoverCard Ringkasan Post) ditambahkan,
  Zona Fungsional & State Handling diperbarui secukupnya.
- `product-discovery/04-ux/navigation-patterns.md` — baris Calendar di
  § "Pola: Item → Editor" direvisi (lewat HoverCard dulu); baris Queue
  dan Drafts di pola yang sama **tidak diubah**. Row baru **NP-D15**
  ditambahkan ke tabel Ringkasan Pola Navigasi.
- `project-os/tickets/v02-publishing-mvp.md` § T-033 — ADR field
  ditambah ADR-090; subtask dipecah lebih detail (lihat commit
  dokumentasi yang menyertai ADR ini).
- **Tidak diubah:** `product-discovery/05-architecture/domain-model.md`
  (`PostMetrics`) — tidak ada field baru, murni mapping label UI.
  ADR-052 (Draft Editor modal) — tidak diamandemen, CTA di dalam
  HoverCard tetap membuka modal yang sama persis.
- **Implementasi kode belum berjalan** — ADR ini bagian dari fase
  dokumentasi/Design System (King Rezi eksplisit: dokumentasi → Design
  System → baru implementasi kode, urutan yang sama dengan ADR-052).

---
