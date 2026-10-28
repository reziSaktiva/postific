# Application Layer

Dokumen ini mendefinisikan **Application Layer** untuk produk **Postific** — bagaimana Next.js App Router berinteraksi dengan domain logic, service layer, dan repository layer dalam arsitektur Modular Monolith + DDD.

Dokumen ini menjadi acuan struktur layer sistem dan aturan interaksi antar layer. Implementasi detail (kode, ORM, folder structure eksak) didokumentasikan di Engineering Planning (M6).

---

# Tujuan

* Mendefinisikan layer stack sistem dan tanggung jawab masing-masing layer.
* Menentukan pola entry point Next.js: kapan pakai Server Components, Server Actions, dan Route Handlers.
* Menetapkan kontrak Application Service per Bounded Context.
* Mendefinisikan Repository Pattern yang digunakan di seluruh domain.
* Menetapkan aturan komunikasi lintas domain.
* Mendokumentasikan strategi error handling di tingkat arsitektur.

---

# Layer Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENTRY POINTS                                  │
│  (Next.js App Router — Server Components, Server Actions,        │
│   Route Handlers, Middleware)                                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│                    APPLICATION SERVICE LAYER                     │
│  (Satu service per Bounded Context — orchestrasi, otorisasi,     │
│   koordinasi domain logic + repository)                          │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│                    DOMAIN LOGIC LAYER                            │
│  (Entities, Value Objects, Domain Rules — pure business logic,   │
│   tidak ada dependency ke infrastructure)                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│                    REPOSITORY LAYER                              │
│  (Interface didefinisikan di domain module; implementasi          │
│   menggunakan Prisma Client)                                     │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│                    INFRASTRUCTURE                                │
│  (Supabase PostgreSQL, Supabase Storage, Better Auth)            │
└─────────────────────────────────────────────────────────────────┘
```

---

# Layer Responsibilities

## Entry Points — Next.js App Router

Layer terluar yang menerima request dari browser atau sistem eksternal. Tidak boleh mengandung business logic.

| Entry Point | Tanggung Jawab | Contoh Penggunaan |
|-------------|----------------|-------------------|
| **Server Component** | Fetch data untuk render halaman; tidak ada side effect | Load daftar post, load analytics snapshot |
| **Server Action** | Handle mutations yang dipicu dari UI (form, button klik) | Buat draft, jadwalkan post, update profil |
| **Route Handler** | Handle request dari sistem eksternal atau API client | Webhook Outstand, health check endpoint |
| **Middleware** | Guard autentikasi, injeksi workspace context ke request | Verifikasi session, redirect jika belum login |

**Aturan:**
- Entry Points hanya boleh memanggil **Application Service** — tidak boleh langsung ke repository atau domain logic.
- Entry Points bertanggung jawab atas serialisasi/deserialisasi data (request → DTO → service input).
- Error dari Application Service ditangkap di Entry Point dan diterjemahkan menjadi response yang sesuai.

---

## Application Service Layer

Jantung dari setiap Bounded Context. Service layer mengatur alur operasi: validasi input, otorisasi, eksekusi domain logic, dan interaksi dengan repository.

**Satu service per Bounded Context:**

| Bounded Context | Application Service |
|----------------|---------------------|
| BC-01 Identity | `IdentityService` |
| BC-02 Workspace | `WorkspaceService` |
| BC-03 Publishing | `PublishingService` |
| BC-04 MCP Access | `McpAccessService` |
| BC-05 Engagement | `EngagementService` |
| BC-06 Analytics | `AnalyticsService` |
| BC-07 Start Page | `StartPageService` |
| BC-08 Media | `MediaService` |
| BC-09 Notification | `NotificationService` |

**Tanggung jawab Application Service:**
1. Menerima input dari Entry Point (sudah tervalidasi format di Entry Point).
2. Menjalankan **authorization check** — apakah user memiliki permission untuk operasi ini.
3. Memanggil domain logic untuk memvalidasi dan mengeksekusi business rule.
4. Berinteraksi dengan repository untuk read/write data.
5. Memanggil service domain lain jika diperlukan (via service-to-service call).
6. Melempar domain error jika operasi tidak valid.

**Aturan:**
- Application Service **tidak boleh** langsung mengeksekusi query SQL atau mengakses Prisma / Supabase client — semua akses data domain melalui repository.
- Application Service **tidak boleh** mengandung rendering logic atau HTTP concerns.
- Setiap service hanya boleh mengakses repository milik bounded context-nya sendiri.

---

## Domain Logic Layer

Layer yang mengandung **pure business logic** — tidak bergantung pada framework, database, atau infrastruktur apapun.

**Komponen Domain Logic:**
- **Entities** — objek dengan identitas (Post, Workspace, Member, dll.)
- **Value Objects** — objek tanpa identitas, immutable (BrandSettings, PostStatus, dll.)
- **Domain Rules** — validasi dan constraint bisnis (misal: hanya Owner yang bisa hapus workspace, Post tidak bisa dijadwalkan ke masa lalu)

**Aturan:**
- Domain logic **tidak boleh** import dari infrastruktur, framework, atau service layer.
- Domain logic boleh di-unit-test tanpa setup database atau server.
- Shared types antar domain (UserId, WorkspaceId, dll.) diambil dari `packages/shared`.

---

## Repository Layer

Lapisan abstraksi antara domain logic dan database. Interface repository didefinisikan di dalam domain module; implementasinya menggunakan **Prisma Client** (ADR-031). Supabase client dipakai terpisah untuk Realtime dan Storage.

**Pola yang digunakan:**

```
[Interface — didefinisikan di domain]
IPostRepository
  ├── findById(id: PostId): Promise<Post | null>
  ├── findByWorkspace(workspaceId: WorkspaceId, filter): Promise<Post[]>
  ├── save(post: Post): Promise<void>
  └── delete(id: PostId): Promise<void>

