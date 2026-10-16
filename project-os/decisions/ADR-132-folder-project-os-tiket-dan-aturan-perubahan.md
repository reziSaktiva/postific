## Decision ADR-132

### Title

Folder proses kerja menjadi `project-os/`, rumah kerja menjadi tiket, dan tiga aturan untuk setiap perubahan (amandemen ADR-011 dan ADR-131)

### Status

Accepted

### Date

2026-10-16

### Decision

1. Folder `project-manager/` berganti nama menjadi `project-os/`. Isi dan perannya tetap: cara kerja, keputusan, status, dan tiket. Badan ADR-011 yang menamai folder itu `project-manager/` adalah sejarah keputusan pemisahan dari `product-discovery/`.
2. Folder `tasks/` berganti nama menjadi `tickets/`. File antrian `AVAILABLE_TASKS.md` berganti nama menjadi `AVAILABLE_TICKETS.md`. Nomor tiket `T-NNN` tidak diubah dan tidak didaur ulang.
3. Tiga aturan untuk setiap perubahan:

**Kode butuh tiket.** Perubahan di `apps/` dan `packages/` hanya terjadi untuk tiket yang sudah ada. Tiket boleh ditulis di sesi yang sama, sebelum baris kode pertama. Perubahan dokumen (baseline, `context/`, ADR, teks tiket, status) tidak memakai aturan ini. Perbaikan yang memang isi tiket yang sedang dikerjakan tetap di tiket itu. Perilaku baru yang ketemu di tengah jalan mendapat tiket sendiri sebelum kode perilaku itu ditulis.

**Known Issue menghasilkan tiket.** KI yang masih terbuka menunjuk satu tiket. Kalau tiketnya sudah ada, tidak dibuat duplikat. Baris KI di `PROJECT_STATE.md` cukup menyebut ID dan tiket. KI keluar dari daftar itu saat tiket penutupnya selesai. Rahasia (env, kredensial) tetap diisi King Rezi. Tiketnya ada supaya kerjanya kelihatan. Agent tidak mengarang nilai rahasia itu.

**Dokumen ditulis berurutan.** Kalau kebenaran produk berubah: `product-discovery/` dulu, `context/` hanya bila penunjuk atau aturan operasionalnya ikut berubah, lalu `project-os/` (ADR, tiket, phase). Satu paragraf tidak disalin ke ketiga tempat. Agent yang mencari kerja tersedia tetap mulai dari `AVAILABLE_TICKETS.md`.

Pada tanggal keputusan ini, KI yang tiketnya sudah selesai dikeluarkan dari `PROJECT_STATE.md`. KI yang belum punya tiket mendapat tiket baru: T-119 (KI-015), T-120 (KI-033), T-121 (KI-050), T-122 (KI-053, sisa bukti), T-123 (KI-089). KI-027 tetap di T-008. KI-028 tetap di T-088.

Sebutan `project-manager/`, `tasks/`, dan `TASKS.md` di badan ADR yang lebih lama adalah sejarah. Path yang masih dipakai sehari-hari adalah `project-os/`, `tickets/`, dan `AVAILABLE_TICKETS.md`.

### Reason

- Nama folder `project-manager/` bentrok dengan peran subagent Project Manager, sementara sistemnya sudah disebut Project OS.
- Kata "task" dan "tiket" dipakai bergantian setelah ADR-131. Satu nama membuat antrian dan file rilis sama artinya.
- Kode tanpa tiket membuat perubahan yang tidak punya rumah, dan KI tanpa tiket membuat masalah yang hidup sebagai esai.

### Alternatives Considered

- Mengganti nomor `T-NNN` menjadi ID baru — ditolak. Nomor itu sudah dikutip di ADR, commit, dan kode.
- Menulis ulang badan ADR lama supaya semua path ikut nama baru — ditolak. Status Amended by cukup. Path hidup ada di dokumen operasional.
