## Decision ADR-140

### Title

Artifact di Claude Menggantikan Claude Design Standalone dan `DesignSync` sebagai Referensi Visual (Menggantikan ADR-042 dan ADR-056)

### Status

Accepted

### Date

2026-10-26

### Decision

Claude Design standalone (claude.ai/design) tutup pada **2026-12-14**. Tool `DesignSync` bawaan Claude Code juga hanya ditujukan untuk menyinkronkan pustaka komponen lokal dari project design-system, bukan untuk menggambar layar. Karena itu referensi visual Postific pindah ke **artifact di Claude**. Fungsi yang sudah ada tetap berlaku: rancangan dulu, baru kode.

1. **Tempat referensi visual.**
   - Artifact **Postific** (tipe Design System): https://claude.ai/artifact/FdRNU4gnxgAGY3zmBxNfR3. Isinya token (`project/tokens.json`, `project/tokens.css`), komponen shadcn asli (bundle dari `apps/web/src/components/ui`, satu folder per komponen di `project/components/<Nama>/`), dan kartu layar (`project/components/Screen<Nama>/preview.html`). File template asli ada di `project/templates/`.
   - Artifact **Postific Design Review**: https://claude.ai/artifact/4BJCWNsCwubLd7SFwRtree. Galeri semua layar dengan menu samping, tempat King Rezi meninjau dan mengonfirmasi rancangan. Artifact Postific tidak punya tab khusus layar, jadi peninjauan dilakukan di galeri ini.
   - Project Claude Design lama (`84aded99-bb23-49b1-be9f-dd8f21c6873e`) diperlakukan **hanya-baca** dan dilepas sebelum 2026-12-14. Perubahan baru tidak ditulis ke sana.
2. **Gerbang `AGENTS.md` aturan 10 tetap.** Task UI/UX tidak boleh menulis kode sebelum rancangannya ada di artifact Postific. Kalau belum ada, berhenti dan beri tahu King Rezi. Kalau ada tetapi pola konkretnya ambigu (lebih dari satu pola shadcn/ui valid), berhenti dan tanya lewat `AskUserQuestion`. Yang berubah hanya tempatnya, dari "Claude Design lewat `DesignSync`" menjadi "artifact Postific".
3. **Cara membuat atau mengubah rancangan.** Memakai tool `Artifact` (bukan `DesignSync`):
   - Layar baru dibuat sebagai halaman HTML, ditambahkan ke Postific Design Review, dan ditambahkan sebagai kartu `Screen<Nama>` di artifact Postific.
   - Perubahan komponen dilakukan di artifact Postific. Nilai visual komponen diambil dari kode asli (`apps/web/src/components/ui`, `apps/web/src/app/globals.css`), bukan dibuat dengan tangan. Rujukan `@astryxdesign` pada instruksi lama sudah tidak berlaku sejak ADR-097.
   - Perubahan pada artifact yang sudah ada mengikuti aturan tipe artifact: baca dulu, ubah seperlunya, publish ulang, indeks `design-system.json` ditulis paling akhir.
4. **Konfirmasi sebelum kode.** Setiap rancangan baru atau yang berubah wajib ditinjau dan dikonfirmasi King Rezi di Postific Design Review sebelum kode ditulis. Konfirmasi dicatat di gate Claude Design pada tiket terkait (pola yang dipakai T-151, T-156, T-157).
5. **Disiplin scope tetap** (ADR-052): jangan mengubah default atau state yang sudah disetujui sebagai efek samping, tanyakan bila scope ambigu, dan verifikasi bahwa tidak ada perubahan tak diminta. Skill `claude-design-scope-discipline` tetap berlaku untuk artifact.
6. **Status token tetap co-equal** (ADR-056 poin 1): `design-tokens.md` dan token di artifact Postific setara, tidak ada yang wajib menjadi penulis pertama. Nilai yang berjalan di kode ada di `apps/web/src/app/globals.css`. Alur, struktur, dan fungsi layar tetap bersumber dari `product-discovery/04-ux/`; bila rancangan bertentangan dengan baseline yang sudah dikunci, baseline dan ADR menang.
7. **Reminder proaktif tetap wajib** (ADR-056 poin 3). Setiap kali AI mengubah atau mendeteksi perubahan UI/UX, baik di dokumen maupun di artifact, AI wajib memberi tahu King Rezi bahwa kedua sisi berpotensi belum sinkron dan menanyakan apakah perlu diselaraskan sekarang.
8. **Sinkronisasi tetap manual dan on-request** (ADR-042 poin 3). Tidak ada sinkronisasi otomatis. Arah yang dimaksud selalu dikonfirmasi ke King Rezi.
9. **`DesignSync` tidak dipakai lagi** untuk menulis. Boleh dipakai hanya untuk membaca project lama sampai dilepas. Catatan kegagalan `DesignSync` di sesi subagent (`.claude/agents/README.md`) tidak berlaku lagi.

