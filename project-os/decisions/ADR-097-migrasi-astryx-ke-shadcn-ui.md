## Decision ADR-097

### Title

Migrasi UI Component System dari Astryx ke shadcn/ui — Reverse ADR-041

### Status

Accepted

### Date

2026-09-01

### Decision

1. **shadcn/ui menggantikan Astryx** sebagai fondasi komponen UI permanen
   project — membalik ADR-041 poin 1 (yang saat itu memilih Astryx dan
   menolak shadcn/ui secara eksplisit).
2. Migrasi dilakukan **incremental per route-segment**, bukan big-bang.
   Astryx dan shadcn/ui boleh hidup berdampingan sementara selama migrasi
   berjalan, supaya M8 (Development) tetap berjalan paralel tanpa freeze
   fitur. Urutan migrasi: core infra/shared primitives → Auth &
   Onboarding → App Shell & Navigasi → Settings → Publish (Draft Editor,
   Calendar, Queue, Drafts) → Dashboard → cleanup. Detail task:
   `tickets/v07-astryx-shadcn-migration.md`.
3. **MCP server shadcn** dipasang sebagai tooling agent, menggantikan peran
   `xds` (Astryx) untuk pencarian/lookup komponen — didaftarkan di
   `.mcp.json` **dan** `.cursor/mcp.json` sekaligus (dua file kembar wajib
   sinkron, ADR-064).
4. **Tailwind CSS v4** (CSS-first, tanpa `tailwind.config.js`) tetap
   dipertahankan sebagai layer styling utama. Pembatasan "Tailwind
   layout-only" dari ADR-041 poin 3 **tidak lagi berlaku** untuk komponen
   shadcn — shadcn/ui adalah kode sumber yang di-_copy_ langsung ke repo
   (bukan dependency package tertutup seperti Astryx), sehingga styling
   komponennya memang berbentuk Tailwind classes langsung pada markup.
   Aturan lint yang menolak `<div>` mentah / hex hardcode tetap berlaku
   sebagai prinsip, disesuaikan ke konvensi shadcn.
5. `apps/web/.claude/CLAUDE.md` (agent docs Astryx, auto-generated) ditulis
   ulang total mengikuti workflow shadcn CLI/MCP.
6. **AGENTS.md rule 14 & 15** diperbarui: UI produk memakai shadcn/ui;
   sebelum menulis/mengubah komponen, cek dulu registry/MCP/CLI shadcn
   (bukan lagi Astryx).
7. Wrapper selektif `apps/web/src/components/ui/Drawer.tsx` (dibuat karena
   Astryx tidak punya primitive Drawer/side-sheet) **dihapus**, diganti
   komponen shadcn `Sheet` asli.
8. Definisi subagent **Mark UI Engineer**
   (`.claude/agents/mark-ui-engineer.md`, diklasifikasikan Static
   Reference, chmod 444) perlu diperbarui dari "Astryx" ke "shadcn" —
   dicatat sebagai task terpisah (`T-095.6`) karena file itu hanya boleh
   diubah atas permintaan eksplisit King Rezi, bukan diedit diam-diam
   sebagai efek samping ADR ini.
9. Keputusan ini:
   - **membalik ADR-041** poin 1 sepenuhnya (Astryx → shadcn/ui);
   - **mengamendemen ADR-055** (dark mode Astryx) — mekanisme toggle
     light/dark tetap dipertahankan lewat Tailwind `dark:` + shadcn theme
     provider; `ThemeModeContext` custom project (cookie-persisted, sudah
     independen dari Astryx) **tidak berubah**;
   - **mengamendemen ADR-057** (Claude Design menggantikan peran
     designer) — Claude Design tetap jadi satu-satunya sumber rancangan
     visual dan gate rule 17 AGENTS.md tetap berlaku penuh; yang berubah
     hanya fondasi _implementasi_ komponennya, bukan proses desainnya;
   - **mengamendemen ADR-082** (Astryx Tailwind-only, hapus StyleX/xstyle)
     — jadi tidak relevan lagi karena Astryx sendiri sudah tidak dipakai;
     keputusan "tanpa StyleX/xstyle" tetap berlaku secara default karena
     shadcn tidak memakai keduanya;
   - **tidak mengubah** ADR-087 (theme Stone) sebagai keputusan visual —
     nilai token warna/font Stone dipakai sebagai acuan saat memetakan ke
     CSS variable shadcn (`T-095.5`), bukan dibuang begitu saja.

### Reason

- Audit menyeluruh 2026-09-01 menemukan **49 file / ~44 komponen** Astryx
  dipakai di `apps/web/src`, seluruhnya terisolasi di layer presentasi
  (`app/` + `components/`) — layer `domains/` dan `lib/` (business logic)
  sudah 100% bersih dari dependency UI, sehingga migrasi _feasible_ tanpa
  menyentuh business logic sama sekali.
- Astryx masih Beta (KI-005) dan sudah berulang kali menimbulkan
  keterbatasan konkret yang tidak bisa diperbaiki dari sisi project karena
  sifatnya closed-package: **KI-030** (`TimeInput` tanpa input-guard, tidak
  ada prop resmi `maxLength`/`pattern`), **KI-035** (`Badge` tanpa prop
  `size`/truncation, StyleX/`xstyle` gagal disetup di Next App
  Router+Turbopack), dan berkontribusi pada kompleksitas **KI-040**
  (wrapper custom `Drawer` karena primitive tidak tersedia, mempersulit
  verifikasi visual pixel-perfect terhadap Claude Design).
- shadcn/ui adalah kode sumber yang di-_copy_ langsung ke repo, bukan
  dependency package tertutup — memberi kontrol penuh untuk memperbaiki
  gap seperti di atas tanpa menunggu rilis upstream Astryx.
- King Rezi (Project Owner) memutuskan trade-off effort migrasi di M8
  (masih berjalan, bisa dilakukan incremental) lebih baik daripada terus
  mengakumulasi technical debt/keterbatasan Beta ke fase project lanjut
  (M9 Testing & Release, lalu production).

### Alternatives Considered

- Tetap bertahan dengan Astryx menunggu rilis stabil — ditolak; tidak ada
  linimasa pasti dari vendor, dan gap sudah berulang terjadi (KI-030,
  KI-035, KI-040).
- Migrasi big-bang (freeze seluruh fitur M8 sampai migrasi selesai) —
  ditolak; King Rezi memilih pendekatan incremental supaya M8 tetap
  berjalan paralel dengan migrasi.
- Wrapper menyeluruh di atas Astryx untuk menutup semua gap komponen yang
  ditemukan — ditolak (konsisten dengan penolakan serupa di ADR-041),
  menambah abstraksi berat tanpa menyelesaikan akar masalah (Beta, API
  tidak stabil, tidak ada kontrol atas source).

---
