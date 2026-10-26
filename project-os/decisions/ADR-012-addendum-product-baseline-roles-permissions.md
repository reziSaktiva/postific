## Decision ADR-012

### Title

Addendum Product Baseline — Roles & Permissions

### Status

Accepted — Amended by ADR-074 (2026-08-07, role Manager dihapus, struktur jadi 3 role Owner/Admin/Creator)

### Date

2026-07-15

### Decision

Menambahkan dokumen `product-discovery/02-product/roles-permissions.md` sebagai **addendum dari Product Baseline v1.0** (ADR-008).

Dokumen ini mendefinisikan:

- 4 roles: **Owner**, **Admin**, **Manager**, **Creator** — beserta hak akses per area fitur.
- **Set status konten kanonikal**: `Draft`, `In Review`, `Ready to Schedule`, `Scheduled`, `Published`, `Failed`.
- Aturan transisi status konten per role.
- Mapping roles ke persona User Discovery Baseline (Raka, Maya, Sinta, Dimas, Lara).

### Reason

- Roles & Permissions adalah bagian dari modul Workspace (`feature-modules.md`) yang belum terdefinisi secara eksplisit di Product Baseline v1.0.
- Set status konten kanonikal dibutuhkan sebelum UX Planning Review dapat diselesaikan — terutama untuk memperbaiki inkonsistensi REVIEW-01 (status lintas dokumen UX).
- Tanpa definisi roles yang jelas, aturan transisi status konten tidak dapat ditentukan secara konsisten.
- Mendefinisikan roles di fase Product (bukan Architecture) memastikan keputusan ini tersedia sebagai input UX dan Architecture.

### Alternatives Considered

- Mendefinisikan roles langsung di fase Architecture (tidak dipilih — roles adalah keputusan produk, bukan keputusan teknis semata)
- Mendefinisikan roles sebagai bagian inline dari dokumen UX (tidak dipilih — roles perlu menjadi dokumen tersendiri agar dapat dirujuk lintas fase)

---
