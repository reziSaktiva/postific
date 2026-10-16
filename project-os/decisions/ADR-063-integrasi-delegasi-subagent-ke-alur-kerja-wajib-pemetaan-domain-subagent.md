## Decision ADR-063

### Title

Integrasi Delegasi Subagent ke Alur Kerja Wajib + Pemetaan Domain → Subagent

### Status

Accepted

### Date

2026-08-04

### Decision

King Rezi melaporkan AI utama (Jokowi) jarang mendelegasikan pekerjaan ke 7 subagent kerja (`.claude/agents/`) semenjak restrukturisasi dokumentasi ADR-060–062, padahal harapannya subagent bisa mengerjakan beberapa task secara paralel.

Diagnosis menemukan akar masalahnya **bukan** konten yang hilang saat restrukturisasi — panduan orkestrasi subagent (`.claude/agents/README.md`) sejak awal dibuat (30 Juli 2026) memang tidak pernah terhubung ke alur kerja operasional AI. Subagent hanya disebut di satu section deskriptif berdiri sendiri di `AGENTS.md` ("## Subagent kerja"), dan `.agents/skills/project-os-navigator/SKILL.md` (behavior utama AI saat mengerjakan task) tidak pernah menyebut subagent sama sekali, baik versi sebelum maupun sesudah ADR-060–062. Field task di `tickets/vXX-*.md` (Status, Domain, ADR, Depends, Blocker, Baca dulu) juga tidak memetakan `Domain` ke subagent mana pun.

Efek ADR-060–062: cascade baca dokumen untuk task nyata ("Tingkat 3") bertambah panjang (Snapshot → `TASKS.md` → `tickets/vXX-*.md` → "Baca dulu" → `PROJECT_RULES.md` → `DECISIONS.md` → `PROJECT_OVERVIEW.md`), seluruhnya berfokus pada membaca dokumen sendiri, tanpa satu pun titik yang mengarahkan AI mempertimbangkan dekomposisi kerja ke subagent. Ditemukan juga bug turunan: `.claude/agents/README.md` masih merujuk `project-os/CHANGELOG.md` yang sudah dihapus/digabung ke `COMPLETE_TASK.md` sejak ADR-061 — tanda dokumentasi subagent tidak ikut disinkronkan saat restrukturisasi.

Perbaikan yang diterapkan:

1. **Perbaikan referensi rusak** — `.claude/agents/README.md` (5 lokasi) diperbarui: referensi ke `CHANGELOG.md` (dihapus sejak ADR-061) diganti `COMPLETE_TASK.md`, dan deskripsi peran/aturan Gibran Project Manager ditambah `TASKS.md`/`tickets/` yang belum tercatat sejak ADR-062. Penyisiran lebih lanjut menemukan 2 referensi mati serupa di luar `.claude/agents/README.md`: `context/ctx-project.md` (tabel klasifikasi dokumen, `CHANGELOG.md` diganti `TASKS.md`/`tickets/`, sekaligus memperbaiki `CONVERSATIONS.md` yang salah diklasifikasi Living padahal Append-Only) dan `.claude/agents/prabowo-feature-engineer.md` (role file chmod 444, dibuka dengan konfirmasi eksplisit King Rezi sesuai prosedur, lalu di-chmod 444 kembali).
2. **Pemetaan Domain → Subagent** ditambahkan di `.claude/agents/README.md` — tabel yang memetakan field `Domain` task (`identity`, `workspace`, `publishing`, `analytics` → Prabowo Feature Engineer; `integration`/`media`/`notification` → Elon Backend Engineer; `UI` → Mark UI Engineer; `platform`/`DX` → biasanya tanpa subagent) sebagai titik awal keputusan delegasi, plus section baru "Kapan WAJIB dievaluasi" yang menegaskan ini bukan referensi pasif.
3. **Titik wajib evaluasi ditanam di tiga tempat operasional:**
   - `AGENTS.md` → "Wajib di awal sesi" mendapat langkah baru (poin 3): cek Domain task terhadap pemetaan, tentukan kerjakan sendiri / satu subagent / beberapa subagent paralel.
   - `.agents/skills/project-os-navigator/SKILL.md` → behavior "Pekerjaan Baru" mendapat sub-langkah 1a dengan aturan yang sama; cascade "Tingkat 3" ditambah pointer ke `.claude/agents/README.md` sebelum eksekusi.
   - `TASKS.md` → "Cara pakai" mendapat langkah baru yang sama, supaya titik masuk manapun (AGENTS.md, SKILL.md, atau langsung TASKS.md) konsisten mengarahkan ke evaluasi delegasi.
