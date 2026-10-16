## Decision ADR-020

### Title

Integration Layer — Webhook Handling via Route Handler + HMAC Signature Verification

### Status

Accepted — Amended by ADR-040 (2026-07-23)

### Date

2026-07-15

### Decision

Webhook dari Outstand diterima melalui **Route Handler** di `/api/webhooks/outstand` dengan:

- Verifikasi HMAC-SHA256 signature sebelum setiap pemrosesan event.
- Respons `200 OK` dikembalikan segera sebelum pemrosesan selesai (async processing).
- Idempotency check via `outstandJobId` / `outstandItemId` sebelum memproses event.
- Event yang gagal diproses dicatat untuk retry via background job.

### Reason

- Route Handler adalah satu-satunya entry point yang dapat menerima request dari sistem eksternal (ADR-016).
- Signature verification mencegah pemrosesan event palsu dari sumber tidak sah.
- Respons segera mencegah timeout pada sisi Outstand dan retry berlebihan.
- Idempotency diperlukan karena Outstand dapat mengirim event yang sama lebih dari sekali.

### Alternatives Considered

- Proses webhook secara synchronous — risiko timeout jika pemrosesan lambat.
- Tanpa signature verification — risiko keamanan.

---
