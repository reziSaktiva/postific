## Decision ADR-019

### Title

Integration Layer — Anti-Corruption Layer via OutstandAdapter

### Status

Accepted — Amended by ADR-040 (2026-07-23)

### Date

2026-07-15

### Decision

Seluruh interaksi dengan Outstand API dilakukan eksklusif melalui modul `OutstandAdapter` sebagai **Anti-Corruption Layer (ACL)**:

- Domain internal tidak pernah mengimport tipe atau struktur data Outstand secara langsung.
- `OutstandAdapter` bertanggung jawab atas HTTP call, parsing response, dan translasi error ke `IntegrationError`.
- Jika Outstand mengubah API contract, hanya `OutstandAdapter` yang perlu diperbarui.

### Reason

- Isolasi domain internal dari perubahan breaking Outstand API.
- Selaras dengan DDD Anti-Corruption Layer pattern untuk external system.
- Memudahkan penggantian provider integrasi di masa depan tanpa mengubah domain logic.

### Alternatives Considered

- Panggil Outstand API langsung dari Application Service — coupling tinggi, domain terikat pada struktur data Outstand.

---
