# Authentication Strategy

Dokumen ini mendefinisikan **konfigurasi implementasi autentikasi** untuk produk Postific: setup Better Auth, provider, struktur sesi, konfigurasi cookie, integrasi Supabase JWT untuk Realtime, dan konfigurasi per environment.

Dokumen ini adalah implementasi konkret dari **Auth Architecture** (`../05-architecture/auth-architecture.md`, ADR-024). Keputusan desain keamanan (RBAC di Application Service, Middleware workspace resolution, RLS defense-in-depth) sudah ditetapkan di sana dan **tidak diputuskan ulang** di sini — dokumen ini fokus pada detail konfigurasi teknis.

---

# Tujuan

* Mendefinisikan konfigurasi instance Better Auth secara definitif.
* Menetapkan provider autentikasi MVP dan konfigurasinya (email/password, Google OAuth).
* Menetapkan struktur dan atribut session cookie.
* Mendefinisikan integrasi Better Auth ↔ Supabase agar `auth.uid()` tersedia untuk Supabase Realtime (dual-context RLS).
* Menetapkan konfigurasi auth per environment (production vs staging).
* Menetapkan dependency eksternal yang dibutuhkan (transactional email untuk password reset).

---

# Keputusan yang Sudah Terkunci (dari Baseline)

Keputusan berikut sudah final dari Auth Architecture (ADR-024) dan menjadi input dokumen ini:

| Topik | Keputusan | Sumber |
|-------|-----------|--------|
| Auth Library | Better Auth | ADR-024, AU-D01 |
| Metode MVP | Email + Password, Google OAuth | AU-D07 |
| Session Token | HTTP-only cookie | AU-D02 |
| Session Expiry | 7 hari | `auth-architecture.md` |
| SameSite | `lax` | `auth-architecture.md` |
| Authorization | RBAC di Application Service (3 roles, ADR-074) | AU-D05 |
| Workspace Context | Di-resolve dari cookie (bukan URL slug) — divalidasi membership-nya oleh `src/proxy.ts` | AU-D03, AU-D04 |
| RLS | Defense-in-depth, bukan primary enforcement | AU-D06, DB-D05 |
| Identity Tables | Prefix `identity_`, dikelola Better Auth | DB-D04 |

---

# Keputusan Auth Strategy (Ditetapkan di Dokumen Ini)

| ID | Topik | Keputusan |
|----|-------|-----------|
| AS-D01 | Better Auth Database | Better Auth menyimpan data auth di Supabase PostgreSQL yang sama, tabel prefix `identity_`, diakses via Prisma adapter + `DATABASE_URL` (pooled; lihat `database-orm.md`) |
| AS-D02 | Session Strategy | Database session (bukan JWT-only) — token opaque di cookie, sesi tervalidasi ke tabel `identity_sessions` |
| AS-D03 | Supabase Realtime Auth | Better Auth menerbitkan JWT Supabase-compatible (HS256, di-sign dengan `SUPABASE_JWT_SECRET`) berisi `sub = userId` agar `auth.uid()` valid untuk RLS Realtime |
| AS-D04 | Password Reset | Via email token Better Auth — membutuhkan transactional email provider (dependency terbuka, lihat bagian Dependency) |
| AS-D05 | Google OAuth Redirect | Callback per environment: `{BETTER_AUTH_URL}/api/auth/callback/google` — URL berbeda untuk production & staging |
| AS-D06 | Mobile Auth | Better Auth **Bearer plugin** untuk `/api/v1` (ADR-043) — `Authorization: Bearer <token>` menggantikan cookie session untuk request mobile; satu instance Better Auth & satu tabel session dengan web |

---

# Better Auth Configuration

Instance Better Auth didefinisikan di `apps/web/src/lib/better-auth/auth.ts` (lihat `monorepo-setup.md`).

## Struktur Konfigurasi

