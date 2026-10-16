## Decision ADR-013

### Title

UX Planning Baseline v1.0

### Status

Accepted — Amended by ADR-040 (2026-07-23)

### Date

2026-07-15

### Decision

Seluruh dokumen pada `product-discovery/04-ux/` ditetapkan sebagai **Baseline v1.0** setelah UX Planning Review dinyatakan lolos dan seluruh inkonsistensi (REVIEW-01 s/d REVIEW-04) telah diperbaiki.

Dokumen yang termasuk dalam baseline ini:

- `ux-principles.md` — 6 prinsip UX yang dapat ditelusuri ke insight pengguna
- `information-architecture.md` — struktur navigasi dan hierarki layar
- `user-flows.md` — 5 solution flows untuk pekerjaan inti pengguna
- `navigation-patterns.md` — model navigasi utama dan pola perpindahan layar
- `key-screen-patterns.md` — pola fungsi kritis pada 8 layar utama

Baseline ini menjadi acuan wajib untuk fase berikutnya:

- `product-discovery/05-architecture/`
- `product-discovery/06-engineering/`

### Reason

- Seluruh 4 item UX Planning Review (REVIEW-01 s/d REVIEW-04) telah diperbaiki dan tidak ada inkonsistensi tersisa.
- Set status konten kanonikal telah diselaraskan lintas seluruh dokumen UX (REVIEW-01 Fixed).
- Seluruh keputusan UX (KSP-D01 s/d KSP-D11, NP-D01 s/d NP-D09) telah terdokumentasi di Decision Log masing-masing dokumen.
- Key screen patterns untuk 8 layar utama telah terdefinisi dan siap dijadikan input architecture discovery.
- Tidak ada keputusan UX yang bertentangan dengan Product Baseline v1.0.

### Alternatives Considered

- Melanjutkan ke System Architecture tanpa baseline formal UX (tidak dipilih — melanggar Documentation First dan menghilangkan traceability keputusan UX ke architecture)

---
