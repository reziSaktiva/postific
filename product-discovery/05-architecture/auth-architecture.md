# Auth Architecture

Dokumen ini mendefinisikan **Security & Auth Architecture** untuk produk **Postific** — arsitektur autentikasi, manajemen sesi, workspace context resolution, dan otorisasi berbasis role (RBAC).

Dokumen ini menjadi acuan desain keamanan sistem dan tidak mencakup implementasi kode. Detail implementasi (Better Auth configuration, middleware code) didokumentasikan di Engineering Planning (M6).

---

# Tujuan

* Mendefinisikan alur autentikasi menggunakan Better Auth.
* Menetapkan struktur sesi dan data yang disimpan dalam sesi.
* Mendefinisikan mekanisme workspace context resolution.
* Menetapkan model otorisasi berbasis role (RBAC) dan cara enforcement-nya.
* Mendokumentasikan strategi Middleware untuk auth guard.
* Mendefinisikan pola proteksi route dan API endpoint.

---

# Keputusan Pra-Architecture

Keputusan berikut sudah ditetapkan sebelum dokumen ini dibuat dan menjadi fondasi Auth Architecture:

| Topik | Keputusan | Sumber |
|-------|-----------|--------|
| Auth Library | Better Auth | Keputusan pra-architecture |
| Auth Enforcement | Application-enforced sebagai lapisan utama; RLS sebagai defense-in-depth | ADR-015 |
| Identity BC | BC-01 Identity — dikelola Better Auth, prefix tabel `identity_` | `domain-model.md` |
| Application Layer | Middleware untuk auth guard dan workspace context injection | ADR-016 |
| Roles | 3 roles: Account Owner, Admin, Creator | ADR-012, ADR-074, `roles-permissions.md` |
| Multi-tenancy Unit | `workspace_id` sebagai unit isolasi | ADR-015 |

---

# Authentication

## Better Auth sebagai Identity Provider

Better Auth mengelola seluruh lifecycle autentikasi:
- Registrasi akun (email + password).
- Login dengan email + password.
- OAuth login (Google — jika ditambahkan di Engineering Planning).
- Session lifecycle (create, refresh, destroy).
- Password reset via email.

**Domain internal tidak mengimplementasikan logika autentikasi dari nol.** BC-01 Identity hanya mengekspos interface yang memanggil Better Auth API.

## Metode Autentikasi MVP

| Metode | Status MVP |
|--------|-----------|
| Email + Password | ✅ MVP |
| Google OAuth | ✅ MVP (via Better Auth OAuth plugin) |
| Magic Link | Post-MVP |
| SSO/SAML | Post-MVP |

## Alur Registrasi

```
┌─────────┐    ┌──────────────────┐    ┌──────────────┐    ┌────────────┐
│  User   │    │  Next.js Server  │    │  Better Auth │    │  Database  │
│ Browser │    │  (Server Action) │    │              │    │ (Supabase) │
└────┬────┘    └────────┬─────────┘    └──────┬───────┘    └─────┬──────┘
     │                  │                      │                   │
     │  Submit form     │                      │                   │
     │─────────────────►│                      │                   │
     │                  │  auth.signUp()        │                   │
     │                  │─────────────────────►│                   │
     │                  │                      │  INSERT user       │
     │                  │                      │──────────────────►│
     │                  │                      │  INSERT session    │
     │                  │                      │──────────────────►│
     │                  │  Session cookie       │                   │
     │                  │◄─────────────────────│                   │
     │  Set-Cookie +    │                      │                   │
     │  Redirect        │                      │                   │
     │◄─────────────────│                      │                   │
```

**Setelah registrasi:**
- Workspace belum ada — user diarahkan ke onboarding untuk membuat workspace pertama.
- `WorkspaceService.createWorkspace()` dipanggil dengan `userId` dari sesi, user otomatis menjadi Owner.

## Alur Login

```
User submit form login
  └── Server Action
        └── Better Auth auth.signIn.email({ email, password })
              ├── Sukses → Set session cookie → Redirect ke root (Middleware lanjut resolve ke `(app)` atau `/onboarding`, lihat "Onboarding Flow")
              └── Gagal  → Return error ke form
```

## Session Cookie

Better Auth menggunakan **HTTP-only cookie** untuk menyimpan session token.

