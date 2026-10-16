## Decision ADR-066

### Title

Known Issues Berstruktur dengan ID `KI-XXX` di `PROJECT_STATE.md`

### Status

Accepted — Amended by ADR-067 (2026-08-05)

### Date

2026-08-05

### Decision

King Rezi menilai section `Known Issues` di `PROJECT_STATE.md` kurang profesional dibanding backlog task (`TASKS.md` + `tickets/`) — berupa bullet paragraf panjang tanpa ID, tanpa kategori, dan tanpa status yang bisa direferensikan langsung. Sebagai gantinya:

- Setiap entry `Known Issues` mendapat **ID global berurutan `KI-001` … `KI-NNN`**, terpisah dari namespace task (`T-XXX`) — supaya tidak ambigu antara "sudah jadi task resmi" vs "masih catatan temuan".
- Setiap entry memakai **field table ringkas**: `Status` (Open / Resolved / Promoted to T-XXX), `Kategori` (Bug, Dependency, Tech-Debt, Code Consistency, Process, dll.), `Terkait` (task ID kalau ada), `Ditemukan` (tanggal, kalau diketahui) — diikuti deskripsi singkat.
- **ID tidak pernah didaur ulang.** Issue yang selesai tetap tercatat dengan status `Resolved` (atau `Promoted to T-XXX` kalau naik jadi task resmi), bukan dihapus dari daftar — konsisten dengan aturan ID task di ADR-062. **[Diamandemen oleh ADR-067]** Entry `Resolved` yang sudah tercatat di `COMPLETE_TASK.md` dihapus dari daftar ini (ID-nya tetap tidak didaur ulang); `Promoted to T-XXX` tidak berubah, tetap tercatat sampai task tujuannya selesai.
- **Lokasi tetap di `PROJECT_STATE.md`** — tidak dipindah ke file baru. `AGENTS.md` sudah memetakan "issue" ke `PROJECT_STATE.md` sebagai Source of Truth; ADR ini hanya mengubah format penulisan di dalam section yang sama, bukan lokasinya.
- Seluruh entry Known Issues yang sudah ada dinumerisasi ulang jadi `KI-001` sampai `KI-013` mengikuti struktur baru ini, termasuk memecah temuan review PR #42 (T-012) yang sebelumnya digabung jadi satu paragraf menjadi entry terpisah per temuan (masing-masing dapat ID sendiri).

### Reason

- Bullet paragraf tanpa ID tidak bisa direferensikan secara ringkas ("issue yang mana?") — berbeda dengan task yang sudah punya `T-XXX`/`T-XXX.Y`. King Rezi butuh cara yang sama profesionalnya untuk merujuk ke Known Issues saat diskusi maupun saat issue itu nanti di-promote jadi task.
- Prefix `KI-` (bukan reuse `T-XXX`) sengaja dipisah karena Known Issues **belum tentu jadi task** — sebagian murni catatan tech-debt/observasi yang mungkin tidak pernah dikerjakan sebagai task formal. Menyatukan namespace akan mengaburkan mana yang "backlog resmi" vs "catatan lepas".
- Field table ringkas (bukan field lengkap seperti task — tanpa `Depends`/`Baca dulu`) dipilih karena Known Issues tidak butuh detail perencanaan sedalam task; cukup kategori + status + keterkaitan supaya cepat dipindai.
- Memecah temuan gabungan PR #42 jadi entry per-item konsisten dengan keputusan sebelumnya (T-012.9 tetap in-scope T-012, 5 temuan lain out-of-scope) — supaya setiap temuan punya identitas sendiri yang bisa di-track independen, bukan terkubur dalam satu paragraf besar.

### Alternatives Considered

- **Prefix `ISS-XXX`.** Ditolak — King Rezi memilih `KI-XXX` karena lebih spesifik ("Known Issue"), `ISS-` berisiko disalahartikan sebagai integrasi GitHub Issues eksternal yang tidak dipakai project ini.
- **Reuse namespace `T-XXX` untuk Known Issues** (anggap semua issue adalah calon task). Ditolak — akan mencampur backlog resmi dengan catatan lepas yang belum tentu dikerjakan, menyulitkan hitungan progress task di `TASKS.md`.
- **Pindahkan Known Issues ke file terpisah** (mis. `ISSUES.md` + indeks, mirroring pola `TASKS.md`/`tickets/`). Ditolak untuk saat ini — `AGENTS.md` memetakan "issue" ke `PROJECT_STATE.md`, dan volume Known Issues saat ini (13 entry) belum sebesar backlog task yang memang butuh pemisahan indeks + detail. Dipertimbangkan ulang kalau daftar ini bertambah signifikan.
- **Tanpa ADR, anggap murni perbaikan format.** Ditolak oleh King Rezi — dipilih dicatat sebagai ADR kecil supaya konvensi ID Known Issues konsisten ke depan, mengikuti precedent ADR-062 untuk konvensi ID task.
