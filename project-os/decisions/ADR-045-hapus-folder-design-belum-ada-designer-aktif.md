## Decision ADR-045

### Title

Hapus Folder `design/` — Belum Ada Designer Aktif

### Status

Accepted

### Date

2026-07-28

### Decision

1. Folder `design/` (`README.md`, `DESIGN_OVERVIEW.md`, `DESIGN_BRIEF.md`,
   `DESIGN_ONEPAGER.html`, 2 PDF handoff, `_build-brief-pdf.mjs`) **dihapus**
   dari repo. Folder ini dulu disiapkan sebagai paket handoff operasional
   untuk tim designer (ADR-042), tapi belum ada designer yang bergabung di
   project — paket tersebut menganggur tanpa dipakai siapa pun.
2. Pointer project **Claude Design** (project `Social Media Management`,
   projectId `84aded99-bb23-49b1-be9f-dd8f21c6873e`, akses claude.ai/design,
   sync manual/on-request lewat tool `DesignSync`) **dipindah** ke
   `context/ctx-design.md` — bukan dihapus. Project Claude Design itu sendiri
   (live di claude.ai/design) **tidak terdampak**; yang dihapus hanya cermin
   teksnya di repo.
3. **Tidak mengubah** keputusan inti ADR-038 (SoT design tokens tetap
   `product-discovery/06-engineering/design-tokens.md`) maupun ADR-042
   (Claude Design tetap design handoff tool, `04-ux/` tetap SoT alur/UX).
   ADR ini hanya mencabut keberadaan folder `design/` sebagai lokasi
   penyimpanan paket handoff — bagian ADR-038 poin 3 dan ADR-042 poin 1 & 6
   yang menyebut `design/README.md` sebagai lokasi pointer dianggap
   **superseded** oleh ADR ini; keputusan lain di kedua ADR tersebut tetap
   berlaku.
4. Saat designer benar-benar bergabung, paket handoff disusun ulang dari
   `product-discovery/04-ux/` + `design-tokens.md` (bukan dari histori file
   yang sudah dihapus) — lihat `context/ctx-design.md`.
5. Referensi ke `design/` di dokumen lain (`AGENTS.md`, `context/README.md`,
   `context/ctx-technical-context.md`, `project-os/PROJECT_OVERVIEW.md`,
   `PROJECT_STATE.md`, `README.md`, `DEVELOPER_WORKFLOW.md`,
   `.agents/skills/project-os-navigator/SKILL.md`,
   `product-discovery/README.md`, `product-discovery/06-engineering/README.md`,
   `product-discovery/06-engineering/design-tokens.md`,
   `product-discovery/04-ux/README.md`) diperbarui mengikuti keputusan ini.
   Entri lama di dokumen append-only (`DECISIONS.md`, `CHANGELOG.md`,
   `CONVERSATIONS.md`) yang menyebut `design/` **tidak diubah** — tetap sah
   sebagai catatan historis pada saat ditulis.

### Reason

- `design/` terbukti tidak pernah dibaca AI untuk mengerjakan UI (SoT UI
  yang benar-benar dipakai: `04-ux/` untuk alur, `design-tokens.md` untuk
  token, Astryx CLI lokal untuk komponen — lihat `ctx-design.md`). Folder
  ini murni untuk designer manusia yang belum ada.
- Menyimpan paket handoff yang tidak dipakai menambah beban sinkronisasi
  (4 inkonsistensi ditemukan saat audit dokumentasi 2026-07-28) tanpa
  manfaat nyata selama tidak ada designer aktif.
- Pointer project Claude Design tetap bernilai (project live tetap ada,
  dan akan dibutuhkan lagi saat designer join atau token di-lock) — sehingga
  dipindah, bukan dihapus begitu saja.

### Alternatives Considered

- Hapus total termasuk pointer Claude Design — ditolak; project Claude
  Design masih live dan project ID/akses akan dibutuhkan lagi nanti, jadi
  menghapusnya tanpa jejak berarti harus dicari ulang dari awal.
- Pertahankan `design/` apa adanya, cukup perbaiki 4 inkonsistensi yang
  ditemukan — ditolak; folder tetap menganggur dan berisiko drift lagi di
  audit berikutnya selama tidak ada designer yang benar-benar memakainya.
- Rename folder jadi `design/` → arsip terpisah (mis. `.archive/design/`)
  daripada hapus — ditolak; menambah lokasi baru untuk dirawat tanpa
  menyelesaikan akar masalah (tidak ada yang memakai).

---
