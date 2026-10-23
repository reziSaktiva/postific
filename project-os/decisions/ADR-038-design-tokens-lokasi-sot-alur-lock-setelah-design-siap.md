## Decision ADR-038

### Title

Design Tokens — lokasi SoT & alur lock setelah design siap

### Status

Accepted — Amended by ADR-041 (2026-07-23), ADR-045 (2026-07-28), ADR-056 (2026-07-31), ADR-057 (2026-07-31)

### Date

2026-07-21

### Decision

1. **Source of Truth visual tokens** untuk implementasi UI adalah  
   `product-discovery/06-engineering/design-tokens.md`  
   (font, brand/secondary, neutral, content status, feedback, spacing/radius, tema).
2. Dokumen tersebut merupakan **addendum Engineering Baseline** (melengkapi ADR-036): template disiapkan sekarang; **nilai token diisi setelah design di-approve Project Manager**.
3. Folder `design/` tetap ruang operasional handoff designer — **bukan** SoT token. UX Baseline (`product-discovery/04-ux/`) tetap SoT alur & struktur layar — **bukan** tempat hex/font.
4. Setelah nilai di-lock: status dokumen → Locked; mirror ke CSS variables / Tailwind theme di `apps/web`; catat di CHANGELOG (+ ADR amandemen nilai bila dampak brand/tema luas).

### Reason

- PM membutuhkan satu tempat jelas untuk mengisi styling setelah design beres, tanpa mengandalkan screenshot atau brief `design/` sebagai acuan engineering.
- Menempatkan tokens di Engineering mendekatkan SoT ke implementasi (Tailwind / shadcn) dan menjaga `04-ux/` fokus pada pola fungsi.
- Addendum lebih aman daripada mengarang SoT di folder yang secara preferensi kerja tidak masuk tracking development (`design/`).

### Alternatives Considered

- SoT di `product-discovery/04-ux/visual-style.md` — ditolak; UX Baseline sengaja tidak mengunci visual.
- SoT hanya di `design/DESIGN_OVERVIEW.md` — ditolak; `design/` bukan acuan Project OS untuk engineering.
- Token hanya di kode tanpa dokumen — ditolak; PM sulit mereview/lock sebelum implementasi.

---
