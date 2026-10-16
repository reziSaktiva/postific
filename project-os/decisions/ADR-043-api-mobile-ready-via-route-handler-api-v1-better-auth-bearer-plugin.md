## Decision ADR-043

### Title

API Mobile-Ready via Route Handler `/api/v1` + Better Auth Bearer Plugin

### Status

Accepted

### Date

2026-07-24

### Decision

1. **Tidak ada backend terpisah** (Hono, Express, atau layanan API mandiri
   lain). Next.js App Router tetap satu-satunya runtime API, selaras
   Modular Monolith (ADR-025) dan AL-D01–AL-D04 di `application-layer.md`.
2. Mobile client (iOS/Android, direncanakan setelah MVP web selesai sesuai
   `future-roadmap.md`) diekspos lewat **Route Handler versioned**:
   `apps/web/app/api/v1/...`. Route Handler ini adalah entry point tipis
   kedua di atas Application Service yang sama dipakai Server Actions untuk
   web — tidak ada duplikasi business logic.
3. **Prioritas domain yang diekspos** mengikuti roadmap "Mobile Publishing,
   Mobile Inbox": `WorkspaceService` (fondasi context) → `PublishingService`
   → `EngagementService` → `NotificationService`. Domain lain menyusul sesuai
   kebutuhan mobile berikutnya.
4. **Auth mobile** memakai **Better Auth Bearer plugin** —
   `Authorization: Bearer <token>` menggantikan cookie session untuk request
   dari mobile client. Satu instance Better Auth dan satu tabel session tetap
   dipakai bersama web (AS-D02 tidak berubah — tetap database session,
   revocable).
5. **Workspace context untuk mobile** wajib eksplisit di path atau header
   tiap request (mis. `/api/v1/workspaces/:workspaceId/...`) — mobile tidak
   punya cookie "active workspace" seperti Middleware web.
6. **Versioning**: breaking change wajib naik ke `/api/v2`; kontrak `/api/v1`
   yang sudah dipakai mobile app tidak boleh diubah secara breaking begitu
   dirilis.
7. **Syarat keamanan wajib** sebelum endpoint mobile pertama dirilis:
   - Token disimpan di secure storage device (Keychain/Keystore), tidak di
     storage polos tanpa enkripsi — requirement lintas tim ke pengembang
     mobile.
   - `trustedOrigins` mendaftarkan custom scheme mobile secara eksplisit
     (mis. `exp://192.168.*.*:*/*` untuk Expo), bukan wildcard longgar.
   - Rate limit `customRules` per endpoint auth (sign-in, sign-up) diperketat
     dari default umum, karena `/api/v1` memperluas attack surface yang
     sebelumnya lebih tersembunyi di balik Server Actions.
   - Keputusan eksplisit soal durasi session mobile (tetap 7 hari atau lebih
     pendek + refresh) sebelum implementasi dimulai.
8. **CORS** tidak diaktifkan untuk kebutuhan Bearer mobile (CORS adalah
   mekanisme browser, tidak relevan untuk native HTTP client) — direvisit
   terpisah jika kelak ada public API berbasis browser/pihak ketiga.
9. **Timing implementasi**: fondasi (skema `/api/v1`, konfigurasi Bearer
   plugin) disiapkan sebelum M8 development web berjalan jauh, agar endpoint
   web (Server Actions) tidak perlu refactor besar nanti. Endpoint mobile
   aktual tetap dikerjakan setelah MVP web selesai, bukan sekarang.

### Reason

- Mobile app sudah tercatat sebagai future roadmap (`future-roadmap.md`),
  tapi arsitektur API saat ini (Server Actions + Route Handler khusus
  webhook) belum pernah dievaluasi untuk reusability lintas client.
- Server Actions secara teknis tidak bisa diandalkan sebagai kontrak API
  publik — ID action berubah tiap build, tidak didesain dipanggil dari luar
  Next.js.
- Application Service sebagai satu-satunya pemilik business logic (AL-D02)
  membuat penambahan Route Handler mobile menjadi entry point tambahan yang
  murah, bukan proyek arsitektur ulang — sehingga tidak butuh BE terpisah.
- Better Auth Bearer plugin mempertahankan satu sistem auth (satu secret,
  satu tabel session, satu tempat revoke) alih-alih membangun sistem auth
  kedua khusus mobile.
- Menyiapkan fondasi versioning dan auth sekarang (bukan saat mobile mulai
  dikerjakan) mencegah refactor besar pada kontrak Server Actions/Route
  Handler yang sudah dipakai web.

### Alternatives Considered

- Backend terpisah (Hono/Express sebagai API service mandiri) — ditolak;
  menambah service, deployment, dan duplikasi business logic tanpa manfaat
  yang sepadan mengingat Application Service sudah framework-agnostic secara
  desain.
- Mobile app memanggil Server Actions langsung — ditolak; tidak stabil lintas
  build, bukan kontrak API yang didukung resmi Next.js untuk client eksternal.
- Better Auth API Key plugin sebagai pengganti Bearer — ditolak untuk login
  interaktif mobile; API Key lebih cocok untuk programmatic/machine access
  (tetap dicatat sebagai Post-MVP terpisah di `auth-architecture.md`), bukan
  autentikasi user yang login di app.
- Tunda seluruh keputusan sampai mobile benar-benar mulai dikerjakan —
  ditolak; berisiko memaksa perubahan breaking pada kontrak Server
  Actions/Route Handler yang sudah stabil dipakai web MVP.
