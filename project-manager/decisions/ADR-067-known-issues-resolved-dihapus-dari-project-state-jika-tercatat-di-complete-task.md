## Decision ADR-067

### Title

Known Issues `Resolved` Dihapus dari `PROJECT_STATE.md` Jika Sudah Tercatat di `COMPLETE_TASK.md` (Amandemen ADR-066)

### Status

Accepted — Amended by ADR-131 (2026-10-16)

### Date

2026-08-05

### Decision

Mengamandemen ADR-066 poin "ID tidak pernah didaur ulang. Issue yang selesai tetap tercatat dengan status `Resolved`... bukan dihapus dari daftar":

* Entry `Known Issues` dengan `Status: Resolved` **dihapus** dari section `Known Issues` di `PROJECT_STATE.md`, **dengan syarat** riwayat penyelesaiannya sudah tercatat sebagai entry di `COMPLETE_TASK.md`.
* **ID tetap tidak didaur ulang** — bagian ADR-066 ini tidak berubah. `KI-007` dan `KI-011` yang dihapus dari `PROJECT_STATE.md` tidak akan pernah dipakai ulang untuk entry baru; riwayat lengkapnya tetap bisa ditelusuri di `COMPLETE_TASK.md`.
* Entry `Promoted to T-XXX` **tidak** kena aturan ini — tetap tercatat di `Known Issues` sampai task tujuannya sendiri selesai, karena isinya bukan riwayat penyelesaian melainkan pointer ke task aktif.
* Berlaku surut: `KI-007` (bug drag-reorder T-012.9) dan `KI-011` (helper `cn` global) — keduanya `Resolved` dan sudah tercatat di `COMPLETE_TASK.md` (2026-08-05) — dihapus dari `PROJECT_STATE.md` dalam perubahan yang sama dengan ADR ini.

### Reason

* King Rezi menilai `PROJECT_STATE.md` (khususnya `Known Issues`) sebaiknya hanya berisi hal yang masih relevan untuk dipindai cepat — entry `Resolved` yang detailnya sudah terekam permanen di `COMPLETE_TASK.md` jadi noise, bukan sinyal.
* `COMPLETE_TASK.md` sudah menjadi riwayat lengkap sejak M0 (disebut eksplisit di `PROJECT_STATE.md` sebagai tempat riwayat completed) — menyimpan entry `Resolved` di dua tempat sekaligus (`PROJECT_STATE.md` + `COMPLETE_TASK.md`) adalah duplikasi tanpa manfaat tambahan.
* Menjaga **ID tidak didaur ulang** (bagian ADR-066 yang dipertahankan) tetap memberi jaminan bahwa referensi lama ke `KI-007`/`KI-011` di percakapan atau dokumen lain tidak akan tiba-tiba merujuk ke issue lain yang berbeda — hanya representasinya di `PROJECT_STATE.md` yang hilang, bukan identitasnya.
* Entry `Promoted to T-XXX` dikecualikan karena statusnya bukan "selesai dan terarsip", melainkan "sudah pindah rumah ke backlog task resmi" — pembaca `Known Issues` masih perlu tahu bahwa issue itu ada dan sedang dikerjakan sebagai task, sampai task itu sendiri selesai (di titik mana ia mengikuti alur completed task biasa, bukan Known Issues).

### Alternatives Considered

* **Pertahankan ADR-066 apa adanya (Resolved tetap tercatat selamanya).** Ditolak — ini persis yang dianggap King Rezi tidak rapi setelah melihat KI-007 dan KI-011 menumpuk sebagai entry Resolved yang sudah terekam di tempat lain.
* **Hapus semua entry Resolved tanpa syarat, tidak peduli tercatat di `COMPLETE_TASK.md` atau tidak.** Ditolak — berisiko kehilangan riwayat kalau ada entry Resolved yang belum sempat masuk `COMPLETE_TASK.md`. Syarat "sudah tercatat di `COMPLETE_TASK.md`" memastikan riwayat tetap ada di suatu tempat sebelum dihapus dari `PROJECT_STATE.md`.
* **Pindahkan entry Resolved ke arsip terpisah (mis. `KNOWN_ISSUES_ARCHIVE.md`).** Ditolak — `COMPLETE_TASK.md` sudah berfungsi sebagai arsip riwayat; membuat file arsip baru khusus Known Issues akan menduplikasi peran yang sudah ada.

