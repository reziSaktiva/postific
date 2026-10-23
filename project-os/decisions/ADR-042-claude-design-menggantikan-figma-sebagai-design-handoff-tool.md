## Decision ADR-042

### Title

Claude Design Menggantikan Figma sebagai Design Handoff Tool

### Status

Accepted — Amended by ADR-045 (2026-07-28), ADR-056 (2026-07-31)

### Date

2026-07-24

### Decision

1. **Claude Design** (project `Social Media Management`, projectId
   `84aded99-bb23-49b1-be9f-dd8f21c6873e`, diakses lewat tool `DesignSync`
   bawaan Claude Code — bukan MCP terpisah) menggantikan referensi Figma
   sebagai design handoff tool di `design-tokens.md` dan `design/README.md`.
2. `product-discovery/04-ux/` **tetap** Source of Truth untuk alur, IA, dan
   fungsi layar. Claude Design hanya menampung representasi visual
   (foundations, components, dan 8 layar KSP-01–08) yang diturunkan dari
   baseline tersebut — bukan pengganti UX Baseline, selaras aturan
   `ctx-design.md` butir 1.
3. Sinkronisasi antara `product-discovery/` dan project Claude Design bersifat
   **manual, on-request** — dijalankan oleh agent lewat `DesignSync` saat
   diminta eksplisit oleh Project Owner. Tidak ada trigger otomatis
   (webhook/polling) yang menjalankan sinkronisasi sendiri; ini batas teknis
   yang disadari, bukan kelalaian.
4. `design-tokens.md` Langkah 1 ("Review & approve di Figma") diamendemen
   menjadi "Review & approve di project Claude Design 'Social Media
   Management'". Langkah 2–5 (isi tabel token, ubah status ke Locked, catat
   ADR, mirror ke Astryx theme + Tailwind token bridge) tidak berubah.
5. Bila desain di Claude Design bertentangan dengan UX Baseline (`04-ux/`)
   yang sudah dikunci, **baseline + ADR yang menang** — perubahan harus lewat
   diskusi dan update baseline, bukan otomatis diikuti.
6. **Ruang lingkup:** keputusan ini hanya mengganti Figma sebagai _design
   handoff tool_ (token, komponen, layar UI — konteks `design-tokens.md` dan
   `design/`). Sebutan "Figma" di `project-os/ARCHITECTURE_OVERVIEW.md`,
   `project-os/README.md`, dan skill `project-os-navigator/SKILL.md`
   merujuk hal berbeda (kanvas untuk menggambar ulang diagram arsitektur
   sebagai orientasi) dan **tidak terdampak** ADR ini.

### Reason

- Project tidak memiliki lisensi/akses Figma; Claude Design tersedia langsung
  lewat login claude.ai tanpa setup tambahan dan terintegrasi dengan workflow
  Claude Code yang sudah dipakai project ini.
- Menjaga jumlah tools tetap minim — satu design tool operasional (Claude
  Design) dibanding menambah Figma sebagai dependency baru untuk solo
  developer.
- Sinkronisasi otomatis dua arah tidak tersedia secara teknis (tidak ada
  webhook/trigger yang menjalankan Claude Code sendiri); manual on-request
  adalah opsi yang jujur secara kemampuan dan cukup untuk kebutuhan project
  saat ini.

### Alternatives Considered

- Tetap referensi Figma di `design-tokens.md` — ditolak; project tidak punya
  akses/lisensi Figma dan tidak ada kebutuhan mendesak untuk itu.
- Checklist wajib cek Claude Design di setiap sesi kerja UI (mirip workflow
  Astryx CLI di `AGENTS.md`) — ditolak untuk saat ini; menambah friction pada
  task UI kecil tanpa manfaat sepadan selama fase awal M8.
- Sync otomatis (webhook atau polling terjadwal) — ditolak; tidak ada
  infrastruktur untuk itu saat ini, dan kompleksitas tambahan tidak sepadan
  untuk workflow solo developer.

---