### Reason

- Claude Design standalone tutup; bergantung padanya berarti kehilangan referensi visual pada 2026-12-14.
- Migrasi project lama ke artifact Postific sudah dilakukan dan dipakai dalam peninjauan rancangan MCP (T-151, T-156, T-157). Di sana komponen kini memakai shadcn asli, yang lebih setia ke kode daripada mockup CSS lama.
- Artifact tidak punya tab layar, dan stylesheet halaman bergantung pada `tokens.css`. Galeri review terpisah menutup celah itu dan memberi King Rezi satu tempat untuk meninjau.
- Aturan yang sudah terbukti (gerbang rancangan dulu, disiplin scope, reminder sinkronisasi) dipertahankan; hanya alat dan tempatnya yang diganti.

### Alternatives Considered

- **Tetap memakai Claude Design standalone sampai ditutup.** Ditolak: perubahan baru akan hilang atau harus dimigrasi lagi dalam waktu dekat.
- **Hanya artifact Postific tanpa galeri review.** Ditolak: layar tidak punya tab sendiri sehingga sulit ditinjau (dialami King Rezi saat peninjauan T-151, T-156, T-157).
- **Menyimpan rancangan layar sebagai HTML di repo.** Ditolak: menambah salinan yang harus dijaga sinkron dan mengembalikan folder `design/` yang sudah dihapus (ADR-045).
- **Sinkronisasi otomatis antara dokumen dan artifact.** Ditolak: tidak ada infrastruktur, sama seperti alasan ADR-042.

### Consequences

- Dokumen kerja yang menyebut Claude Design atau `DesignSync` diperbarui: `AGENTS.md` (aturan 10), `context/ctx-design.md`, subagent Neymar, Mark, Prabowo, Najwa, `.claude/agents/README.md`, skill `claude-design-scope-discipline` dan `project-os-navigator`, `project-os/DEVELOPER_WORKFLOW.md`, dan penunjuk di `context/` serta `design-tokens.md`.
- ADR-042 dan ADR-056 berstatus Superseded. ADR-045 (folder `design/` dihapus) dan ADR-057 (tidak ada designer eksternal) tetap berlaku; yang berganti hanya alatnya.
- Belum terbukti: apakah tool `Artifact` termuat di sesi subagent. Kalau tidak, pekerjaan desain dikerjakan di sesi utama dengan izin King Rezi, sama seperti pola lama untuk `DesignSync`.
  **Update 2026-10-26:** terbukti. Neymar Product Designer dan Najwa QA Engineer sama-sama berhasil memanggil `Artifact` (read, dan list oleh Neymar) di sesi subagent; pesan fallback di atas tetap berlaku hanya sebagai penanganan bila kelak gagal. Catatan operasional diperbarui di `.claude/agents/README.md`.
- Galeri review tidak sinkron otomatis dengan artifact Postific. Saat layar berubah, keduanya dipublish ulang.
- Tugas yang tersisa: lepaskan project Claude Design lama sebelum 2026-12-14.

### Related

- Menggantikan ADR-042 (Claude Design menggantikan Figma) dan ADR-056 (sinkronisasi dan reminder proaktif). Poin yang dipertahankan dari keduanya tertulis di atas.
- Tidak mengubah ADR-045, ADR-052 (scope discipline), ADR-057, ADR-097.
- Tiket yang sudah memakai pola ini: `tickets/v05-mcp-server-mvp.md` (T-151, T-156, T-157).