| Property | Value |
|----------|-------|
| Cookie name | `better-auth.session_token` (default Better Auth) |
| HTTP-only | Ya |
| Secure | Ya (production) |
| SameSite | `lax` |
| Expiry | 7 hari (configurable) |

**Catatan:** Session token disimpan di cookie, bukan di `localStorage` — mencegah XSS attack.

---

# Session Management

## Session Data Structure

Better Auth menyimpan sesi di tabel `identity_sessions`. Data yang dapat diakses dari sesi aktif:

```
Session {
  userId: string          -- User.id dari Better Auth
  expiresAt: Date
  ipAddress: string?
  userAgent: string?
}
```

## Workspace Context

Session Better Auth **tidak menyimpan** `workspaceId` secara langsung. Workspace context disimpan di **cookie** (`active-workspace-id`, HTTP-only) dan divalidasi ulang oleh Middleware terhadap data member pada setiap request.

**Alasan:**
- User bisa jadi anggota lebih dari satu workspace, tapi hanya 1 workspace aktif pada satu waktu (`active-workspace-id`); cookie berfungsi sebagai penanda workspace aktif itu.
- Seluruh route workspace-scoped (Home, Publish, Engage, Analyze, Start Page, Settings) berada di bawah route group `(app)` — workspace context tidak bergantung pada struktur URL (`../06-engineering/monorepo-setup.md`).
- Cookie tetap divalidasi ulang terhadap `workspace_members` di setiap request (bukan dipercaya mentah) — mencegah cookie yang stale atau dimanipulasi memberi akses ke workspace yang salah.
- Jika cookie hilang atau tidak valid (mis. browser baru, cookie terhapus), user diarahkan kembali ke picker workspace di alur onboarding (lihat "Onboarding Flow" di bawah) — ini kasus *recovery*, berbeda dari switch yang disengaja (lihat "Deliberate Workspace Switch" di bawah).

