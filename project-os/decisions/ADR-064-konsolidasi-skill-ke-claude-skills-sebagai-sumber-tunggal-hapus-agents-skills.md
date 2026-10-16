## Decision ADR-064

### Title

Konsolidasi Skill ke `.claude/skills/` sebagai Sumber Tunggal — Hapus
`.agents/skills/`

### Status

Accepted

### Date

2026-08-04

### Decision

1. **`.claude/skills/<nama>/` adalah satu-satunya lokasi skill** di project
   ini — berlaku untuk skill custom project maupun skill vendor/third-party
   (Prisma, Supabase, Vercel, Better Auth).
2. Folder **`.agents/skills/` dihapus** dari repo, beserta seluruh salinan
   fisik skill vendor di dalamnya. Skill yang sebelumnya hanya ada di
   `.agents/skills/` dipindahkan (bukan disalin) ke `.claude/skills/`.
3. Tiga skill custom (`project-os-navigator`, `proactive-clarification`,
   `work-report-simple`) sebelumnya berupa **symlink direktori** dari
   `.claude/skills/` → `.agents/skills/` — pola yang dipakai justru untuk
   mencegah desync. Symlink itu **dibongkar jadi file nyata** di
   `.claude/skills/`, karena dengan hilangnya `.agents/skills/` target
   symlink-nya tidak ada lagi.
4. **Dilarang membuat ulang `.agents/skills/`** kecuali ada keputusan baru
   yang eksplisit dari King Rezi. Installer skill vendor resmi
   (`npx skills add ...`) **defaultnya menulis ke `.agents/skills/`** —
   kalau itu terjadi, hasilnya dipindahkan manual ke `.claude/skills/<nama>`
   lalu folder `.agents/skills/` yang baru terbentuk dihapus. Skill custom
   diedit/ditambahkan langsung di `.claude/skills/<nama>/`.
5. **`.agents/` sengaja tidak dimasukkan ke `.gitignore`.** Meng-ignore-nya
   justru menyembunyikan folder liar dari `git status`, sehingga penulisan
   ulang oleh installer tidak akan terdeteksi. Penegakan aturan poin 4
   mengandalkan `AGENTS.md` + folder yang tetap terlihat di `git status`.
6. Dua stale worktree di `.claude/worktrees/`
   (`status-pekerjaan-6ef926`, `test-787c6a`) **dihapus** lewat
   `git worktree remove`. Keduanya masih menyimpan `.agents/skills/` lengkap
   plus `AGENTS.md` versi lama yang menunjuk ke `.agents/skills/` — kalau ada
   sesi AI berjalan di dalamnya, aturan lama yang terbaca dan duplikasi bisa
   hidup kembali. Diverifikasi tidak ada commit unik (`main..HEAD` kosong) dan
   perubahan uncommitted-nya hanya noise formatting prettier pada file skill
   vendor, bukan pekerjaan nyata.
7. Referensi operasional ke `.agents/skills/` di `AGENTS.md`,
   `context/ctx-project.md`, `project-os/DEVELOPER_WORKFLOW.md`,
   `project-os/PROJECT_STATE.md`, dan `.claude/agents/README.md`
   diperbarui ke `.claude/skills/`. Entri lama di dokumen append-only
   (`DECISIONS.md`, ADR yang sudah Accepted, `COMPLETE_TASK.md`,
   `CONVERSATIONS.md`) **tidak diubah** — tetap sah sebagai catatan historis
   pada saat ditulis.
8. **`.claude/**` ditambahkan ke ignore list `eslint.config.mjs` dan
   `.prettierignore`, menggantikan `.agents`** yang sudah tidak ada. Skill
   (vendor maupun custom) bukan kode project dan tidak boleh masuk cakupan
   lint/format. Entri `design/` yang sudah mati sejak ADR-045 dibersihkan
   sekalian dari kedua file.
9. **Paritas Claude Code ↔ Cursor ditetapkan dan didokumentasikan** di section
   "Kompatibilitas tool" pada `AGENTS.md`. Hasil verifikasi ke dokumentasi
   resmi Cursor: `AGENTS.md`, `.claude/skills/`, dan `.claude/agents/`
   **terbaca di kedua tool** (dua yang terakhir lewat compatibility path).
   Dua aset **tidak** punya jalur kompatibilitas dan karena itu sengaja
   diduplikasi sebagai file kembar:
   - Config MCP → `.mcp.json` (Claude Code) + **`.cursor/mcp.json`** (Cursor).
   - Proteksi baca secret → `permissions.deny` di `.claude/settings.json`
     (Claude Code) + **`.cursorignore`** (Cursor).
     Keduanya **wajib diubah bersamaan** dalam satu perubahan. `.claude/launch.json`
     tidak punya padanan di Cursor — dev server dijalankan manual di sana.
10. **Duplikasi pada dua file kembar di poin 9 diterima sebagai pengecualian
    sadar**, bukan pelanggaran prinsip single-source di poin 1. Bedanya
    material: skill adalah **konten prompt** yang bisa hidup di satu lokasi
    yang dibaca kedua tool, sedangkan config MCP dan proteksi secret adalah
    **deklarasi khusus-client** — tiap tool hanya membaca formatnya sendiri,
    jadi tidak ada satu lokasi yang bisa melayani keduanya. Mitigasinya
    dokumentasi kewajiban sinkron (poin 9), bukan symlink — symlink justru
    pola rapuh yang dibuang di poin 3.

