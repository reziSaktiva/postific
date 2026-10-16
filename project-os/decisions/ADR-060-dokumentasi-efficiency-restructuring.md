## Decision ADR-060

### Title

Dokumentasi Efficiency Restructuring — DECISIONS.md per-file + CHANGELOG rotation + skill cascade

### Status

Accepted — Amended by ADR-061 (2026-08-03)

### Date

2026-08-03

### Decision

Restrukturisasi dokumentasi `project-os/` supaya AI (dan manusia) tidak lagi wajib membaca ribuan baris historis penuh hanya untuk pertanyaan sederhana:

- `DECISIONS.md` (3.564 baris, 59 ADR full-text inline) dipecah jadi satu file per ADR di `project-os/decisions/ADR-XXX-slug.md`; `DECISIONS.md` sendiri jadi indeks ringkas (tabel ADR#/Title/Status/Date/Ringkasan/link file, terbaru-di-atas).
- `PROJECT_STATE.md` (928 baris) diberi **Snapshot** block (~15-20 baris) di paling atas, heading-nya dirapikan jadi `##` konsisten, dan section "Completed"/"Recent Decisions" dipangkas jadi ringkasan 5 item terakhir + pointer ke `CHANGELOG.md`/`DECISIONS.md` (isi lengkap tidak hilang, hanya tidak lagi inline).
- `CHANGELOG.md` (3.135 baris, sejak 2026-07-13) dirotasi: entri pra-M8 (M0–M7) dipindah ke `project-os/changelog/CHANGELOG-pre-M8.md`; root `CHANGELOG.md` tinggal berisi entri M8 (Development) dan seterusnya.
- `.agents/skills/project-os-navigator/SKILL.md` — "Langkah Pertama: Load Context" diubah dari wajib-baca-4-file-penuh-sebelum-merespons-apapun menjadi **cascade 3 tingkat**: (1) `context/ctx-*.md` untuk fakta cepat, (2) Snapshot `PROJECT_STATE.md` + ADR spesifik untuk status/pertanyaan umum, (3) baca penuh seperti semula hanya untuk task nyata (Pekerjaan Baru/Planning Change/Bug).
- `PROJECT_RULES.md` — Document Type Classification diperbarui untuk `decisions/ADR-*.md` dan `changelog/CHANGELOG-*.md` (Append-Only), plus **Guardrail Ukuran Dokumen** baru: section ringkasan di `PROJECT_STATE.md` dijaga ≤10 item, `CHANGELOG.md` root dijaga maksimal milestone aktif + 1 sebelumnya, dicek sebagai bagian Definition of Done tiap milestone selesai.

### Reason

- `DECISIONS.md` (149 KB) wajib dibaca **penuh** oleh skill navigator sebelum merespons apapun — kontributor pemborosan token terbesar, 2× lebih besar dari `PROJECT_STATE.md`, dan akan terus tumbuh seiring ADR bertambah.
- Section "Completed" (497 baris, 76% dari `PROJECT_STATE.md`) dan "Recent Decisions" (209 baris) terbukti duplikat dengan `CHANGELOG.md`/`DECISIONS.md` — melanggar aturan `PROJECT_RULES.md` sendiri ("Hindari dokumentasi yang duplikat").
- Tanpa guardrail eksplisit, pembersihan satu kali ini akan bengkak lagi dalam beberapa bulan seperti kondisi sebelum ADR ini.
- Cascade 3 tingkat (bukan triase biner) memastikan sebagian besar pertanyaan status/lookup berhenti di tingkat 1-2 tanpa pernah menyentuh `DECISIONS.md`/`PROJECT_STATE.md` penuh, sementara task nyata tetap mendapat context selengkap sebelumnya (tidak ada pengurangan kualitas kerja).

### Alternatives Considered

- Index ringkas di atas satu file `DECISIONS.md` (tanpa split ke file terpisah) — ditolak karena enforcement "baca index saja" bergantung pada disiplin instruksi skill, bukan struktur folder yang memaksa; juga kurang skalabel untuk ADR-ADR berikutnya.
- Menunda rotasi `CHANGELOG.md` (karena belum termasuk yang wajib dibaca skill) — ditolak; King Rezi memilih sekalian membereskannya sekarang sebelum makin besar.
- Memindah "Completed" `PROJECT_STATE.md` ke file history baru tanpa memangkas isinya — ditolak karena hanya memindah duplikasi, bukan menghilangkannya; trim + pointer ke `CHANGELOG.md` yang sudah punya detail lebih efisien.
