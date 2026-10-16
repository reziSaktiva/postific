## Decision ADR-133

### Title

`AGENTS.md` root menjadi pintu tipis — isi yang sudah punya rumah di dokumen lain pindah jadi penunjuk satu baris

### Status

Accepted

### Date

2026-10-16

### Decision

`AGENTS.md` root tetap menjadi pintu masuk sesi, tapi isinya dibatasi pada hal yang benar-benar berlaku untuk setiap giliran. Bagian yang sudah punya rumah di dokumen lain (pohon `context/`, tabel subagent, peta "baca dulu" per jenis sesi, workflow shadcn CLI/MCP) menjadi penunjuk satu baris ke rumah itu, bukan disalin ulang.

**Tetap di `AGENTS.md`, dalam bentuk pendek:**

1. Satu kalimat proyek + package manager Bun.
2. Sapaan King Rezi, lima kata ajaib, nama Jokowi (AI utama) + laporan singkat saat dipanggil dengan nama itu.
3. Larangan ubah baseline Architecture/Engineering/Product/Business tanpa ADR baru.
4. Entry point (RSC, Server Actions, Route Handlers, Middleware) tanpa business logic; domain logic tidak mengimpor Prisma, Supabase client, atau HTTP client Outstand.
5. Cross-domain lewat public API module domain lain; shared types hanya di `packages/shared`.
6. Supabase JS client hanya Realtime + Storage; CRUD lewat Prisma.
7. Status fase/milestone/progress hanya di `PROJECT_STATE.md`; status per-tiket di `AVAILABLE_TICKETS.md` + `tickets/vXX-*.md` (ADR-131, ADR-132).
8. Persona kanonikal: Raka, Maya, Sinta, Dimas, Lara. Bahasa komunikasi & dokumentasi: Bahasa Indonesia.
9. Commit/push hanya kalau diminta eksplisit; jangan commit secret; jangan commit langsung ke `main` atau `staging` (buat branch `feature/*` atau `fix/*` dulu).
10. UI produk memakai shadcn/ui (ADR-097); gerbang Claude Design wajib sebelum menulis kode UI, termasuk gerbang pola ambigu (lahir dari KI-054/KI-055).
11. Outstand: jangan menghidupkan lagi Fake adapter di jalur produksi untuk kapabilitas baru (ADR-119).
12. Satu kalimat bahwa dua pasang berkas kembar (config MCP, proteksi baca secret) wajib diubah bersamaan di Claude Code dan Cursor (ADR-064) — tabel detailnya pindah ke `context/ctx-technical-context.md` atau rumah teknis lain, bukan di `AGENTS.md`.
13. Penunjuk ke navigator (`project-os-navigator`) untuk alur kerja, bukan menyalin isinya.
14. Penunjuk satu baris ke higiene sesi (T-118): satu task per percakapan, kapan rantai subagent dipakai.

**Jadi penunjuk satu baris, karena rumahnya sudah ada:**

- Pohon `context/` (daftar 8 file + batasnya) → `context/README.md`.
- Tabel subagent, pemetaan Domain → Subagent, aturan orkestrasi paralel/sekuensial (ADR-063) → `.claude/agents/README.md`.
- Peta "baca dulu" per jenis task dan perilaku per jenis sesi (diskusi, planning, bug, dsb) → `.claude/skills/project-os-navigator/SKILL.md`.
- Workflow shadcn CLI/MCP yang panjang → `apps/web/.claude/CLAUDE.md`.
- Checklist "setelah mengubah sesuatu" (update tiket, `PROJECT_STATE.md`, ADR) → navigator.
- Tabel kompatibilitas aset Claude Code ↔ Cursor (skill, subagent, aset per-tool) → `context/ctx-technical-context.md` (atau rumah teknis yang menunjuk konfigurasi tool), dengan satu kalimat pengingat di `AGENTS.md` (butir 12 di atas) bahwa dua pasang berkas kembar itu ada.
- Aturan "setiap task diklasifikasi UI/UX atau bukan + gerbang Claude Design" tetap sebagai aturan keras ringkas di `AGENTS.md` (butir 10), karena ini gate operasional yang harus selalu terlihat tanpa membuka dokumen lain — bukan dipindah jadi penunjuk.

Setiap aturan keras yang pindah menjadi penunjuk tetap harus bisa ditemukan di dokumen tujuannya; kalau dokumen tujuan belum memuatnya, isi ditambahkan di sana (T-117.3), bukan dikembalikan sebagai esai di `AGENTS.md`.

### Reason

- `AGENTS.md` root (±20 KB) ikut termuat penuh di setiap giliran, di Claude Code maupun Cursor (Cursor memperlakukan setiap berkas bernama `AGENTS.md` sebagai context wajib).
- Sebagian besar isinya adalah salinan yang sudah punya rumah di `context/README.md`, `.claude/agents/README.md`, `.claude/skills/project-os-navigator/SKILL.md`, dan `apps/web/.claude/CLAUDE.md` — duplikasi ini berisiko divergen dari sumbernya (sama seperti alasan ADR-064 menolak symlink untuk dua pasang berkas kembar, tapi di sini duplikasinya adalah esai, bukan config).
- Biaya token berulang di setiap sesi lebih besar daripada biaya satu kali menata ulang pointer.

### Alternatives Considered

- Menghapus seluruh esai tanpa menaruhnya di rumah manapun — ditolak. Aturan keras harus tetap bisa ditemukan; menghapus tanpa memindah membuat pengetahuan hilang.
- Membiarkan `AGENTS.md` apa adanya dan hanya mengandalkan caching model — ditolak. Caching tidak mengurangi biaya baca pertama tiap sesi baru, dan tidak menyelesaikan masalah Cursor yang menyuntikkan file ini penuh di setiap pesan.
- Memecah `AGENTS.md` jadi banyak file kecil yang saling mengimpor — ditolak. Pintu masuk sesi harus tetap satu file tunggal yang pasti terbaca; penunjuk satu baris ke rumah yang sudah ada cukup tanpa menambah lapis indirection baru.
