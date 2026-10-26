## Decision ADR-091

### Title

Amandemen ADR-090 — Popover (bukan HoverCard) untuk Preview Post di Calendar

### Status

Accepted

### Date

2026-08-26

### Context

ADR-090 (Accepted, hari yang sama) menetapkan: klik item Calendar membuka
Astryx `HoverCard` berisi ringkasan post + CTA ke Draft Editor, sebelum
implementasi apa pun berjalan (masih tahap dokumentasi/Design System).

Saat sesi Design System (Claude Design, project "Social Media
Management") mulai mengeksekusi ADR-090, agent di sana melaporkan tidak
bisa menjalankan `astryx` CLI untuk memverifikasi anatomi `HoverCard`
(tidak ada akses shell/`node_modules` di lingkungan itu). AI utama
menjalankan `astryx component HoverCard --dense` dan
`astryx component Popover --dense` sendiri dari `apps/web` (CLI resmi
ter-pin v0.1.8) untuk memverifikasi, sesuai rule 15 AGENTS.md
(verifikasi lewat CLI lokal, jangan menebak nama/props komponen).

Hasil verifikasi menemukan **ADR-090 salah pilih komponen**:

- `HoverCard` — trigger resminya **hover/focus** (`delay: 300ms`,
  `hideDelay: 200ms`), bukan klik. Best Practices resmi Astryx eksplisit
  menyatakan: _"Don't place critical actions or required information
  inside a hover card; users may miss content that only appears on
  hover"_ dan _"Don't use a hover card when a simple Tooltip or Popover
  would suffice."_ Secara API, `HoverCard` juga **tidak punya prop
  `isOpen` controlled** — hanya `isDefaultOpen` (buka sekali saat
  mount) — sehingga tidak ada cara resmi untuk "memaksa" dia terbuka
  lewat event klik tanpa keluar dari API yang didukung.
- `Popover` — dideskripsikan resmi sebagai _"A click-triggered overlay
  anchored to a button or trigger element. Use it for secondary
  actions, inline confirmations, or supplementary information."_
  Anatominya (Header + Body + Trigger Element) dan prop `isOpen` +
  `onOpenChange` (controlled mode eksplisit) persis cocok dengan
  kebutuhan: klik item → buka ringkasan (supplementary info) + tombol
  CTA Edit (secondary action) di dalamnya.

Rencana interaksi di ADR-090 (klik untuk buka, ada CTA tombol Edit di
dalam card) tidak pernah berubah — yang salah murni pemilihan nama
komponen Astryx-nya. Koreksi ini terjadi **sebelum** ada satu pun
markup ditulis di Design System (baru tahap perencanaan/prompt),
sehingga tidak ada rework kode yang perlu dibongkar.

### Decision

1. **Ganti seluruh referensi `HoverCard` menjadi `Popover`**
   (`@astryxdesign/core/Popover`) di baseline yang diamandemen ADR-090:
   KSP-02-F04, KSP-02-F08, NP-D15, dan subtask T-033.8. Isi/konten
   preview (avatar+nama akun, platform, caption, thumbnail media,
   status chip, metrik untuk Published, tautan "Go to post", CTA buka
   Draft Editor) **tidak berubah** — cuma wadah komponennya.
2. **Trigger tetap klik** (sesuai rencana awal, dan memang defaultnya
   `Popover`) — bukan hover.
3. **Anatomi mengikuti `Popover` resmi:** Header (title ringkas, mis.
   nama akun + platform, plus tombol close bawaan `hasCloseButton`) +
   Body (caption, media, status, metrik, "Go to post") + Trigger
   (card item Calendar itu sendiri). `placement="below"`,
   `alignment="start"` (default Popover) dipakai kecuali Design System
   menemukan alasan kuat untuk override saat implementasi visual.
4. **Status ADR-090 diperbarui** menjadi "Accepted — Amended by ADR-091
   (2026-08-26)" — isi body ADR-090 (append-only) tidak diedit, pembaca
   perlu membaca ADR-091 ini untuk tahu komponennya sudah berubah.

### Reason

- **Kenapa perlu ADR baru, bukan edit langsung ADR-090:** `DECISIONS.md`
  append-only (presedern ADR-089 mengamandemen ADR-088 dengan pola yang
  sama) — ADR-090 sudah berstatus Accepted sebelum koreksi ini
  ditemukan.
- **Kenapa Popover, bukan HoverCard, secara teknis (bukan cuma gaya):**
  `Popover` punya prop `isOpen`/`onOpenChange` controlled yang memang
  didesain untuk dipicu event seperti klik; `HoverCard` tidak — memaksa
  HoverCard terbuka via klik berarti keluar dari API yang didukung,
  membuat implementasi `apps/web` nanti bukan lagi "straight swap
  markup → real component" (prinsip inti Design System project ini,
  `readme.md`) melainkan workaround custom.