**Deliberate Workspace Switch (ADR-088, amandemen ADR-089):** selama cookie
masih valid, user yang jadi anggota lebih dari satu workspace bisa
berpindah workspace aktif secara sengaja lewat Settings → Account →
Workspaces — daftar workspace yang diikutinya, workspace aktif ditandai
chip "Aktif", workspace lain bisa diklik untuk pindah. Klik row memicu
dialog konfirmasi Tier 2 (`AlertDialog`, ADR-049 — "Pindah ke workspace
[nama]?" + Batal/Pindah, ADR-089) dulu; baru setelah user menekan "Pindah"
mekanisme switch berjalan: (1) validasi ulang bahwa user memang member
workspace tujuan, (2) **overwrite langsung** cookie `active-workspace-id`
ke id workspace tujuan (tanpa langkah hapus cookie terpisah), (3) redirect
ke Home. Halaman ini juga menyediakan tombol "Buat Workspace Baru" (dialog
form nama workspace, tanpa tier konfirmasi ADR-049 karena non-destruktif —
beda dari switch yang sekarang dipagari Tier 2 meski juga non-destruktif,
karena switch mengganti seluruh konteks kerja yang sedang dilihat user).
Ini kasus yang berbeda dari picker `/onboarding` di bawah — switch dipicu
sengaja oleh user yang masih punya cookie valid, bukan oleh cookie yang
hilang di luar kendalinya. Scope ini sengaja narrow: hanya switch antar
membership yang sudah ada + create workspace tambahan; "Multi Workspace
Management" yang lebih luas (bulk actions, billing gabungan, dst.) tetap
Out of Scope (`../../02-product/mvp-definition.md`).

## Session Validation

Setiap request ke halaman atau API yang terproteksi melalui Middleware:

```
Request masuk
  └── Middleware
        ├── Ambil session cookie
        ├── Panggil Better Auth auth.api.getSession({ headers })
        ├── Jika tidak ada session → redirect ke /login
        ├── Jika session expired → redirect ke /login
        └── Jika valid → inject userId ke request context → lanjut
```

---

# Workspace Context Resolution

## Cara Kerja

Workspace aktif di-resolve oleh Middleware dari cookie `active-workspace-id`, kemudian divalidasi bahwa user memiliki akses ke workspace tersebut.

```
Request ke route (app)/*
  └── Middleware
        ├── Baca cookie active-workspace-id
        ├── Jika cookie tidak ada → redirect ke /onboarding (lihat "Onboarding Flow")
        ├── Jika ada → Query: SELECT * FROM workspace_members
        │                       WHERE workspace_id = ?
        │                         AND user_id = session.userId
        ├── Jika tidak ditemukan (cookie invalid/workspace sudah tidak diikuti) → redirect ke /onboarding
        ├── Jika ditemukan → inject { workspaceId, role } ke request headers
        └── Application Service dapat membaca workspaceId dari headers
```

## Workspace Context dalam Request

Middleware menginject workspace context sebagai custom request headers:

```
x-workspace-id: {workspaceId}
x-workspace-role: {owner | admin | creator}
```

Application Service dan Server Actions membaca headers ini untuk mengetahui workspace aktif dan role user tanpa perlu query ulang ke database.

**Keamanan:** Header ini **tidak dapat diset oleh client** — hanya Middleware yang menulis headers ini. Next.js Middleware berjalan di server edge, bukan di browser.

---

# Authorization (RBAC)

## Pendekatan

Sistem menggunakan **Role-Based Access Control (RBAC)** yang di-enforce di **Application Service layer**.

**Posisi enforcement:**

```
Request (Server Action / Route Handler)
  └── Application Service
        ├── Baca role dari request context (header x-workspace-role)
        ├── Periksa: apakah role ini diizinkan untuk operasi ini?
        ├── Jika tidak → throw AuthorizationError
        └── Jika ya → lanjut ke domain logic
```

**Aturan enforcement:**
- Authorization check **wajib** ada di Application Service sebelum domain logic dieksekusi.
- Entry Point (Server Action, Route Handler) **tidak boleh** melakukan authorization check secara mandiri — delegasikan ke Application Service.
- RLS di Supabase adalah **defense-in-depth** — jika Application Service melewatkan check, RLS mencegah akses ke data yang tidak seharusnya.

## Role Hierarchy

```
Owner > Admin > Creator
```

Owner memiliki semua permission Admin. Admin memiliki lebih banyak permission dari Creator (ADR-074 — hierarki sebelumnya Owner > Admin > Manager > Creator, "Manager" dihapus dan hak operasional kontennya digabung ke Creator).

## Permission Matrix

Referensi lengkap: `../../02-product/roles-permissions.md`

Ringkasan permission per area yang relevan untuk enforcement di Application Service:

| Operasi | Account Owner | Admin | Creator |
|---------|-------|-------|---------|
| Hapus workspace | ✅ | ❌ | ❌ |
| Transfer ownership | ✅ | ❌ | ❌ |
| Ubah billing | ✅ | ❌ | ❌ |
| Kelola connected accounts | ✅ | ✅ | ❌ |
| Undang/hapus member | ✅ | ✅ | ❌ |
| Publish / jadwalkan post | ✅ | ✅ | ✅ |
| Buat / edit draft | ✅ | ✅ | ✅ |
| Hapus konten orang lain | ✅ | ✅ | ❌ |
| Baca analytics | ✅ | ✅ | ✅ |
| Balas engagement | ✅ | ✅ | ✅ |
| Baca audit log | ✅ | ✅ | ❌ |

## Authorization Helper

Application Service menggunakan helper function untuk memvalidasi permission:

```
assertPermission(role: WorkspaceRole, operation: Operation): void
  ├── Jika role diizinkan → return (lanjut eksekusi)
  └── Jika tidak → throw AuthorizationError("Insufficient permissions")
```

`AuthorizationError` ditangkap di Entry Point dan diterjemahkan ke HTTP 403 atau error message UI.

---

# Middleware Strategy

## Route Groups

Next.js Middleware mengelola dua zona route:

```
Middleware matchers:
├── /login          → Public route (bypass auth)
├── /register       → Public route (bypass auth)  
├── /onboarding     → Protected route (wajib session, tanpa workspace context — lihat "Onboarding Flow")
├── /api/webhooks/* → Webhook routes (bypass auth — protected via HMAC signature)
├── /api/jobs/*     → Job runner routes (bypass auth — protected via X-Job-Secret)
└── (app)/*         → Protected routes (wajib session + workspace context dari cookie)
    └── Home, Publish, Engage, Analyze, Start Page, Settings — semua wajib workspace membership check
```

## Middleware Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                    MIDDLEWARE FLOW                                │
│                                                                   │
│  Request masuk                                                    │
│      │                                                            │
│      ▼                                                            │
│  Public route? ──── Ya ──► Lanjut ke handler                     │
│      │ Tidak                                                      │
│      ▼                                                            │
│  Webhook / Job route? ── Ya ──► Lanjut (protected by secret)     │
│      │ Tidak                                                      │
│      ▼                                                            │
│  Ambil session cookie                                             │
│      │                                                            │
│      ├─ Tidak ada / expired ──► Redirect /login                  │
│      │                                                            │
│      └─ Valid → Route termasuk (app)/*?                           │
│                     │                                             │
│                     ├─ Tidak (mis. /onboarding) ──► Inject userId → Lanjut │
│                     │                                             │
│                     └─ Ya → Baca cookie active-workspace-id       │
│                                 │                                 │
│                                 ├─ Tidak ada ──► Redirect /onboarding │
│                                 │                                 │
│                                 └─ Ada → Query workspace membership │
│                                             │                     │
│                                             ├─ Tidak ada akses → Redirect /onboarding │
│                                             │                     │
│                                             └─ Ada → Inject headers → Lanjut │
└──────────────────────────────────────────────────────────────────┘
```

---

# Proteksi Route API

## Route Handlers untuk External System

Route Handlers yang menerima request dari sistem eksternal (webhook, job runner) tidak melalui session auth. Dilindungi dengan mekanisme berbeda:

| Route | Mekanisme Proteksi |
|-------|-------------------|
| `/api/webhooks/outstand` | HMAC-SHA256 atas raw body, durable idempotent receipt sebelum ACK (ADR-020, ADR-040) |
| `/api/jobs/run` | Secret header `X-Job-Secret` dibandingkan env variable |
| `/api/integrations/outstand/callback` | CSRF protection via `state` parameter (ADR-021) |

## Internal API Route

Route Handler yang dipanggil dari Client Components harus:
1. Diproteksi oleh Middleware (session check).
2. Memeriksa workspace membership jika berkaitan dengan data workspace.

**Boundary secret eksternal:**
- `OUTSTAND_WEBHOOK_SECRET` dan API key Outstand hanya tersedia server-side.
- Kredensial BYOK Twitter/X dikonfigurasi manual oleh Project Owner di dashboard Outstand. Aplikasi tidak menyediakan form, endpoint, tabel, atau env var untuk X Client ID/Client Secret.

---

# Row-Level Security (Defense-in-Depth)

RLS tidak menggantikan authorization di Application Service — RLS adalah **lapisan keamanan tambahan** jika Application Service gagal melakukan pengecekan.

**Contoh RLS policy untuk data workspace:**

```sql
-- User hanya bisa baca data workspace yang mereka ikuti
CREATE POLICY "workspace_member_access"
ON publishing_posts
FOR ALL
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
  )
);
```

**Catatan:** RLS policy menggunakan `auth.uid()` dari Better Auth session — Supabase Better Auth integration harus dikonfigurasi agar `auth.uid()` mengembalikan userId yang benar. Detail konfigurasi di Engineering Planning (M6).

---

# Error Handling Auth

| Skenario | Response |
|----------|---------|
| Tidak ada session | Redirect ke `/login` (via Middleware) |
| Session expired | Redirect ke `/login` (via Middleware) |
| User tidak memiliki akses ke workspace (cookie invalid/workspace sudah tidak diikuti) | Redirect ke `/onboarding` |
| Role tidak cukup untuk operasi | `AuthorizationError` → UI error message / HTTP 403 |
| RLS violation | Supabase mengembalikan empty result atau error — Application Service menangani sebagai not found |

---

# Onboarding Flow (First Login & Cookie Re-entry)

`/onboarding` menangani dua skenario — user baru tanpa workspace, dan user existing yang kehilangan cookie workspace aktif (browser baru, cookie dihapus, dsb). Picker workspace di skenario kedua adalah re-entry point saat cookie hilang di luar kendali user — **berbeda** dari Deliberate Workspace Switch (ADR-088, lihat section "Workspace Context" di atas) yang dipicu sengaja oleh user selama cookie masih valid, lewat Settings → Account → Workspaces.

```
Login berhasil / Middleware redirect ke /onboarding (cookie active-workspace-id tidak ada/invalid)
  └── /onboarding
        ├── Query: workspace yang diikuti user (workspace_members WHERE user_id = session.userId)
        │
        ├── 0 workspace → User membuat workspace pertama
        │     └── WorkspaceService.createWorkspace()
        │           ├── Buat Workspace baru
        │           ├── Buat WorkspaceMember (userId, role: owner)
        │           ├── Set cookie active-workspace-id
        │           └── Redirect ke (app) home
        │
        └── ≥1 workspace (cookie hilang, bukan user baru) → Tampilkan picker daftar workspace
              └── User pilih salah satu
                    ├── Set cookie active-workspace-id
                    └── Redirect ke (app) home
```

---

# Post-MVP Considerations

| Fitur | Kompleksitas | Prioritas |
|-------|-------------|-----------|
| Multi-workspace switching (deliberate switch antar membership + create workspace tambahan sudah masuk MVP per ADR-088 — sisanya seperti cross-workspace bulk actions, billing gabungan, shared views tetap di sini) | Medium | High |
| Magic Link login | Low | Medium |
| SSO/SAML | Tinggi | Low (enterprise) |
| Two-Factor Authentication (2FA) | Medium | Medium |
| Audit log untuk auth events | Low | Medium |
| API key untuk programmatic access (machine-to-machine, bukan login user interaktif — beda dari Bearer plugin mobile ADR-043) | Medium | Low |

---

# Decision Log

| ID | Keputusan | Alasan |
|----|-----------|--------|
| AU-D01 | Better Auth sebagai auth library | Sudah ditetapkan sebagai keputusan pra-architecture; menghindari implementasi auth dari nol |
| AU-D02 | HTTP-only cookie untuk session token | Mencegah XSS attack; session tidak dapat diakses oleh JavaScript di browser |
| AU-D03 | Workspace context disimpan di cookie `active-workspace-id`, divalidasi ulang oleh Middleware terhadap `workspace_members` di setiap request | Cookie tidak dipercaya mentah — tetap divalidasi ke database agar tidak stale atau bisa dimanipulasi; cookie hilang → re-entry via picker onboarding; switch disengaja antar membership → dialog konfirmasi Tier 2 lalu overwrite cookie langsung via Settings → Account → Workspaces (ADR-088, amandemen ADR-089) |
| AU-D04 | Inject workspace context via custom request headers | Memungkinkan Application Service membaca context tanpa query database ulang; tidak dapat dimanipulasi client |
| AU-D05 | Authorization check di Application Service layer | Selaras dengan DDD — domain service yang mengetahui aturan bisnis; Entry Point tetap thin |
| AU-D06 | RLS sebagai defense-in-depth, bukan primary enforcement | Application-enforced lebih fleksibel dan testable; RLS sebagai safety net jika ada bug di layer atas |
| AU-D07 | Email + Password + Google OAuth untuk MVP | Cukup untuk target user (tim profesional); Magic Link dan SSO dipertimbangkan post-MVP |
| AU-D08 | HMAC webhook diverifikasi atas raw body dan receipt durable sebelum ACK | Menjaga autentisitas sekaligus mencegah kehilangan event |
| AU-D09 | Secret BYOK X berada di dashboard Outstand, bukan aplikasi | Mengurangi exposure secret platform dan selaras ADR-040 |
| AU-D10 | ADR-040 | AU-D08–D09 mengamandemen boundary proteksi integrasi |
| AU-D11 | Better Auth Bearer plugin sebagai mekanisme auth mobile client, di atas Route Handler `/api/v1` (ADR-043) | Server Actions tidak stabil lintas build untuk client eksternal; Bearer mempertahankan RBAC di Application Service (AU-D05) tanpa jalur otorisasi kedua khusus mobile |

---

# Related Documents

* `domain-model.md` — BC-01 Identity, BC-02 Workspace, WorkspaceMember entity
* `database-strategy.md` — tabel `identity_*` (Better Auth), `workspace_members`
* `application-layer.md` — Middleware strategy dan Application Service authorization pattern
* `../../02-product/roles-permissions.md` — Permission matrix lengkap per role
* `realtime-strategy.md` — Session diperlukan sebelum Supabase Realtime subscription
* `../06-engineering/auth-strategy.md` — konfigurasi Better Auth Bearer plugin untuk mobile (AS-D06)
* `../../project-manager/DECISIONS.md` — ADR-024, ADR-043
