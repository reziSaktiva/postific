## Decision ADR-117

### Title

`replyToComment` wajib `accountUsername` (selalu dikirim sebagai
`account_username`) — amandemen ADR-113, menutup KI-071

### Status

Accepted — Amends ADR-113

### Date

2026-09-25

### Decision

KI-071 menemukan bahwa endpoint resmi Outstand
`POST /v1/posts/{id}/replies` menerima `account_username` (dan
`platform_post_id`) **opsional** untuk disambiguasi kalau satu post
publish ke lebih dari satu akun di network yang sama, tapi signature
`replyToComment` yang dikunci ADR-113 tidak membawa field itu — reply ke
post multi-akun network sama berisiko gagal 400 di sisi Outstand.

ADR ini menutup gap itu dengan amandemen kontrak `replyToComment` saja
(pola sama `fetchComments` di ADR-113 yang sudah wajib
`accountUsername`):

#### 1. `accountUsername: string` wajib di `replyToComment`

`IOutstandAdapter.replyToComment` sekarang **wajib** menerima
`accountUsername: string`. `RealOutstandAdapter` **selalu** mengirim body
field `account_username` ke Outstand (bukan opsional di sisi kita).
`FakeOutstandAdapter` menerima field itu dan tetap instant success
(ADR-059).

#### 2. `platform_post_id` SENGAJA tidak masuk kontrak

Disambiguasi multi-akun network sama sudah ditutup oleh username — pola
sama `fetchComments` (ADR-113). `platform_post_id` **tidak** ditambahkan ke
kontrak `replyToComment`.

#### 3. Resolve handle di domain lewat port lokal

`EngagementService.reply` resolve handle lewat port lokal
`ConnectedAccountHandlePort.findConnectedAccountById` — composition root
menyuplai `workspaceRepository` (`WorkspaceConnectedAccount.handle`).
Handle kosong atau akun tidak ketemu → `ConflictError` (bukan silent
fallback / string kosong ke Outstand).

### Consequences

- Menutup **KI-071**.
- Mengamandemen kontrak `replyToComment` di ADR-113 (field baru wajib;
  keputusan scope per-post + `outstandPostId` / threading ADR-113 tetap
  berlaku).
- Tidak ada perubahan UI; T-025 / T-054 tetap `✅ Done` (hardening
  kontrak, bukan reopen task).
- Diimplementasikan Elon Backend Engineer; Ridwan Architecture Reviewer:
  0 temuan; Najwa QA Engineer: Vitest 6 file / 80 tes PASS; typecheck
  PASS.

### Related

- KI-071 (Resolved)
- ADR-113 (amended)
- ADR-059, ADR-110
- T-025 (T-025.6), T-054
- Branch: `feature/ki-071-reply-disambiguation`