### Reason

- **Dua salinan fisik = risiko divergensi.** Skill vendor ada lengkap di dua
  tempat sekaligus; tidak ada mekanisme yang menjamin keduanya identik.
  Skill custom sempat "diamankan" dengan symlink, tapi itu berarti project
  punya dua pola berbeda untuk masalah yang sama — sulit dijelaskan dan
  mudah salah diikuti.
- **Cursor terbukti bisa membaca `.claude/skills/`.** Per
  [dokumentasi Cursor](https://cursor.com/docs/skills), skill dimuat dari
  `.agents/skills/`, `.cursor/skills/`, dan — untuk kompatibilitas —
  `.claude/skills/` serta `.codex/skills/`. Jadi menghapus `.agents/skills/`
  tidak menghilangkan akses Cursor ke skill project.
- **Claude Code hanya membaca `.claude/skills/`.** Karena itu `.claude/skills/`
  adalah satu-satunya kandidat lokasi yang berfungsi untuk _kedua_ tool tanpa
  duplikasi — `.agents/skills/` tidak terbaca Claude Code sama sekali.
- Symlink direktori menambah beban kognitif dan rapuh di lingkungan yang tidak
  meng-handle symlink dengan baik (checkout Windows, beberapa CI runner,
  sebagian tooling yang menyalin file). File nyata lebih sederhana.

### Konsekuensi & Risiko yang Diterima

- `.claude/skills/` di Cursor didokumentasikan sebagai **legacy compatibility
  path**, bukan lokasi primary. Kalau nanti project pindah/menambah tool AI
  yang hanya comply ke standar terbuka
  [Agent Skills](https://agentskills.io) (lokasi native: `.agents/skills/`)
  tanpa special-case untuk Claude, skill di sini berisiko tidak otomatis
  terbaca. Keputusan ini **wajib dievaluasi ulang** kalau situasi itu terjadi.
- `skills-lock.json` **tidak menyimpan install path** (hanya `source`,
  `skillPath`, dan hash per skill), sehingga `npx skills add/update`
  berikutnya tetap akan menulis ke `.agents/skills/`. Mitigasinya manual
  (poin 4), bukan otomatis. Hash di lock file tetap valid karena file skill
  vendor dipindahkan byte-identical.
- Dua file kembar di poin 9 (`.cursor/mcp.json`, `.cursorignore`) **bisa
  divergen** dari pasangannya karena tidak ada mekanisme otomatis yang
  memaksa sinkron — hanya aturan tertulis di `AGENTS.md`. Risiko yang paling
  berbahaya: `.cursorignore` ketinggalan saat pola file rahasia baru
  ditambahkan ke `.claude/settings.json`, sehingga Cursor kehilangan proteksi
  baca secret **tanpa peringatan apa pun**. Kalau pasangan file ini terbukti
  drift di audit berikutnya, pertimbangkan test/CI check yang membandingkan
  keduanya.
- Klaim "Cursor tidak membaca `.mcp.json` root" berasal dari
  [dokumentasi MCP Cursor](https://cursor.com/docs/mcp) yang hanya menyebut
  `.cursor/mcp.json` dan `~/.cursor/mcp.json`. **Terverifikasi langsung oleh
  King Rezi** (2026-08-04): setelah `.cursor/mcp.json` dibuat, server `xds`
  aktif di Cursor — konsisten dengan dokumentasi, jadi file ini memang
  diperlukan dan bukan duplikasi sia-sia.
- Tiga skill vendor Vercel (`vercel-optimize`, `vercel-react-best-practices`,
  `vercel-composition-patterns`) membawa `AGENTS.md`/`README.md` bawaan
  upstream yang masih menginstruksikan `mkdir -p .agents/skills` — teks
  vendor, kontradiktif dengan ADR ini tapi tidak dieksekusi siapa pun karena
  tidak ada yang bekerja di dalam folder skill. Dibiarkan agar tree vendor
  tetap utuh terhadap upstream.

### Alternatives Considered

- **Pertahankan dua folder, samakan isinya secara berkala** — ditolak; itu
  persis kondisi yang memicu masalah ini. Tidak ada yang menjamin sinkronisasi
  selain kedisiplinan manual.
- **Balik arah: `.agents/skills/` jadi sumber tunggal, `.claude/skills/` jadi
  symlink** — ditolak; Claude Code adalah tool utama di project ini dan hanya
  membaca `.claude/skills/`. Menaruh sumber di lokasi yang tidak dibaca tool
  utama berarti bergantung pada symlink secara permanen untuk fungsi dasar.
- **Simpan skill di satu folder, symlink dari folder lain** (pola lama,
  diperluas ke skill vendor) — ditolak; menyelesaikan desync tapi
  mempertahankan kerapuhan symlink dan tetap menyisakan dua path di
  dokumentasi yang harus dijelaskan ke setiap agent baru.
- **Tambahkan `.agents/` ke `.gitignore` sebagai pengaman** — ditolak; lihat
  poin 5. Menyembunyikan gejala, bukan mencegah penyebabnya.

---
