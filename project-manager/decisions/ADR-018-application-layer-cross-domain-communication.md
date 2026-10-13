## Decision ADR-018

### Title

Application Layer — Cross-Domain Communication

### Status

Accepted — Amended by ADR-078 (2026-08-12)

### Date

2026-07-15

### Decision

Komunikasi antar domain menggunakan **service-to-service call langsung** dengan aturan:
- Hanya import dari `index.ts` (public API) domain lain — tidak boleh import dari file internal.
- Tidak ada circular dependency antar domain.
- Hanya passing ID (WorkspaceId, UserId, dll.), bukan full entity lintas domain.

### Reason

* Sederhana dan pragmatis untuk MVP yang dikerjakan solo developer.
* Dependency antar domain bersifat eksplisit dan dapat ditelusuri di compile time.
* Tidak memerlukan event bus atau message broker yang menambah kompleksitas infra.

### Alternatives Considered

* Domain Events (publish-subscribe) — lebih decoupled, tapi kompleksitas tinggi untuk MVP.
* Shared Read Model — query langsung ke DB lintas context — melanggar domain boundary.

---
