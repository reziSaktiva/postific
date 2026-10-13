## Decision ADR-110

### Title

Fake `fetchComments`/`replyToComment` — Engagement Sync + Reply mengikuti pola ADR-059

### Status

Accepted — Amended by ADR-113 (2026-09-24)

### Date

2026-09-22

### Decision

T-051 (Comment sync job JOB-03) dan T-054 (Reply comment dari dalam
aplikasi) menambah 2 kapabilitas baru ke `IOutstandAdapter` untuk domain
`engagement` yang butuh kredensial Outstand asli (`OUTSTAND_API_KEY`) yang
belum tersedia. Keduanya diimplementasikan lewat `FakeOutstandAdapter`
mengikuti pola ADR-059 (rule 19 AGENTS.md) tanpa menunggu T-025 (Real
OutstandAdapter) selesai — ditemukan retroaktif oleh Ridwan Architecture
Reviewer saat meninjau T-050/T-051/T-052 (gap governance, bukan gap
teknis: implementasinya sudah benar sejak awal, hanya belum tercatat ADR
sendiri seperti preseden ADR-079/093/105/106/108).

1. **`fetchComments(outstandAccountId, cursor?) → FetchCommentsResult`**
   (T-051) — Fake mengembalikan SATU halaman tetap (1-5 komentar,
   deterministik dari `outstandAccountId` via `deterministicInt`),
   `nextCursor` selalu `null` (tidak ada simulasi pagination bertingkat).
   `cursor` diterima apa adanya tapi diabaikan. Karena `outstandCommentId`
   per komentar stabil (`buildFakeComment`), sync berulang untuk akun yang
   sama SELALU mengembalikan set komentar identik — upsert idempoten di
   `EngagementService`/`SyncCommentsUseCase` melihatnya sebagai "tidak ada
   yang baru" pada sync kedua dan seterusnya, simulasi realistis untuk MVP
   tanpa state buatan yang bertambah tanpa henti.

2. **`replyToComment(outstandCommentId, text) → ReplyToCommentResult`**
   (T-054) — instant always-success (konsisten `schedulePost`/
   `publishNow`), `outstandReplyId` ACAK per panggilan (`fake-reply-<uuid>`)
   — beda dari `fetchComments` yang deterministik, karena tiap reply adalah
   resource baru yang tidak perlu direproduksi identik untuk input yang
   sama (tidak ada concern idempotency di sisi ini — `EngagementReply`
   selalu row baru, bukan upsert).

3. **Tidak ada simulasi delay/failure** untuk keduanya (konsisten
   ADR-059) — fidelity instan, MVP tidak butuh menguji retry/error handling
   Outstand API sungguhan lewat Fake.

4. **Scope ADR ini murni dokumentasi retroaktif** atas keputusan yang
   sudah diimplementasikan (kontrak `packages/shared/src/contracts/outstand-adapter.ts`,
   Fake di `apps/web/src/lib/adapters/outstand/fake-outstand-adapter.ts`) —
   tidak ada perubahan kode yang menyertai ADR ini.

### Reason

* Rule 19 AGENTS.md: setiap task yang terhambat kredensial Outstand
  dibangun lewat Fake/mock adapter mengikuti ADR-059, dan setiap
  pemakaian pola ini di domain/task baru tetap keputusan arsitektur yang
  wajib dicatat ADR — bukan diam-diam diperluas tanpa dicatat.
* Precedent konsisten: ADR-079, ADR-093, ADR-105, ADR-106, ADR-108 semua
  mencatat ADR terpisah setiap kali `IOutstandAdapter` mendapat kapabilitas
  baru lewat pola Fake ini.
* `fetchComments` deterministik vs `replyToComment` acak sengaja dibedakan
  (poin 1 vs 2 di atas) karena keduanya punya kebutuhan idempotency yang
  berbeda — dicatat eksplisit di sini supaya tidak dianggap inkonsistensi
  kalau ditinjau ulang nanti.

### Alternatives Considered

* **Tidak membuat ADR terpisah, cukup disebut sebagai bagian ADR-059.**
  Ditolak — ADR-059 hanya mencatat POLA umum (auto-switch env, throw loud,
  instant fidelity), bukan keputusan konkret per kapabilitas. Preseden
  ADR-079/093/105/106/108 semua memilih ADR terpisah per kapabilitas baru
  supaya jejak keputusan (kenapa deterministik/acak, kenapa tanpa
  pagination) tetap tertelusuri per method, bukan tercampur di satu ADR
  generik yang terus membengkak.
* **`replyToComment` dibuat deterministik juga** (mis. hash dari
  `outstandCommentId + text`). Ditolak — `outstandReplyId` merepresentasikan
  resource baru per panggilan (tiap reply sungguhan di Outstand asli juga
  akan dapat ID baru meski isi teksnya sama), deterministik justru salah
  merepresentasikan semantik domain.

### References

* `product-discovery/05-architecture/integration-layer.md` § "Engagement
  Data Sync", § "Reply via Outstand API".
* ADR-059 — pola Fake adapter (auto-switch, throw loud, instant fidelity).
* ADR-079 — promosi `IOutstandAdapter` ke `packages/shared`.
* `packages/shared/src/contracts/outstand-adapter.ts` — kontrak
  `FetchCommentsResult`/`ReplyToCommentResult`/`InboxCommentData`.
* `apps/web/src/lib/adapters/outstand/fake-outstand-adapter.ts` —
  implementasi Fake (`fetchComments`/`replyToComment`).
* `tasks/v04-engagement-mvp.md` § T-051, § T-054.
