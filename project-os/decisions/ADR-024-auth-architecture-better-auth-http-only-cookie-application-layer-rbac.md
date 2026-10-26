## Decision ADR-024

### Title

Auth Architecture — Better Auth + HTTP-only Cookie + Application-layer RBAC

### Status

Accepted

### Date

2026-07-15

### Decision

Sistem menggunakan **Better Auth** untuk lifecycle autentikasi (registrasi, login, session). Session disimpan di **HTTP-only cookie**. Workspace context di-resolve oleh **Next.js Middleware** dari URL slug dan diinject via custom request headers. Authorization menggunakan **RBAC di Application Service layer** dengan RLS sebagai defense-in-depth.

Komponen utama:

- Auth method MVP: Email + Password + Google OAuth.
- Session cookie: HTTP-only, Secure, SameSite=lax, expiry 7 hari.
- Workspace context headers: `x-workspace-id`, `x-workspace-role` diinject Middleware.
- Authorization check: `assertPermission(role, operation)` di Application Service sebelum domain logic.
- RLS: safety net jika Application Service melewatkan pengecekan.

### Reason

- Better Auth menghindari implementasi auth dari nol — sudah ditetapkan sebagai keputusan pra-architecture.
- HTTP-only cookie mencegah XSS attack; tidak dapat diakses JavaScript di browser.
- Workspace context via Middleware lebih akurat dari menyimpan di session (URL adalah sumber kebenaran workspace aktif).
- Custom request headers tidak dapat dimanipulasi client — hanya Middleware server-side yang menulisnya.
- Authorization di Application Service selaras dengan DDD — business rule ada di domain layer, bukan di Entry Point.

### Alternatives Considered

- JWT stateless (tanpa session di database) — lebih scalable, tapi revocation lebih kompleks; HTTP-only session cookie cukup untuk MVP.
- Menyimpan workspaceId di session token — bisa stale jika user berpindah workspace; URL-based lebih reliable.
- Authorization di Middleware — terlalu awal untuk business logic; Application Service lebih tepat sebagai enforcement layer.
- Clerk / Auth0 (third-party auth service) — managed, tapi biaya dan lock-in; Better Auth self-hosted lebih sesuai.

---