```typescript
// apps/web/src/lib/better-auth/auth.ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  // Koneksi ke Supabase PostgreSQL via Prisma (AS-D01, DO-D05)
  database: {
    // Better Auth Prisma adapter — DATABASE_URL pooled (Supavisor)
    // detail: database-orm.md
  },

  // Base URL berbeda per environment (AS-D05)
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  // Email + Password (AU-D07)
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // verifikasi email saat registrasi
    // sendResetPassword: dikonfigurasi setelah email provider dipilih (AS-D04)
  },

  // Google OAuth (AU-D07)
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },

  // Session: 7 hari (auth-architecture.md)
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 hari
    updateAge: 60 * 60 * 24,     // perpanjang jika < 1 hari tersisa
  },

  // Atribut cookie (AU-D02) — Secure mengikuti environment (lihat tabel di bawah)
  advanced: {
    cookiePrefix: "better-auth",
    useSecureCookies: process.env.NODE_ENV === "production", // true di staging/prod (HTTPS); false di local HTTP
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  },
});
```

> Konfigurasi di atas adalah acuan struktur, bukan kode final. Prisma adapter dan model `identity_*` di-finalisasi saat Repository & Bootstrap (M7) mengikuti `database-orm.md` (DO-D05).
>
> **Cookie `Secure` per tier** (selaras `environment-management.md`): local (`bun run dev`, HTTP `localhost`) → `secure: false` / `useSecureCookies: false`; staging & production (HTTPS Railway, `NODE_ENV=production`) → `true`. Implementasi M7 boleh memakai deteksi eksplisit selain `NODE_ENV` selama hasil per tier sama.

---

# Provider & Metode Autentikasi

## Email + Password

| Aspek | Konfigurasi |
|-------|-------------|
| Registrasi | Email + password via Server Action → `auth.api.signUpEmail()` |
| Verifikasi email | Wajib (`requireEmailVerification: true`) — butuh email provider |
| Login | `auth.api.signInEmail()` |
| Password reset | Token via email (AS-D04) |
| Password hashing | Dikelola Better Auth (scrypt default) — tidak diimplementasikan manual |

## Google OAuth

| Aspek | Konfigurasi |
|-------|-------------|
| Client ID/Secret | Env var `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Redirect URI | `{BETTER_AUTH_URL}/api/auth/callback/google` |
| Scope | `email`, `profile` (default) |
| Akun terpisah per env | Disarankan OAuth client Google terpisah untuk production & staging (redirect URI berbeda) |

**Redirect URI yang perlu didaftarkan di Google Cloud Console:**

```
Production : https://<production-domain>/api/auth/callback/google
Staging    : https://staging.<domain>/api/auth/callback/google
```

---

# Mobile Auth — Bearer Plugin (AS-D06, ADR-043)

Mobile client (iOS/Android, diimplementasikan setelah MVP web selesai)
mengakses `/api/v1/...` (`application-layer.md` — "Route Handler v1 — Mobile
Client") memakai **Better Auth Bearer plugin**, bukan cookie session.

## Struktur Konfigurasi (Tambahan)

```typescript
// apps/web/src/lib/better-auth/auth.ts
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";