[Implementasi — menggunakan Prisma Client]
PrismaPostRepository implements IPostRepository
```

**Satu repository per Aggregate Root:**

| Aggregate Root | Repository Interface |
|----------------|---------------------|
| `Post` | `IPostRepository` |
| `Workspace` | `IWorkspaceRepository` |
| `Member` | `IMemberRepository` |
| `ConnectedAccount` | `IConnectedAccountRepository` |
| `McpGrant` | `IMcpGrantRepository` (pencabutan atomik lewat port `IMcpGrantRevocationPort`) |
| `McpAuditLog` (entity, BC-04) | `IMcpAuditRepository` |
| `InboxItem` | `IInboxItemRepository` |
| `PostMetrics` | `IPostMetricsRepository` |
| `WorkspaceSnapshot` | `IWorkspaceSnapshotRepository` |
| `StartPage` | `IStartPageRepository` |
| `MediaItem` | `IMediaItemRepository` |
| `Notification` | `INotificationRepository` |

**Aturan:**
- Repository interface hanya boleh diketahui oleh Application Service domain yang sama.
- Repository implementasi boleh menggunakan Prisma Client secara langsung (bukan Supabase JS untuk CRUD).
- Repository bertanggung jawab atas mapping antara database row dan domain entity.

---

# Next.js Entry Point Patterns

## Server Components — Data Fetching

Digunakan untuk semua operasi **baca** yang diperlukan untuk render halaman.

```
Page Component (Server)
  └── memanggil ApplicationService.findXxx(...)
       └── memanggil Repository.findXxx(...)
            └── Prisma Client query
```

**Kapan digunakan:**
- Load daftar post untuk halaman Calendar.
- Load analytics snapshot untuk halaman Analytics.
- Load data profil workspace.
- Load media library.

**Aturan:**
- Server Component tidak boleh menyimpan state atau menerima event dari browser.
- Data fetching di Server Component tidak melalui `fetch()` ke endpoint internal — langsung panggil Application Service.

---

## Server Actions — UI Mutations

Digunakan untuk semua operasi **tulis** yang dipicu dari interaksi user di UI.

```
Client Component (triggers action)
  └── memanggil Server Action
       └── memanggil ApplicationService.doXxx(...)
            ├── authorization check
            ├── domain logic
            └── Repository.save(...)
```

**Kapan digunakan:**
- Membuat atau mengedit draft post.
- Menjadwalkan atau membatalkan post.
- Mengelola anggota workspace (invite, remove, ubah role).
- Reply engagement inbox.
- Cabut koneksi klien AI (`revokeGrant`).
- Upload media.

**Aturan:**
- Server Action harus melakukan validasi format input sebelum memanggil service (gunakan schema validation — library ditentukan di Engineering Planning).
- Server Action bertanggung jawab menangkap domain error dan mengembalikan structured error response ke client.
- Server Action tidak boleh bypass authorization — authorization dilakukan di Application Service.

---

## Route Handlers — External & API

Digunakan untuk request dari **sistem eksternal** atau kebutuhan yang tidak bisa dilayani Server Actions.

```
External System / Browser Fetch
  └── Route Handler (apps/web/app/api/...)
       └── memanggil ApplicationService.handleXxx(...)
            └── ...
```

**Kapan digunakan:**
- Webhook resmi Outstand (`post.published`, `post.error`, `account.token_expired`).
- Health check endpoint.
- File download endpoint (jika diperlukan).
- **API mobile-ready** (`/api/v1/...`, ADR-043) — kontrak REST/JSON versioned untuk mobile client, dibahas di bagian "Route Handler v1 — Mobile Client" di bawah.

**Aturan:**
- Webhook Route Handler membaca raw body, memvalidasi HMAC atas bytes tersebut, lalu memanggil ingestion Application Service untuk persist receipt idempoten dan enqueue JOB-01 sebelum ACK `2xx`.
- Route Handler tidak boleh langsung mengakses database — termasuk receipt webhook; wajib melalui Application Service/repository sistem.
- Route Handler bukan pengganti Server Actions untuk mutasi dari UI.

---

## Route Handler v1 — Mobile Client (ADR-043)

Next.js App Router tetap satu-satunya runtime API — **tidak ada backend
terpisah** (Hono, dll.) untuk melayani mobile client. Mobile diekspos lewat
Route Handler versioned yang memanggil Application Service yang sama dipakai
Server Actions untuk web.

```
Mobile App (iOS/Android)
  └── Authorization: Bearer <token>
       └── Route Handler (apps/web/app/api/v1/...)
            └── memanggil ApplicationService.xxx(...) — sama dengan Server Action
                 └── ...
