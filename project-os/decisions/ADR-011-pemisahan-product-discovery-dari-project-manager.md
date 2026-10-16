## Decision ADR-011

### Title

Pemisahan `product-discovery/` dari `project-manager/`

### Status

Accepted — Amended by ADR-132 (2026-10-16)

### Date

2026-07-14

### Decision

Folder `product-discovery/` dipindahkan keluar dari `project-manager/` dan menjadi folder top-level, sejajar (sibling) dengan `project-manager/`.

Struktur repository sekarang:

```text
social-media-management/
├── project-manager/     → proses kerja, keputusan, status project
└── product-discovery/   → pengetahuan produk (business s/d engineering)
```

Pembagian tanggung jawab masing-masing folder:

- **`project-manager/`** — didedikasikan untuk mendokumentasikan cara kerja: aturan project (`PROJECT_RULES.md`), status dan progress (`PROJECT_STATE.md`), keputusan (`DECISIONS.md`), riwayat perubahan (`CHANGELOG.md`), log diskusi (`CONVERSATIONS.md`), dan bank ide (`BRAINSTORM.md`).
- **`product-discovery/`** — menjadi **Source of Truth produk**: seluruh pengetahuan tentang apa yang dibangun (business, product, user, UX, architecture, engineering).

Seluruh referensi path antar dokumen yang sebelumnya berasumsi `product-discovery/` berada di dalam `project-manager/` telah diperbarui menyesuaikan struktur baru ini.

### Reason

- `product-discovery/` bukan bagian dari proses kerja AI/Developer, melainkan pengetahuan produk itu sendiri — secara konseptual berbeda tingkat dari `project-manager/`.
- Memisahkan keduanya membuat batas tanggung jawab lebih jelas: `project-manager/` = "bagaimana kita bekerja", `product-discovery/` = "apa yang kita bangun".
- Mencegah kebingungan ketika project-manager berkembang menjadi tooling AI/proses yang lebih kompleks di kemudian hari, tanpa harus menyeret dokumentasi produk ikut berpindah.

### Alternatives Considered

- Mempertahankan `product-discovery/` di dalam `project-manager/` (tidak dipilih — mencampur dua tanggung jawab berbeda: proses kerja vs pengetahuan produk)

---
