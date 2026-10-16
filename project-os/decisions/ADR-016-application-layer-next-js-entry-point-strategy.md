## Decision ADR-016

### Title

Application Layer — Next.js Entry Point Strategy

### Status

Accepted

### Date

2026-07-15

### Decision

Next.js entry points dibagi berdasarkan asal request:

- **Server Actions** untuk semua mutations yang dipicu dari UI (form, button).
- **Route Handlers** untuk request dari sistem eksternal (webhook Outstand) dan endpoint API.
- **Server Components** untuk semua data fetching pada render halaman.
- **Middleware** untuk auth guard dan workspace context resolution.

### Reason

- Separation of concern yang jelas — Server Actions optimal untuk form-based UI mutations, Route Handlers optimal untuk integrasi eksternal.
- Server Actions mendukung progressive enhancement dan error handling terstruktur ke client.
- Route Handlers adalah satu-satunya cara menerima webhook dari Outstand.

### Alternatives Considered

- Route Handlers saja — kehilangan keuntungan Server Actions untuk UI mutations.
- Server Actions saja — tidak bisa handle webhook dari sistem eksternal.

---