```

**Kenapa bukan Server Actions untuk mobile:** Server Actions adalah mekanisme
RPC internal Next.js — ID action berubah tiap build/deploy dan tidak didesain
dipanggil dari luar aplikasi Next.js. Mobile client wajib lewat kontrak
REST/JSON stabil (Route Handler), bukan Server Action.

**Aturan tambahan khusus `/api/v1`:**
- **Auth**: Better Auth Bearer plugin (`Authorization: Bearer <token>`)
  menggantikan cookie session — lihat `auth-strategy.md` untuk konfigurasi.
  Satu instance Better Auth, satu tabel session dengan web (AS-D02 tidak
  berubah).
- **Workspace context**: karena tidak ada cookie "active workspace" seperti
  Middleware web, `workspaceId` wajib eksplisit di path atau header tiap
  request (mis. `/api/v1/workspaces/:workspaceId/...`). Route Handler tetap
  memanggil Application Service untuk authorization check granular — tidak
  ada shortcut otorisasi khusus mobile.
- **Versioning**: breaking change wajib naik ke `/api/v2`; kontrak `/api/v1`
  yang sudah dipakai mobile app tidak boleh diubah secara breaking.
- **Prioritas domain diekspos** (mengikuti `future-roadmap.md` — "Mobile
  Publishing, Mobile Inbox"): `WorkspaceService` → `PublishingService` →
  `EngagementService` → `NotificationService`.
- **Timing**: fondasi (skema `/api/v1`, konfigurasi Bearer) disiapkan
  mendahului M8, endpoint mobile aktual diimplementasikan setelah MVP web
  selesai (bukan bagian MVP — `mvp-definition.md`, `product-scope.md`).

---

## Middleware — Auth Guard & Workspace Context

Middleware berjalan sebelum setiap request ke halaman dashboard. Tanggung jawabnya:

1. Verifikasi session aktif via Better Auth.
2. Ekstrak `userId` dari session.
3. Resolusi `workspaceId` aktif dari URL atau cookie.
4. Redirect ke halaman login jika session tidak valid.
5. Redirect ke workspace selector jika workspace tidak ditemukan.

**Catatan:** Middleware tidak memanggil Application Service — hanya melakukan verifikasi session dan resolusi context. Otorisasi granular (role-based permission) dilakukan di Application Service.

---

# Cross-Domain Communication

Ketika satu domain membutuhkan data atau trigger operasi di domain lain, mekanismenya adalah **service-to-service call langsung**.

## Aturan Service-to-Service Call

1. **Hanya import dari public API modul** — setiap domain mengekspos `index.ts` sebagai satu-satunya pintu masuk. Tidak boleh import dari file internal domain lain.
2. **Tidak ada circular dependency** — jika BC-A memanggil BC-B, maka BC-B tidak boleh memanggil BC-A.
3. **Hanya passing ID, bukan entity** — saat memanggil service domain lain, kirim ID (WorkspaceId, UserId, dll.) bukan full entity object lintas domain.

## Peta Dependency Antar Domain

```
BC-01 Identity
    ↑ (dikonsumsi oleh semua BC via UserId)

BC-02 Workspace
    ↑ (dikonsumsi oleh BC-03, BC-04, BC-05, BC-06, BC-07, BC-08, BC-09)

BC-03 Publishing ──→ BC-02 Workspace (verifikasi ConnectedAccount)
                ──→ BC-08 Media (attach MediaItem ke post)
                ──→ BC-06 Analytics (metrik post per target akun, via PostMetricsPort — KI-064)

BC-04 MCP Access ──→ BC-02 Workspace (verifikasi member aktif per panggilan)
                 (tool MCP adalah entry point yang memanggil service BC-02/03/05/06/08; BC-04 sendiri hanya memegang grant, audit, rate limit)

BC-05 Engagement ──→ BC-02 Workspace (filter per ConnectedAccount)

BC-06 Analytics ──→ BC-02 Workspace (filter per ConnectedAccount)

BC-07 Start Page ──→ BC-02 Workspace (terikat ke workspace)

BC-08 Media ──→ BC-02 Workspace (semua media terikat ke workspace)

BC-09 Notification ──→ semua BC (dikonsumsi oleh BC lain untuk kirim notifikasi)
```

**Dependency yang dilarang (circular):**
- BC-02 tidak boleh memanggil BC-03, BC-04, BC-05, BC-06, BC-07, BC-08
- `McpAccessService` (BC-04) tidak boleh memanggil BC-03/05/06/08. Pemanggilan service domain dilakukan oleh handler tool MCP (entry point), bukan oleh `McpAccessService`.
- BC-08 tidak boleh memanggil BC-03

---

# Error Handling Strategy

## Hierarki Error

```
ApplicationError (base)
├── AuthorizationError      — user tidak punya permission
├── NotFoundError           — resource tidak ditemukan
├── ValidationError         — input tidak valid / domain rule dilanggar
├── ConflictError           — operasi konflik dengan state yang ada
└── ExternalServiceError    — error dari Outstand API atau layanan eksternal
```

## Alur Error

```
Application Service
  └── melempar domain error (AuthorizationError, ValidationError, dll.)
       └── ditangkap di Entry Point
            ├── Server Action → dikembalikan sebagai structured error response ke client
            ├── Route Handler → dikembalikan sebagai JSON error response dengan HTTP status sesuai
            └── Server Component → di-render sebagai error state halaman