4. Tidak ada field "Subagent" baru per task di `tickets/vXX-*.md` — pemetaan Domain → Subagent sengaja diletakkan satu kali di `.claude/agents/README.md` (single source of truth), bukan diduplikasi ke 69 task/134 subtask, konsisten dengan prinsip "satu-satunya daftar" yang sudah ditegakkan ADR-062.

### Reason

- Menambahkan konten deskriptif saja (seperti yang sudah ada sejak `.claude/agents/README.md` dibuat) terbukti tidak cukup — dokumen itu sudah ada >5 hari sebelum laporan ini dan tidak pernah dikonsultasikan secara rutin karena tidak ada trigger prosedural yang memaksa AI membukanya.
- Titik evaluasi ditanam di **tiga** tempat (bukan satu) karena AI bisa masuk ke alur kerja dari jalur berbeda — langsung diminta kerjakan task (masuk lewat `AGENTS.md`), lewat pertanyaan status (masuk lewat cascade `SKILL.md`), atau langsung membuka `TASKS.md`. Kalau hanya satu titik yang diperbaiki, dua jalur lain tetap bisa melewatkan evaluasi delegasi.
- Pemetaan Domain → Subagent memakai field yang **sudah ada** (`Domain`, ditetapkan ADR-062) alih-alih field baru, supaya tidak perlu mengubah 69 task yang sudah ditulis dan tidak menambah beban maintenance ganda.
- Menaruh tabel pemetaan di `.claude/agents/README.md` (bukan duplikasi ke `TASKS.md`) menjaga prinsip satu sumber kebenaran — persis pola yang sudah dipakai ADR-060 (`DECISIONS.md` indeks + file) dan ADR-062 (`TASKS.md` sebagai satu-satunya daftar fokus).
- Perbaikan referensi `CHANGELOG.md` → `COMPLETE_TASK.md` disertakan karena ditemukan sebagai bukti konkret dokumentasi subagent luput dari checklist sinkronisasi ADR-060–062 — kalau tidak diperbaiki sekarang, referensi mati ini akan terus menyesatkan siapa pun (AI atau manusia) yang membuka file itu.

### Alternatives Considered

- **Tambah field "Subagent" per task di `tickets/vXX-*.md`.** Ditolak — berarti mengedit ulang 69 task/134 subtask yang sudah ditulis, risiko drift tinggi (field bisa basi begitu subagent baru ditambah/dihapus), dan melanggar prinsip "satu-satunya daftar" yang baru ditegakkan ADR-062. Pemetaan berbasis `Domain` (field yang sudah ada) mencapai hasil yang sama tanpa menyentuh file task.
- **Hanya perbaiki bug referensi `CHANGELOG.md`, tanpa integrasi struktural.** Ditolak secara eksplisit oleh King Rezi — tidak menyelesaikan akar masalah (AI tetap tidak punya trigger untuk mengevaluasi delegasi).
- **Buat skill baru khusus "subagent-delegation".** Ditolak — menambah satu file skill lagi untuk konsep yang sebenarnya sudah punya rumah (`.claude/agents/README.md`); cukup memperkuat pointer ke sana dari titik-titik operasional yang sudah ada.
- **Wajibkan subagent untuk semua task tanpa pengecualian.** Ditolak — beberapa Domain (`platform`, `DX`) berupa tooling/config kecil yang lebih efisien dikerjakan langsung; dipetakan sebagai "biasanya tanpa subagent" alih-alih larangan mutlak.