export const auth = betterAuth({
  // ...konfigurasi dasar tetap sama (lihat "Struktur Konfigurasi" di atas)

  plugins: [
    bearer(), // Authorization: Bearer <token> untuk /api/v1 mobile client
  ],

  // Custom scheme mobile wajib didaftarkan eksplisit — bukan wildcard longgar
  trustedOrigins: [
    process.env.BETTER_AUTH_URL!,
    // contoh Expo dev client — sesuaikan scheme aplikasi mobile sebenarnya:
    // "exp://192.168.*.*:*/*",
  ],

  rateLimit: {
    enabled: true,
    customRules: {
      "/api/auth/sign-in/email": { window: 60, max: 5 },
      "/api/auth/sign-up/email": { window: 60, max: 3 },
    },
  },
});
```

## Aturan

| Aspek | Keputusan |
|-------|-----------|
| Mekanisme | `Authorization: Bearer <token>` — token opaque, tervalidasi ke tabel `identity_sessions` yang sama dengan web (AS-D02 tidak berubah) |
| Penyimpanan token di device | Wajib Keychain (iOS) / Keystore atau EncryptedSharedPreferences (Android) — **tidak boleh** di storage polos tanpa enkripsi. Requirement ke tim mobile, bukan konfigurasi backend, tapi wajib dicatat sebagai syarat rilis |
| Workspace context | Tidak ada cookie "active workspace" seperti Middleware web — `workspaceId` wajib eksplisit di path/header tiap request; authorization tetap di Application Service (AU-D05, tidak ada shortcut untuk mobile) |
| `trustedOrigins` | Custom scheme mobile (mis. Expo `exp://...`) didaftarkan eksplisit per app, tidak memakai wildcard longgar yang bisa menerima origin tak dikenal |
| Rate limit endpoint auth | `customRules` memperketat `/api/auth/sign-in/email` dan `/api/auth/sign-up/email` dari default umum — `/api/v1` memperluas attack surface yang sebelumnya lebih tersembunyi di balik Server Actions |
| Session expiry mobile | Menyusul default 7 hari (sama dengan web) kecuali diputuskan lain saat implementasi — device fisik yang hilang/dicuri adalah risiko nyata untuk sesi berumur panjang, evaluasi ulang sebelum rilis endpoint mobile pertama |
| CORS | Tidak diaktifkan untuk kebutuhan ini — CORS adalah mekanisme browser, tidak relevan untuk native HTTP client memakai Bearer token |
| CSRF | Tidak relevan untuk endpoint Bearer-only — Bearer token tidak auto-attached seperti cookie, sehingga bebas dari kelas serangan CSRF yang berlaku untuk endpoint cookie-based |
| Audit trail | `databaseHooks.session.create`/`delete` dapat dipakai mencatat device/IP saat sesi mobile dibuat/dicabut — pola sama dapat dipakai untuk audit auth events secara umum |

---

# Session Management

## Strategi Session (AS-D02)

Better Auth menggunakan **database session** — token opaque disimpan di cookie, dan setiap validasi memeriksa tabel `identity_sessions`. Ini dipilih (bukan JWT stateless-only) agar sesi dapat **direvokasi** (logout, hapus device) dan konsisten dengan `auth-architecture.md`.

## Atribut Cookie

| Property | Value | Alasan |
|----------|-------|--------|
| Nama | `better-auth.session_token` | Default Better Auth |
| HttpOnly | `true` | Mencegah akses via JavaScript (anti-XSS) — AU-D02 |
| Secure | `false` (local HTTP); `true` (staging & production HTTPS) | Local memakai `http://localhost`; staging/prod memakai Railway TLS — `environment-management.md`, `deployment-infrastructure.md` |
| SameSite | `lax` | Menyeimbangkan proteksi CSRF dan UX OAuth redirect |
| Expiry | 7 hari | `auth-architecture.md` |
| Path | `/` | Berlaku seluruh aplikasi |

## Validasi Session

Alur validasi tidak berubah dari `auth-architecture.md`: Middleware memanggil `auth.api.getSession({ headers })` pada setiap request terproteksi, redirect ke `/login` jika tidak ada/expired. Dokumen ini hanya menetapkan konfigurasi yang mendukung alur tersebut.

---

# Integrasi Better Auth ↔ Supabase (Dual-Context RLS)

Ini adalah detail M6 yang di-refer oleh `auth-architecture.md` dan ARCH-REVIEW-02 (`database-strategy.md`, `realtime-strategy.md`). Ada **dua konteks** akses data dengan mekanisme identitas berbeda:

```
┌───────────────────────────────────────────────────────────────┐
│  KONTEKS 1 — Server-side (mayoritas akses data)                 │
│                                                                  │
│  Next.js Server (Server Component / Action / Route Handler)      │
│    → Prisma Client (CRUD domain — ADR-031)                       │
│    → SET LOCAL app.current_user_id = '{userId}' (via Prisma)     │
│    → RLS memeriksa current_setting('app.current_user_id')        │
│                                                                  │
│  Identitas berasal dari: Better Auth session (opaque token)      │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│  KONTEKS 2 — Supabase Realtime (notifikasi in-app, client-side)  │
│                                                                  │
│  Browser client → Supabase Realtime (WebSocket)                  │
│    → memerlukan JWT yang dikenali Supabase (auth.uid())          │
│    → RLS subscription memeriksa auth.uid() = user_id             │
│                                                                  │
│  Identitas berasal dari: JWT Supabase-compatible dari Better Auth│
└───────────────────────────────────────────────────────────────┘
```

## Mekanisme Konteks 2 (AS-D03)

Karena Better Auth **tidak** memakai Supabase Auth (DB-D05, `database-strategy.md`), `auth.uid()` tidak otomatis tersedia. Untuk jalur Realtime:

1. Server menerbitkan **JWT HS256** yang di-sign dengan `SUPABASE_JWT_SECRET` (secret milik project Supabase).
2. Payload JWT minimal berisi `sub = userId` (dan `role`, `exp`) — kompatibel dengan konvensi Supabase sehingga `auth.uid()` mengembalikan `userId`.
3. JWT ini di-generate on-demand untuk client (mis. via endpoint terproteksi) dan diberikan ke Supabase Realtime client (`supabase.realtime.setAuth(token)`).
4. RLS subscription pada tabel `notifications` memakai `auth.uid() = user_id` (`realtime-strategy.md`).

**Batasan penting:** JWT ini **hanya** untuk otorisasi channel Realtime, bukan pengganti session cookie. Seluruh mutasi dan pembacaan data utama tetap melalui Konteks 1 (Prisma + `app.current_user_id`). Service role key Supabase tetap hanya di server untuk Storage (dan operasi platform lain yang memerlukannya) — tidak pernah terekspos ke browser.

---

# Konfigurasi per Environment

Selaras dengan `deployment-infrastructure.md` (Supabase project terpisah, DI-D03):

| Env Var | Production | Staging |
|---------|-----------|---------|
| `BETTER_AUTH_URL` | `https://<production-domain>` | `https://staging.<domain>` |
| `BETTER_AUTH_SECRET` | Secret produksi (unik) | Secret staging (unik) |
| `GOOGLE_CLIENT_ID` / `_SECRET` | OAuth client produksi | OAuth client staging |
| `DATABASE_URL` | Project Supabase prod | Project Supabase staging |
| `SUPABASE_JWT_SECRET` | JWT secret project prod | JWT secret project staging |

- Staging & production: `useSecureCookies: true` (HTTPS). Local: `useSecureCookies: false` (HTTP `localhost`) — selaras katalog tier di `environment-management.md`.
- Cookie ter-scope ke domain masing-masing environment — tidak ada berbagi sesi antara staging dan production (local juga terpisah).
- Detail penamaan dan pengelolaan seluruh env var ada di `environment-management.md`.

---

# Dependency Terbuka — Transactional Email (AS-D04)

Verifikasi email registrasi dan password reset membutuhkan **transactional email provider** yang **belum ditetapkan**. Ini bukan bagian dari baseline auth dan berdampak pada notifikasi sistem secara umum.

**Status:** perlu keputusan terpisah (kandidat: Resend, Postmark, AWS SES, atau SMTP Supabase bawaan untuk MVP).

Sampai provider dipilih:
- Fungsi `emailAndPassword.sendResetPassword` dan email verification di-stub / dinonaktifkan sementara.
- Keputusan email provider disarankan diputuskan bersamaan dengan kebutuhan email notifikasi lain (di luar scope dokumen ini).

---

# Security Considerations

