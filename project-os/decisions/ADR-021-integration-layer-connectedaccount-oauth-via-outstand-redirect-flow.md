## Decision ADR-021

### Title

Integration Layer — ConnectedAccount OAuth via Outstand Redirect Flow

### Status

Accepted

### Date

2026-07-15

### Decision

Koneksi akun social media ke workspace menggunakan **OAuth flow yang dikelola Outstand**:

- OAuth access token **tidak disimpan** di database internal — dikelola sepenuhnya oleh Outstand.
- Hanya `outstandAccountId` yang disimpan sebagai external reference permanen di `ConnectedAccount`.
- OAuth callback ditangani oleh Route Handler di `/api/integrations/outstand/callback`.
- `state` parameter digunakan untuk CSRF protection.

### Reason

- Menghindari tanggung jawab menyimpan dan me-refresh OAuth token platform social media.
- Outstand mengelola token rotation dan scope permission — mengurangi kompleksitas sistem internal.
- Selaras dengan posisi Outstand sebagai integration provider yang menabstraksi platform-specific OAuth.

### Alternatives Considered

- Simpan OAuth token di database internal — harus mengelola token refresh, revocation, dan enkripsi.
- OAuth langsung ke platform social media (tanpa Outstand) — melanggar ADR-005 dan meningkatkan kompleksitas drastis.

---