- **Kenapa CTA (tombol Edit) tidak aman di HoverCard:** guideline resmi
  Astryx eksplisit melarang menaruh critical action di HoverCard karena
  `hideDelay: 200ms` bisa membuat card hilang sebelum user sempat klik
  CTA-nya — risiko UX nyata, bukan style preference.
- **Kenapa koreksi ini murah (tidak mengubah scope T-033 secara
  substansi):** ditemukan sebelum implementasi apa pun (kode maupun
  Design System) berjalan — murni ganti nama komponen target,
  interaksi/konten yang sudah disepakati King Rezi tidak berubah sama
  sekali.

### Alternatives Considered

- **Tetap pakai HoverCard, paksa buka via klik dengan workaround custom
  (state manual di luar prop resmi)** — ditolak; melanggar rule 15
  AGENTS.md (jangan menebak/memaksa pola di luar CLI resmi) dan prinsip
  "straight swap" Design System project ini.
- **Pindahkan CTA Edit keluar dari card (mis. card cuma untuk lihat,
  klik card lagi untuk ke Draft Editor), supaya HoverCard tetap bisa
  dipakai tanpa melanggar "no critical action inside"** — ditolak;
  menambah friction (dua langkah klik: buka card lalu klik card lagi)
  tanpa manfaat, sementara `Popover` sudah menyediakan pola yang tepat
  tanpa trade-off ini.
- **Gunakan `Tooltip`** — tidak dipertimbangkan serius; `Tooltip`
  ditujukan untuk teks bantuan singkat, bukan preview post dengan
  media, status, metrik, dan CTA.

### Impact / Baseline yang diamandemen

- `project-os/decisions/ADR-090-hovercard-astryx-preview-post-calendar-amandemen-ksp-02-f04.md`
  — header `### Status` ditambah catatan `Accepted — Amended by ADR-091
(2026-08-26)`, dilakukan bersamaan dengan pembuatan ADR ini. Isi body
  (Decision, Context) **tidak diedit** (append-only).
- `product-discovery/04-ux/key-screen-patterns.md` § KSP-02 — F04 dan
  F08: seluruh sebutan "HoverCard"/"Astryx `HoverCard`" diganti
  "Popover"/"Astryx `Popover`".
- `product-discovery/04-ux/navigation-patterns.md` — baris Calendar di §
  "Pola: Item → Editor" dan NP-D15: HoverCard → Popover.
- `project-os/tickets/v02-publishing-mvp.md` § T-033 — T-033.8 dan
  field ADR direvisi menyebut ADR-091 + Popover (bukan HoverCard).
- `project-os/DECISIONS.md` — entri baru ADR-091 + status ADR-090
  diperbarui.
- **Tidak berubah:** konten/anatomi preview (avatar, caption, media,
  status, metrik, CTA), scope Calendar-only (Queue/Drafts tetap tidak
  berubah), mapping metrik ke `PostMetrics` (ADR-090 poin 2) — semua
  keputusan substansi ADR-090 lainnya tetap berlaku.
- **Implementasi kode/Design System belum berjalan** — koreksi ini
  terjadi di tahap prompt/perencanaan, sebelum satu markup pun ditulis
  di Claude Design.

---