| Aspek | Penanganan |
|-------|-----------|
| XSS | Session token HttpOnly — tidak dapat dibaca JavaScript (AU-D02) |
| CSRF | SameSite=lax + Better Auth CSRF protection bawaan |
| Service role key | Hanya di server (env var), tidak pernah dikirim ke browser |
| Supabase JWT (Realtime) | Berumur pendek, scope minimal (`sub`, `role`, `exp`), hanya untuk channel Realtime |
| Secret rotation | `BETTER_AUTH_SECRET` dan `SUPABASE_JWT_SECRET` dapat dirotasi per environment tanpa memengaruhi environment lain (DI-D03) |
| Brute force | Rate limiting Better Auth dengan `customRules` eksplisit per endpoint sensitif (`sign-in`, `sign-up`) — lihat "Mobile Auth — Bearer Plugin" (AS-D06) untuk konfigurasi konkret, berlaku juga untuk web |
| Bearer token mobile | Token disimpan di secure device storage (Keychain/Keystore), revocable via database session yang sama dengan web; tidak rentan CSRF karena tidak auto-attached seperti cookie (AS-D06, ADR-043) |

---

# Decision Log

| ID | Keputusan | Alasan | Alternatif |
|----|-----------|--------|-----------|
| AS-D01 | Better Auth menyimpan data auth di Supabase PostgreSQL yang sama (prefix `identity_`) via Prisma | Satu database & satu migrate path (DO-D05); konsisten dengan DB-D04 | DB terpisah untuk auth; driver non-Prisma terpisah dari schema |
| AS-D02 | Database session (token opaque) alih-alih JWT stateless-only | Sesi dapat direvokasi (logout/hapus device); konsisten dengan `auth-architecture.md` | JWT stateless (tidak bisa direvokasi sebelum expiry) |
| AS-D03 | Better Auth menerbitkan JWT Supabase-compatible untuk Realtime | Menyediakan `auth.uid()` bagi RLS Realtime tanpa memindahkan seluruh auth ke Supabase Auth | Pindah ke Supabase Auth (bertentangan ADR-024); polling manual (menghapus manfaat Realtime) |
| AS-D04 | Password reset & email verification via transactional email (provider TBD) | Memisahkan pilihan email provider dari keputusan auth core; auth tidak terblok | Hardcode satu provider sekarang (keputusan prematur di luar scope) |
| AS-D05 | OAuth client & redirect URI terpisah per environment | Isolasi kredensial; callback URL berbeda antara prod & staging | Satu OAuth client dipakai bersama (redirect URI campur, rawan salah routing) |
| AS-D06 | Better Auth Bearer plugin untuk auth mobile `/api/v1` | Mempertahankan satu sistem auth (satu secret, satu tabel session, satu tempat revoke) alih-alih membangun auth kedua khusus mobile; Bearer bebas CSRF dan tetap revocable (ADR-043) | API Key plugin sebagai auth login mobile (cocok programmatic access, bukan interactive login); backend auth terpisah untuk mobile (duplikasi sistem) |

---

# Related Documents

* `README.md` — scope dan workflow Engineering Planning
* `deployment-infrastructure.md` — environment topology, cookie `Secure`, `BETTER_AUTH_URL` per env
* `monorepo-setup.md` — lokasi `src/lib/better-auth/auth.ts` dan `src/proxy.ts` (Next.js 16 Proxy, dulu `middleware.ts`)
* `database-orm.md` — Prisma ORM, Prisma adapter Better Auth, migration `identity_*`, pooling
* `environment-management.md` — detail env var auth & secret (ADR-033)
* `../../product-discovery/05-architecture/auth-architecture.md` — desain auth (ADR-024), Middleware, RBAC
* `../../product-discovery/05-architecture/database-strategy.md` — DB-D04, DB-D05, RLS `app.current_user_id`
* `../../product-discovery/05-architecture/realtime-strategy.md` — RLS subscription `auth.uid()` pada `notifications`
* `../05-architecture/application-layer.md` — Route Handler v1 mobile client (AL-D08, ADR-043)
* `../../project-manager/DECISIONS.md` — ADR-024, ADR-030, ADR-043