```

**Mapping domain error ke HTTP status (Route Handlers):**

| Domain Error | HTTP Status |
|-------------|------------|
| `AuthorizationError` | 403 Forbidden |
| `NotFoundError` | 404 Not Found |
| `ValidationError` | 422 Unprocessable Entity |
| `ConflictError` | 409 Conflict |
| `ExternalServiceError` | 502 Bad Gateway |

**Catatan:** Error handling detail (error class implementation, logging, monitoring) ditentukan di Engineering Planning.

---

# Request Flow — Contoh Operasi

## Contoh 1: Jadwalkan Post (Happy Path)

```
User klik "Schedule" di UI
  │
  ├─ [Client Component] memanggil Server Action schedulePost(postId, scheduledAt)
  │
  ├─ [Server Action]
  │    ├─ Validasi format input (postId valid UUID, scheduledAt ISO date)
  │    └─ Panggil PublishingService.schedulePost(userId, postId, scheduledAt)
  │
  ├─ [PublishingService]
  │    ├─ Ambil Post via IPostRepository.findById(postId)
  │    ├─ Verifikasi userId adalah member workspace post ini (WorkspaceService.getMember)
  │    ├─ Verifikasi role member >= Creator (domain rule — semua role bisa, ADR-074)
  │    ├─ Jalankan domain rule: scheduledAt tidak boleh di masa lalu
  │    ├─ Jalankan domain rule: post harus memiliki minimal satu PublishingTarget
  │    ├─ Update Post.status = "scheduled", Post.scheduledAt = scheduledAt
  │    └─ Simpan via IPostRepository.save(post)
  │
  └─ [Server Action] Kembalikan { success: true } ke Client Component
```

## Contoh 2: Webhook Outstand — Post Published

```
Outstand API kirim POST /api/webhooks/outstand
  │
  ├─ [Route Handler]
  │    ├─ Baca raw body + validasi HMAC
  │    ├─ Panggil WebhookIngestionService.persistReceipt(rawBody, headers)
  │    └─ ACK 2xx setelah receipt durable + JOB-01 terjadwal
  │
  ├─ [JOB-01 / WebhookProcessor]
  │    ├─ Muat receipt idempoten
  │    ├─ ACL terjemahkan event vendor ke command domain
  │    └─ PublishingService.markPostPublished(...)
  │
  └─ [PublishingService]
       ├─ Cari Post via outstandPostId (amandemen ADR-092, rename dari outstandJobId — post-level, mencakup semua target)
       ├─ Panggil OutstandAdapter.fetchPostOutcome(outstandPostId) untuk resolve status per PostTarget
       ├─ Update status "published"
       └─ NotificationService.notify(..., { type: "post_published" })
```

## Contoh 3: Load Halaman Calendar

```
User navigasi ke /publish/calendar  ← Calendar; /publish sendiri redirect permanen ke sini (ADR-046 Amandemen Final, pengecualian permanen). Route group `(app)` tidak muncul di URL — hanya nama folder pembungkus di `src/app/`
  │
  ├─ [Middleware]
  │    ├─ Verifikasi session (Better Auth)
  │    └─ Resolve workspaceId dari cookie active-workspace-id (`auth-architecture.md`)
  │
  ├─ [Server Component CalendarPage]
  │    └─ Panggil PublishingService.getScheduledPosts(workspaceId, dateRange)
  │
  ├─ [PublishingService]
  │    └─ Panggil IPostRepository.findByWorkspace(workspaceId, { status: "scheduled", dateRange })
  │
  └─ [Server Component] Render kalender dengan data post
```

---

# Application Service Contracts

Berikut adalah kontrak tingkat tinggi (method signature arsitektural) per service. Detail parameter dan return type ditentukan di Engineering Planning.

## WorkspaceService

| Method | Trigger | Keterangan |
|--------|---------|-----------|
| `createWorkspace` | Server Action | Buat workspace baru, otomatis tambah Owner |
| `getWorkspace` | Server Component | Load data workspace + brand settings |
| `updateWorkspace` | Server Action | Update nama, `slug` (internal unique identifier, tidak dipakai di routing/URL — `domain-model.md`), atau brand settings |
| `switchWorkspace` | Server Action | Pindahkan workspace aktif user secara sengaja — validasi ulang bahwa user adalah member workspace tujuan, set cookie `active-workspace-id` ke workspace tujuan, redirect Home. Dipanggil dari Settings → Account → Workspaces (ADR-088) setelah user konfirmasi lewat dialog Tier 2 (ADR-089), berbeda dari alur recovery `/onboarding` saat cookie hilang (`auth-architecture.md`) |
| `inviteMember` | Server Action | Kirim undangan ke email |
| `acceptInvite` | Server Action | Terima undangan, aktivasi membership |
| `removeMember` | Server Action | Hapus member dari workspace — wajib dialog konfirmasi Tier 2 sebelum eksekusi (ADR-049) |
| `updateMemberRole` | Server Action | Ubah role member — wajib dialog konfirmasi Tier 2 sebelum eksekusi (ADR-049) |
| `getMember` | Internal (dipanggil service lain) | Ambil data member + role untuk auth check |
| `connectAccount` | Server Action | Hubungkan akun media sosial via Outstand |
| `disconnectAccount` | Server Action | Putus koneksi akun media sosial — wajib Disconnect Confirmation (KSP-08-F07, ADR-048) |
| `transferOwnership` | Server Action | Owner memicu transfer kepemilikan ke Admin lain — set `pendingOwnerTransferTo`, kirim notifikasi (`ownership_transfer_requested`); **tidak** langsung menukar role. RBAC: Owner saja, target harus Admin aktif. Wajib konfirmasi Tier 1 (ketik nama workspace, ADR-049) sebelum memicu (ADR-050) |
| `acceptOwnershipTransfer` | Server Action | Admin target menerima transfer — role Owner lama dan Admin target bertukar dalam satu transaksi, `pendingOwnerTransferTo` dikosongkan, notifikasi (`ownership_transfer_resolved`) ke Owner lama. RBAC: hanya user yang jadi target `pendingOwnerTransferTo` (ADR-050) |
| `deleteWorkspace` | Server Action | Hapus workspace beserta seluruh data terkait — cascade mengikuti `ON DELETE CASCADE` per `workspace_id` (`database-strategy.md`). RBAC: Owner saja. Wajib konfirmasi Tier 1 (ketik nama workspace, ADR-049) sebelum eksekusi (ADR-050) |

## PublishingService

| Method | Trigger | Keterangan |
|--------|---------|-----------|
| `createDraft` | Server Action | Buat draft post baru |
| `updateDraft` | Server Action | Edit konten draft (caption, media, targets, `contentFormat`, `platformOptions`) |
| `schedulePosts` | Server Action | Jadwalkan satu atau beberapa post — wajib validasi matriks `ContentFormat` per target (ADR-039) sebelum memanggil Outstand |
| `cancelSchedule` | Server Action | Batalkan jadwal, kembali ke draft — wajib dialog konfirmasi Tier 2 sebelum eksekusi, simetris dengan konfirmasi Schedule (ADR-049) |
| `publishNow` | Server Action | Publish langsung tanpa jadwal (KSP-05-F12, ADR-047) — RBAC sama dengan `schedulePosts` (semua role: Account Owner/Admin/Creator, sejak ADR-074); validasi matriks `ContentFormat` per target (ADR-039) tetap wajib sebelum memanggil Outstand |
| `deletePost` | Server Action | Soft delete post — wajib dialog konfirmasi Tier 2 sebelum eksekusi (ADR-049), meski soft delete di DB (DB-D03) |
| `getScheduledPosts` | Server Component | Load post untuk Calendar view |
| `getDraftPosts` | Server Component | Load post untuk Draft list |
| `applyTargetOutcomes` | JOB-01 internal | Setelah `post.published`/`post.error`, baca outcome Outstand per akun lalu update setiap `PostTarget` secara independen; notifikasi internal boleh `post_published`/`post_failed` |
| `listQueue` | Server Component | Load daftar Queue (KSP-03) — `Post`/`PostTarget` status `Scheduled`, grouped by tanggal, urutan murni ascending `scheduledAt`. Bukan entity `QueueSlot` terpisah, tidak ada reorder manual (amandemen ADR-083) |

## McpAccessService

Tool MCP (ADR-138) adalah entry point Route Handler `/api/mcp` yang memanggil service BC lain; tabel ini hanya memuat service milik BC-04.

| Method | Trigger | Keterangan |
|--------|---------|-----------|
| `createGrant` | Persetujuan OAuth (titik kait diputuskan di T-149.2) | Buat grant untuk satu workspace dan scope terpilih, atau perbarui `scopes` grant aktif yang sudah ada (satu grant aktif per pengguna, klien, workspace); RBAC: member aktif workspace |
| `revokeGrant` | Server Action (Settings) | Cabut koneksi klien AI; transaksi tunggal, lihat § Aturan otorisasi |
| `listGrants` | Server Component (Settings) | Daftar grant aktif milik pengguna yang sedang login (lintas workspace) |
| `authorizeCall` | Internal (Route Handler MCP) | Validasi grant, scope, dan member per panggilan, lalu rate limit (T-154); lihat § Aturan otorisasi |
| `recordAudit` | Internal (Route Handler MCP) | Tulis `McpAuditLog` satu baris per panggilan |
| `purgeAudit` | Cron (JOB-08) | Hapus audit yang lebih tua dari 90 hari |

### Aturan otorisasi dan pencabutan (T-149.1, ADR-139 poin 4)

Access token OAuth berupa JWT stateless: tetap diterima sampai kedaluwarsa (1 jam) walau consent dan refresh token sudah dihapus (terbukti di spike T-148). Karena itu token saja tidak pernah cukup. **`mcp_grants` adalah sumber otorisasi** (keputusan King Rezi 2026-10-26); baris `identity_oauth_consent` dan `identity_oauth_refresh_token` milik plugin hanya mekanik OAuth.

`authorizeCall` memeriksa setiap panggilan, dalam urutan ini, dan menolak (fail closed, dengan error yang jelas, bukan data kosong) pada kegagalan pertama:

1. Token valid (tanda tangan, `iss`, `aud`, kedaluwarsa); dikerjakan `mcpHandler`, sebelum service dipanggil.
2. Grant aktif ada untuk (`sub` token, `azp` token, `workspace_id` token) dengan `revoked_at` kosong. Tanpa grant: ditolak.
3. Scope yang dibutuhkan tool tercakup oleh scope token **dan** scope grant di DB. Scope di token tidak boleh melampaui grant; mencabut atau menyempitkan grant langsung berlaku tanpa menunggu token baru.
4. Pengguna masih member aktif workspace itu. Pada MVP tidak ada pembatasan scope berdasarkan role (Account Owner, Admin, Creator setara untuk read, draft, dan schedule; ADR-139 poin 4, S-001). Member yang dikeluarkan ditolak, grant-nya tidak dihapus otomatis.
5. Titik sambung rate limit (diisi T-154). `last_used_at` diperbarui hanya setelah panggilan lolos, paling cepat sekali per menit.

Panggilan yang ditolak tetap dicatat lewat `recordAudit` (`status = denied`).

`revokeGrant` menjalankan **satu transaksi**: menandai `mcp_grants.revoked_at` dan menghapus baris `identity_oauth_consent` serta `identity_oauth_refresh_token` milik (klien, pengguna, workspace) grant itu (`referenceId` plugin = `workspace_id`). Transaksi dijalankan oleh adapter di lapisan repository lewat port yang dipanggil service; domain tidak mengimpor Prisma. Tabel plugin tidak diubah bentuknya dan tidak diberi FK baru. Mencabut grant yang sudah dicabut tidak error (idempoten). Access token yang masih berlaku ditolak pada panggilan berikutnya oleh aturan 2, bukan oleh kedaluwarsa.

Pemetaan tool MCP ke service yang dibungkus (nama method sudah dicocokkan dengan barrel domain pada T-150.1; handler tool adalah entry point, jadi pemanggilan lintas-BC ini sah menurut peta dependency di atas):

| Scope | Tool | Service yang dipanggil (API publik barrel domain) |
|-------|------|---------------------------------------------------|
| `read` | `get_workspace` | `WorkspaceService.getWorkspaceById` (nama); scope dari `McpAuthorizedCall.grantScopes` |
| `read` | `list_accounts` | `WorkspaceService.listConnectedAccounts`; format konten per platform dari `getAllowedContentFormats` (barrel `publishing`, fungsi murni ADR-039) |
| `read` | `list_media` | `MediaService.listMediaItems` |
| `read` | `list_drafts` | `PublishingService.listDrafts` |
| `read` | `list_scheduled_posts` | `PublishingService.listQueue` (grup per tanggal diratakan) |
| `read` | `list_published_posts` | `PublishingService.listHistory` dengan `statuses = [Published, Imported]` |
| `read` | `get_analytics` (workspace) | `AnalyticsService.getDashboardSummary` |
| `read` | `get_analytics` (satu post) | `PublishingService.getHistoryById` (field `metrics` per akun; `authorName` tidak dipakai) |
| `read` | `list_comments` | `EngagementService.listInbox` |
| `draft` | `create_draft` | `PublishingService.createDraft` (nama method dicocokkan di T-152) |
| `draft` | `update_draft` | `PublishingService.updateDraft` |
| `draft` | `upload_media` | `MediaService.uploadMedia` (unduh dari URL dengan proteksi SSRF) |
| `schedule` | `schedule_posts` | `PublishingService.schedulePosts` (nama method dicocokkan di T-153) |

Semua service di atas menerima `workspaceId` dan `userId` dari grant yang lolos `authorizeCall` (bukan dari argumen tool), jadi isolasi workspace dan RLS per pengguna (KI-026) tetap berlaku seperti di UI. Tool tidak punya parameter `workspaceId`.

### Kontrak output tool baca (T-150.1)

Berlaku untuk delapan tool `read`. Handler hanya memetakan record service ke bentuk di bawah; tanpa business logic.

**Bungkus hasil.** Satu blok `text` berisi JSON. Penolakan dan kegagalan memakai `isError: true` dengan blok `text` berisi `{"error":{"code","message"}}`, tidak pernah daftar kosong. `code`: `no_active_grant`, `token_scope_insufficient`, `grant_scope_insufficient`, `not_workspace_member` (`McpDenialReason`), `invalid_input`, `invalid_cursor`, `not_found`, `internal_error` (pesan generik; detail hanya di log server).

**Waktu.** Semua tanggal dan jam berupa string ISO 8601 dengan offset WIB tetap, mis. `2026-10-28T14:30:00+07:00` (T-144/T-146; belum ada zona waktu per workspace). Tanggal tanpa nilai diberi `null`. Tool tidak menerima input waktu pada tool baca.

**ID.** String apa adanya dari domain. Tidak ada `outstand*` id, `storagePath`, URL bertanda tangan, atau `slug` di output.

**Daftar berhalaman.** `list_media`, `list_drafts`, `list_scheduled_posts`, `list_published_posts`, `list_comments` mengembalikan `{ "items": [...], "nextCursor": string | null }`, 20 item per halaman (tetap, tanpa parameter `limit`), dan menerima `cursor` opsional. Cursor opaque (base64url `{v, offset, filter}`); cursor rusak, atau dibuat untuk filter lain, ditolak `invalid_cursor`. **Batas yang diketahui:** service BC lain belum punya paginasi (repository mengembalikan daftar penuh), jadi handler memotong daftar di memori. Urutan mengikuti service: media terbaru dulu, drafts diedit terbaru dulu, jadwal naik menurut `scheduledAt`, terbit turun menurut waktu terbit, komentar terbaru dulu. Halaman bisa bergeser bila data berubah di antara dua panggilan. Paginasi di repository BC lain adalah tiket terpisah bila volume menuntutnya. `list_accounts` dan `get_workspace` tidak berhalaman.

| Tool | Argumen | Bentuk hasil |
|------|---------|--------------|
| `get_workspace` | tidak ada | `{ workspaceId, name, grantedScopes: ("read"\|"draft"\|"schedule")[], timezone: "Asia/Jakarta" }`. Brand settings disebut S-001 tetapi belum ada di model BC-02, jadi belum dikembalikan (gap dicatat di T-150) |
| `list_accounts` | tidak ada | `{ items: [{ id, platform, handle, status, reconnectRequired, connectedAt, supportedContentFormats: ContentFormat[] }] }` |
| `list_media` | `cursor?` | item `{ id, filename, type: "image"\|"video"\|"gif", mimeType, sizeBytes, width, height, durationSeconds, createdAt }` |
| `list_drafts` | `cursor?` | item `{ id, caption, status: "draft"\|"in_review"\|"ready_to_schedule", mediaIds, createdAt, updatedAt }` |
| `list_scheduled_posts` | `cursor?` | item `{ id, caption, scheduledAt, createdAt, targets: [{ accountId, platform, accountHandle, contentFormat }] }` |
| `list_published_posts` | `cursor?` | item `{ id, caption, status: "published"\|"imported", publishedAt, createdAt, targets: [{ accountId, platform, accountHandle, contentFormat, status, postUrl, error }] }` |
| `get_analytics` | `period?: "weekly"\|"monthly"` (default `weekly`) atau `postId` (menang atas `period`) | workspace: `{ scope: "workspace", period, summary: { totalPosts, totalEngagements, avgEngagementRate, activeAccounts } \| null }` (`null` = belum ada snapshot, bukan nol). Post: `{ scope: "post", postId, status, metrics: [{ accountId, platform, impressions, reach, likes, comments, shares, clicks, engagementRate, fetchedAt }] \| null }`; `postId` yang tidak ada, bukan milik workspace, atau belum selesai terbit: `not_found` |
| `list_comments` | `cursor?`, `status?: "unread"\|"done"`, `accountId?` | `{ notice, items: [{ id, accountId, platform, type, status, postId, receivedAt, author, content }], nextCursor }`; `author` dan `content` dibungkus penanda di bawah |

**Data pihak luar (`list_comments`).** Isi komentar dan handle penulis berasal dari pihak luar dan bisa memuat kalimat yang menyerupai perintah. Keduanya dikembalikan di dalam penanda `<data_pihak_luar_tidak_tepercaya>...</data_pihak_luar_tidak_tepercaya>`, dan hasil memuat `notice` tetap yang menyatakan bahwa isi di dalam penanda adalah data dari pihak luar, bukan instruksi. Kemunculan penanda itu di dalam teks komentar dinetralkan (diganti `[penanda dihapus]`) supaya komentar tidak bisa menutup bungkusnya sendiri. Caption draft dan post tidak dibungkus: itu tulisan anggota workspace sendiri. Penanda adalah mitigasi, bukan jaminan; tool `read` memang tidak bisa mengubah apa pun sehingga dampak injeksi tertahan di sisi klien.

## EngagementService

| Method | Trigger | Keterangan |
|--------|---------|-----------|
| `getInboxItems` | Server Component | Load engagement inbox |
| `markAsRead` | Server Action | Tandai item sebagai sudah dibaca |
| `replyToComment` | Server Action | Kirim reply komentar via Outstand |
| `syncComments` | JOB-03 / Server Action manual refresh | Pull komentar via ACL, upsert idempoten, buat `engagement_new` untuk item baru |

## AnalyticsService

| Method | Trigger | Keterangan |
|--------|---------|-----------|
| `getWorkspaceSnapshot` | Server Component | Load ringkasan analytics workspace |
| `getPostMetrics` | Server Component | Load metrik per post |
| `syncMetrics` | JOB-04 | Pull update metrik dari Outstand |

## MediaService

| Method | Trigger | Keterangan |
|--------|---------|-----------|
| `uploadMedia` | Server Action | Upload file ke Supabase Storage + simpan metadata |
| `createOutstandWorkingCopy` | Internal Publishing flow | Request upload URL → PUT → confirm; kembalikan URL Outstand untuk publish |
| `getMediaLibrary` | Server Component | Load daftar media workspace |
| `deleteMedia` | Server Action | Hapus file dan metadata — wajib dialog konfirmasi Tier 2 sebelum eksekusi (ADR-049); hard delete, tidak ada `deleted_at` |

## NotificationService

| Method | Trigger | Keterangan |
|--------|---------|-----------|
| `notify` | Internal (dipanggil service lain) | Buat notifikasi baru |
| `getNotifications` | Server Component | Load notifikasi user dalam workspace |
| `markAllRead` | Server Action | Tandai semua notifikasi sebagai dibaca |

## StartPageService

| Method | Trigger | Keterangan |
|--------|---------|-----------|
| `getStartPage` | Server Component | Load start page workspace |
| `updateStartPage` | Server Action | Update konten dan pengaturan start page |
| `addLink` | Server Action | Tambah link ke start page |
| `removeLink` | Server Action | Hapus link dari start page |
| `reorderLinks` | Server Action | Ubah urutan link |

---

# Catatan MVP

Untuk MVP, tidak semua service method di atas diimplementasikan. Prioritas implementasi mengacu pada `product-discovery/02-product/mvp-definition.md`. Application Layer ini mendefinisikan kontrak lengkap sistem — Engineering Planning akan menetapkan subset yang masuk MVP.

---

# Decision Log

| ID | Keputusan | Alasan | Alternatif |
|----|-----------|--------|-----------|
| AL-D01 | Server Actions untuk UI mutations, Route Handlers untuk external/webhook | Separation of concern yang jelas; Server Actions optimal untuk form-based UI, Route Handlers optimal untuk integrasi eksternal | Route Handlers saja (kehilangan progressive enhancement); Server Actions saja (tidak bisa handle webhook) |
| AL-D02 | Repository Pattern eksplisit — interface di domain, implementasi via Prisma Client (ADR-031) | Selaras dengan DDD; type-safe persistence; test domain logic tanpa database; batas dependency jelas | Akses Prisma/Supabase langsung di service (coupling tinggi, sulit di-test); Supabase client untuk CRUD (digantikan ADR-031) |
| AL-D03 | Service-to-service call via public API modul (`index.ts`) | Sederhana untuk MVP solo developer; tidak memerlukan event bus; dependency explicit dan mudah ditelusuri | Domain Events (lebih decoupled tapi kompleksitas tinggi untuk MVP); Shared Read Model (query langsung ke DB lintas context — melanggar boundary) |
| AL-D04 | 4-layer stack: Entry Points → Application Service → Domain Logic → Repository | Selaras Modular Monolith + DDD; setiap layer punya tanggung jawab yang jelas; testable per layer | 2-layer (Entry Point + DB) — terlalu flat, tidak scalable; full CQRS — terlalu kompleks untuk MVP |
| AL-D05 | Webhook Route Handler hanya verify raw HMAC → durable receipt → enqueue → ACK | Menjamin event tidak hilang dan menjaga entry point tetap tipis |
| AL-D06 | Engagement sync melalui JOB-03/manual refresh; bukan Route Handler webhook | Kontrak resmi Outstand tidak menyediakan webhook Engagement MVP |
| AL-D07 | ADR-040 | AL-D05–D06 mengamandemen contoh dan kontrak service lama |
| AL-D08 | Route Handler `/api/v1` sebagai API mobile-ready di atas Application Service yang sama dengan web; tidak ada BE terpisah | Server Actions tidak stabil lintas build untuk client eksternal; Application Service sudah framework-agnostic (AL-D02) sehingga entry point mobile murah ditambahkan (ADR-043) | Backend terpisah (Hono/Express) — duplikasi business logic; mobile memanggil Server Actions langsung — tidak stabil/tidak didukung |

---

# Related Documents

* `domain-model.md` — bounded context dan entitas yang dikonsumsi Application Layer ini
* `database-strategy.md` — tabel database yang diakses repository
* `integration-layer.md` — Outstand API yang dipanggil dari Route Handlers dan Application Services
* `background-jobs.md` — background jobs yang juga mengakses Application Services
* `realtime-strategy.md` — notifikasi yang dipicu via NotificationService
* `auth-architecture.md` — Better Auth dan otorisasi granular dalam Application Service
* `../02-product/mvp-definition.md` — scope MVP yang menentukan method mana yang diimplementasikan
* `../02-product/roles-permissions.md` — role dan permission yang menjadi constraint authorization
* `../../project-os/DECISIONS.md` — ADR-001 s/d ADR-015, AL-D01 s/d AL-D04, ADR-043 (AL-D08)
* `../06-engineering/auth-strategy.md` — Better Auth Bearer plugin, konfigurasi auth mobile (AS-D06)
