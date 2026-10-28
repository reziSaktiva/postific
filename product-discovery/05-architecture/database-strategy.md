# Database Strategy

Dokumen ini mendefinisikan strategi database untuk produk **Postific** — mencakup platform, multi-tenancy, organisasi schema, naming convention, skema tabel per bounded context, Row-Level Security, dan storage.

Seluruh keputusan pada dokumen ini mengacu pada **Domain Model & Bounded Context** (`domain-model.md`) sebagai fondasi entitas dan relasi, serta **System Architecture README** (`README.md`) sebagai acuan keputusan pra-architecture.

---

# Tujuan

* Menetapkan strategi multi-tenancy dan isolasi data antar workspace.
* Mendefinisikan organisasi schema dan naming convention yang konsisten.
* Mendokumentasikan skema tabel untuk setiap bounded context.
* Menetapkan pola Row-Level Security (RLS) yang sesuai dengan Better Auth.
* Mendefinisikan strategi storage untuk media file.
* Menghasilkan input yang cukup untuk Engineering Planning (M6) — detail implementasi SQL didefinisikan di fase Engineering Planning.

---

# Keputusan Pra-Architecture

Keputusan berikut sudah ditetapkan sebelum dokumen ini dibuat dan menjadi fondasi strategi database:

| Topik | Keputusan | Sumber |
|-------|-----------|--------|
| Database Platform | Supabase PostgreSQL Cloud | README.md |
| Multi-tenancy | Row-Level Security dengan `workspace_id` | README.md |
| Storage | Supabase Storage | README.md |
| Auth Library | Better Auth | README.md |

---

# Keputusan Database Strategy

Keputusan baru yang ditetapkan pada dokumen ini:

| ID | Topik | Keputusan |
|----|-------|-----------|
| DB-D01 | Schema Organization | Single schema `public`, tabel dikelompokkan dengan domain prefix. **Exception:** tabel utama (aggregate root) suatu domain boleh menggunakan nama pendek tanpa prefix jika nama entity-nya identik dengan nama domain (contoh: `workspaces`, `notifications`) |
| DB-D02 | ID Generation | UUID v4 menggunakan `gen_random_uuid()` — native PostgreSQL/Supabase |
| DB-D03 | Soft Delete | Hard delete by default; `deleted_at` hanya pada `publishing_posts` |
| DB-D04 | Identity Tables | BC-01 Identity dikelola sepenuhnya oleh Better Auth dengan prefix `identity_` |
| DB-D05 | RLS Approach | Application-enforced authorization sebagai lapisan utama; RLS sebagai safety net (defense-in-depth) |
| DB-D06 | Timestamps | Semua tabel menggunakan `created_at` dan `updated_at` dengan `DEFAULT now()` |

---

# Multi-Tenancy Strategy

## Unit Isolasi: `workspace_id`

Seluruh data yang bersifat workspace-scoped menggunakan `workspace_id` sebagai unit isolasi. Setiap tabel yang menyimpan data domain (kecuali BC-01 Identity dan sebagian BC-10 Billing) memiliki kolom `workspace_id uuid NOT NULL`.

```
Workspace A ──── workspace_id: abc-123 ────► publishing_posts WHERE workspace_id = 'abc-123'
Workspace B ──── workspace_id: def-456 ────► publishing_posts WHERE workspace_id = 'def-456'
```

## RLS dan Better Auth

Better Auth **tidak menggunakan Supabase Auth** sebagai session provider. Akibatnya, fungsi `auth.uid()` bawaan Supabase **tidak tersedia** untuk RLS policies.

**Pendekatan yang diambil (DB-D05):**

Semua akses database dilakukan melalui server-side code (Next.js Server Components, Server Actions, Route Handlers) menggunakan **Supabase service role key**. Authorization utama ditegakkan di application layer sebelum setiap operasi database.

RLS difungsikan sebagai **defense-in-depth safety net** — lapisan keamanan kedua untuk mencegah data leak jika ada bug di application layer. Pola RLS menggunakan session variable `app.current_user_id` yang diset oleh server sebelum query.

```
Request → Next.js Server Layer
              ↓
          Better Auth verifikasi sesi → dapatkan user_id
              ↓
          Application Layer cek workspace membership
              ↓
          SET LOCAL app.current_user_id = '{user_id}';
              ↓
          Query Supabase (service role) → RLS memeriksa session variable
```

**Alasan pendekatan ini:**
* Better Auth tidak terintegrasi dengan Supabase JWT secara native.
* Seluruh akses DB sudah melalui server-side code — tidak ada client-side DB access.
* Lebih sederhana dan predictable dibanding custom JWT claim setup untuk MVP.
* Dapat ditingkatkan ke custom JWT + Supabase Auth di masa depan jika diperlukan.

**Catatan dua konteks RLS:**
* **Server-side queries** (service role key): RLS menggunakan `current_setting('app.current_user_id', true)::uuid` karena `auth.uid()` tidak tersedia dengan service role.
* **Supabase Realtime subscriptions** (client anon key): RLS menggunakan `auth.uid()`, yang memerlukan integrasi Better Auth + Supabase JWT agar `auth.uid()` mengembalikan userId yang benar. Detail konfigurasi ini didefinisikan di `auth-architecture.md` dan diimplementasikan di Engineering Planning (M6).

## RLS Policy Pattern

Tabel yang memiliki `workspace_id` menggunakan pola berikut sebagai template:

```sql
-- Enable RLS
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

-- Hanya user yang merupakan member workspace dapat mengakses
CREATE POLICY "{table_name}_workspace_isolation"
  ON {table_name}
  FOR ALL
  USING (
    workspace_id IN (
      SELECT wm.workspace_id
      FROM workspace_members wm
      WHERE wm.user_id = current_setting('app.current_user_id', true)
        AND wm.status = 'active'
    )
  );
```

> **Koreksi (2026-08-13, T-017):** Contoh di atas semula meng-cast
> `current_setting('app.current_user_id', true)::uuid`. Ini salah untuk
> schema aktual — `identity_user.id` (Better Auth) adalah `cuid()` string
> (`text`), bukan UUID, dan seluruh kolom `user_id` di tabel domain
> (`workspace_members.user_id`, dst.) juga bertipe `text`, bukan
> `uuid`. Cast `::uuid` pada nilai `app.current_user_id` akan gagal runtime
> (`invalid input syntax for type uuid`) begitu diisi cuid asli. `workspace_id`
> sendiri tetap `uuid` di semua tabel — cast `::uuid` hanya dihapus untuk sisi
> `user_id`/`app.current_user_id`, bukan untuk `workspace_id`. Ini murni
> koreksi tipe pada SQL, bukan perubahan pola/keputusan RLS. Lihat juga
> `database-orm.md` § DO-D06 untuk catatan yang sama, dan
> `apps/web/src/lib/prisma/with-current-user.ts` untuk implementasi wrapper
> yang men-set variable ini (`set_config`, bukan literal `SET LOCAL`, untuk
> menghindari SQL injection lewat tagged-template Prisma).

Detail SQL RLS per tabel didefinisikan di Engineering Planning (M6), dan
sudah diimplementasikan sebagai migration Prisma (T-017) —
`apps/web/prisma/migrations/20260813045625_t017_add_rls_policies/migration.sql`.

> **Catatan (2026-09-11, T-092.1) — instance berikutnya dari preseden
> DO-D06/T-017 (cuid vs uuid):** varian RLS Policy Pattern untuk koneksi
> Supabase Realtime (anon key, ADR-094 poin 3) juga tidak bisa memakai
> fungsi `auth.uid()` Supabase apa adanya, karena fungsi itu melakukan cast
> paksa `::uuid` terhadap klaim `sub` JWT — sementara kolom `user_id`
> bertipe cuid string di seluruh sistem (sama akar masalah dengan koreksi
> `app.current_user_id` di atas). Policy
> `publishing_posts_realtime_workspace_members`
> (`20260911090000_t092_1_publishing_posts_realtime_rls`) memakai
> `current_setting('request.jwt.claim.sub', true)` (fallback parse
> `request.jwt.claims`) untuk membaca `sub` sebagai `text`, alih-alih
> memanggil `auth.uid()` langsung. Detail lengkap: ADR-094 poin 3 (catatan
> implementasi 2026-09-11).

> **Catatan status runtime (2026-08-13, T-017 — lihat KI terkait di
> `PROJECT_STATE.md`):** Policy di atas sudah applied ke database, tapi
> koneksi `DATABASE_URL`/`DIRECT_URL` saat ini memakai role Postgres
> `postgres`, yang di Supabase punya atribut `BYPASSRLS` secara default.
> Akibatnya RLS **tidak aktif secara efektif** untuk query lewat koneksi
> ini — "defense-in-depth" yang dijelaskan di atas belum berfungsi di
> runtime nyata sampai koneksi aplikasi dipindah ke role tanpa `BYPASSRLS`
> (task follow-up terpisah, butuh akses dashboard Supabase). Authorization
> utama tetap 100% bergantung pada Application Service (RBAC), sesuai
> DB-D05.

---

# Schema Organization

## Keputusan: Single Schema `public` dengan Domain Prefix (DB-D01)

Semua tabel berada di satu schema `public`. Domain dipisahkan menggunakan **prefix pada nama tabel**:

| Domain Prefix | Bounded Context |
|--------------|----------------|
| `identity_` | BC-01 Identity (managed by Better Auth) |
| `workspace_` | BC-02 Workspace |
| `publishing_` | BC-03 Publishing |
| `mcp_` | BC-04 MCP Access |
| `engagement_` | BC-05 Engagement |
| `analytics_` | BC-06 Analytics |
| `start_page_` | BC-07 Start Page |
| `media_` | BC-08 Media |
| `notification_` | BC-09 Notification |
| `billing_` | BC-10 Billing |

**Naming convention tabel:** `{domain_prefix}_{entity_plural}` dalam `snake_case`.

Contoh: `publishing_posts`, `workspace_members`, `engagement_inbox_items`.

**Exception — tabel utama tanpa redundansi prefix:** Jika nama entity plural identik dengan nama domain (sehingga menghasilkan nama seperti `workspace_workspaces` atau `notification_notifications`), tabel utama tersebut menggunakan nama pendek tanpa prefix: `workspaces` dan `notifications`. Tabel turunan dalam domain tersebut tetap menggunakan prefix (`workspace_members`, `workspace_connected_accounts`, dst.).

---

# ID Convention (DB-D02)

Seluruh primary key menggunakan **UUID v4** yang di-generate oleh PostgreSQL:

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
```

Ini berlaku untuk semua tabel kecuali tabel yang dikelola Better Auth (Better Auth menggunakan UUID juga, dikonfigurasi di Better Auth setup).

Mapping ke TypeScript branded ID types di `packages/shared` dilakukan di application layer.

---

# Skema Tabel per Bounded Context

---

## BC-01 — Identity (Better Auth Managed)

Tabel BC-01 Identity dikelola sepenuhnya oleh **Better Auth**. Better Auth dikonfigurasi untuk menggunakan prefix `identity_` agar konsisten dengan naming convention project.

| Tabel | Dikelola Oleh | Keterangan |
|-------|--------------|------------|
| `identity_user` | Better Auth | Data pengguna terdaftar |
| `identity_session` | Better Auth | Sesi aktif pengguna |
| `identity_account` | Better Auth | OAuth accounts yang terhubung ke user |
| `identity_verification` | Better Auth | Token verifikasi email / reset password |

**Catatan:** Skema kolom tabel ini mengikuti Better Auth schema spec. Project tidak membuat atau memodifikasi tabel ini secara manual — Better Auth mengelola migrasi tabel Identity.

`identity_user.id` adalah referensi global (`UserId`) yang dikonsumsi seluruh bounded context lain.

---

## BC-02 — Workspace

### `workspaces`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Workspace ID |
| `name` | `text NOT NULL` | Nama workspace |
| `slug` | `text NOT NULL UNIQUE` | Internal unique identifier, tidak dipakai di routing/URL (`domain-model.md`) |
| `owner_id` | `uuid NOT NULL` | Referensi ke `identity_user.id` |
| `pending_owner_transfer_to` | `uuid` | Referensi ke `identity_user.id`; diisi saat `transferOwnership` dipicu, dikosongkan setelah `acceptOwnershipTransfer` atau dibatalkan (ADR-050) |
| `plan` | `text NOT NULL DEFAULT 'free'` | `free \| pro` |
| `brand_name` | `text` | BrandSettings: nama brand |
| `brand_tone` | `text` | BrandSettings: panduan tone of voice |
| `brand_guidelines` | `text` | BrandSettings: catatan brand guidelines |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

> `BrandSettings` (Value Object) di-embed langsung ke `workspaces` sebagai kolom terpisah — tidak dibuat tabel terpisah untuk MVP.

### `workspace_members`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Member ID |
| `workspace_id` | `uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE` | |
| `user_id` | `uuid NOT NULL` | Referensi ke `identity_user.id` |
| `role` | `text NOT NULL` | `owner \| admin \| creator` (ADR-074 — sebelumnya termasuk `manager`) |
| `status` | `text NOT NULL DEFAULT 'pending'` | `pending \| active \| removed` |
| `invited_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `joined_at` | `timestamptz` | Null sampai member menerima undangan |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Constraint:** `UNIQUE(workspace_id, user_id)` — satu user hanya bisa menjadi member satu workspace dengan satu role.

### `workspace_connected_accounts`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Connected Account ID |
| `workspace_id` | `uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE` | |
| `platform` | `text NOT NULL` | `instagram \| facebook \| twitter \| linkedin \| tiktok \| youtube \| threads \| pinterest` |
| `outstand_account_id` | `text NOT NULL` | ID dari Outstand API (external reference) |
| `handle` | `text NOT NULL` | Nama akun (@handle atau nama page) |
| `status` | `text NOT NULL DEFAULT 'active'` | `active \| disconnected \| error` |
| `reconnect_required` | `boolean NOT NULL DEFAULT false` | `true` setelah `account.token_expired`; kembali `false` setelah reconnect |
| `connected_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Constraint:** `UNIQUE(workspace_id, outstand_account_id)` — satu akun Outstand hanya dapat terkoneksi satu kali per workspace.

---

## BC-03 — Publishing

### `publishing_posts`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Post ID |
| `workspace_id` | `uuid NOT NULL REFERENCES workspaces(id)` | |
| `author_id` | `uuid NOT NULL` | Referensi ke `identity_user.id` |
| `status` | `text NOT NULL DEFAULT 'draft'` | `draft \| in_review \| ready_to_schedule \| scheduled \| published \| failed` |
| `caption` | `text NOT NULL DEFAULT ''` | Teks caption post |
| `media_ids` | `uuid[] NOT NULL DEFAULT '{}'` | Array referensi ke `media_items.id` |
| `scheduled_at` | `timestamptz` | Waktu tayang yang diinginkan; null jika belum dijadwalkan |
| `published_at` | `timestamptz` | Waktu berhasil dipublikasikan |
| `failed_at` | `timestamptz` | |
| `failure_reason` | `text` | |
| `outstand_post_id` | `text` | **(amandemen ADR-092)** SATU ID post dari Outstand API, mencakup seluruh `PostTarget` pada post ini sekaligus (1 call `schedulePost`/`publishNow` untuk semua target). Diisi post-level, bukan per `PostTarget` — lihat `domain-model.md` |
| `deleted_at` | `timestamptz` | Soft delete — post dihapus tidak benar-benar di-remove (DB-D03) |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Catatan Soft Delete:** `publishing_posts` adalah satu-satunya tabel yang menggunakan soft delete. Posts yang di-delete hanya men-set `deleted_at`. Seluruh query harus menyertakan filter `deleted_at IS NULL` kecuali untuk query audit/recovery.

### `publishing_post_targets`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Post Target ID |
| `post_id` | `uuid NOT NULL REFERENCES publishing_posts(id) ON DELETE CASCADE` | |
| `connected_account_id` | `uuid NOT NULL REFERENCES workspace_connected_accounts(id)` | |
| `platform` | `text NOT NULL` | Snapshot platform saat target dibuat |
| `content_format` | `text NOT NULL DEFAULT 'post'` | `post \| reel \| story \| pin` (ADR-039). Default DB = fallback teknis; **Application Service wajib set nilai bisnis** (Pinterest → `pin`) dan memvalidasi matriks platform |
| `platform_options` | `jsonb` | Field khusus platform (mis. Pinterest title/link/board); null jika tidak dipakai |
| `platform_post_id` | `text` | **(amandemen ADR-092, rename dari `outstand_job_id`)** ID post di platform ASLI (mis. Instagram) per akun — beda dari `publishing_posts.outstand_post_id` post-level. Diisi async lewat `fetchPostOutcome`/webhook, bukan sinkron dari `schedulePost`/`publishNow` |
| `status` | `text NOT NULL DEFAULT 'pending'` | `pending \| scheduled \| published \| failed` |
| `platform_post_url` | `text` | **(amandemen ADR-092, rename dari `published_url`)** URL post yang sudah dipublikasikan per akun, diisi async bersamaan dengan `platform_post_id` |
| `error` | `text` | Pesan error dari Outstand API jika publish gagal |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

### ~~`publishing_queue_slots`~~ — deprecated (ADR-083, 2026-08-19)

Tabel fisik masih ada di DB, tapi entity `QueueSlot` sudah dihapus dari
`domain-model.md` — Queue sekarang computed view atas `Post`/`PostTarget`.
Dijadwalkan dihapus lewat migration saat T-032.5 dikerjakan. Skema di bawah
dipertahankan sebagai referensi historis, bukan aktif dipakai.

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Queue Slot ID |
| `workspace_id` | `uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE` | |
| `connected_account_id` | `uuid NOT NULL REFERENCES workspace_connected_accounts(id)` | |
| `scheduled_at` | `timestamptz NOT NULL` | Waktu slot dalam queue |
| `post_id` | `uuid REFERENCES publishing_posts(id) ON DELETE SET NULL` | Null jika slot kosong |
| `order` | `integer NOT NULL` | Urutan dalam queue untuk akun yang sama |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Constraint:** `UNIQUE(connected_account_id, scheduled_at)` — satu slot waktu per akun.

---

## BC-04 — MCP Access

Kolom final (ADR-138, ADR-139 Accepted 2026-10-26; keputusan model grant King Rezi 2026-10-26, T-149.1). Tipe diperiksa terhadap `apps/web/prisma/schema.prisma`: `workspaces.id` bertipe `uuid` (`@db.Uuid`), sedangkan `identity_user.id` adalah `cuid()` (`text`), jadi `user_id` di sini `text`, sama seperti `workspace_members.user_id` (preseden koreksi T-017, lihat § RLS Policy Pattern).

### `mcp_grants`

Sumber otorisasi panggilan MCP. Satu baris per persetujuan: pengguna + klien + workspace + scope. Aturan pemakaiannya (per panggilan, pencabutan, hubungan dengan tabel plugin OAuth) ada di `application-layer.md` § McpAccessService.

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Grant ID |
| `workspace_id` | `uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE` | Satu workspace per koneksi. Nilainya sama dengan `referenceId` consent plugin (di tabel plugin bertipe `text`) |
| `user_id` | `text NOT NULL` | `identity_user.id` (cuid). Tanpa FK, seperti `workspace_members.user_id`. Keanggotaan pengguna ini di workspace yang berlaku |
| `client_id` | `text NOT NULL` | `clientId` klien AI hasil dynamic client registration (`identity_oauth_client."clientId"`). Tanpa FK: tabel plugin tidak diubah bentuknya |
| `client_name` | `text` | Salinan nama klien saat persetujuan, supaya layar daftar klien AI (T-156) tidak membaca tabel plugin. Nullable karena nama klien opsional pada pendaftaran |
| `scopes` | `text[]` | Nama logis `read \| draft \| schedule` (MVP). Nama di kabel (`mcp:read` dan seterusnya) dipetakan di adapter, bukan disimpan di sini. Maksudnya NOT NULL, tetapi Prisma tidak mendukung NOT NULL pada list: migrasi membuat kolom tanpa NOT NULL dan repository yang menegakkannya |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `last_used_at` | `timestamptz` | Panggilan terakhir yang lolos otorisasi; diperbarui paling cepat sekali per menit |
| `revoked_at` | `timestamptz` | Terisi saat dicabut. Baris yang dicabut tetap disimpan sebagai riwayat |

**Indeks:**
- Unik parsial `(user_id, client_id, workspace_id) WHERE revoked_at IS NULL`: paling banyak satu grant aktif per pengguna, klien, dan workspace. Persetujuan ulang saat grant aktif sudah ada memperbarui `scopes` grant itu, bukan menambah baris. Setelah dicabut, menyambungkan lagi membuat baris baru. Indeks ini juga melayani `listGrants` (awalan `user_id`).
- `(workspace_id)` (Index Wajib).

### `mcp_audit_logs`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Audit ID |
| `workspace_id` | `uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE` | |
| `user_id` | `text NOT NULL` | `identity_user.id` (cuid), tanpa FK |
| `grant_id` | `uuid REFERENCES mcp_grants(id) ON DELETE SET NULL` | Kosong bila panggilan ditolak karena tidak ada grant |
| `client_id` | `text NOT NULL` | |
| `tool_name` | `text NOT NULL` | |
| `scope` | `text NOT NULL` | Nama logis scope tool |
| `input_summary` | `text` | Ringkasan yang disamarkan |
| `status` | `text NOT NULL` | `success \| denied \| error` |
| `error_code` | `text` | |
| `duration_ms` | `integer` | |
| `target_id` | `text` | ID hasil aksi, misalnya post |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Retensi 90 hari (dihapus cron JOB-08) |

**Indeks:**
- `(workspace_id, created_at)` untuk query audit per workspace; awalan `workspace_id` sudah memenuhi Index Wajib, jadi tidak perlu indeks `(workspace_id)` terpisah.
- `(created_at)` untuk purge global JOB-08 (menghapus per `created_at` lintas workspace, yang tidak dilayani indeks di atas). Ditambahkan di T-149.3 atas persetujuan King Rezi.

Penanda sumber MCP di BC-03: `publishing_posts` mendapat kolom `created_via` (`app | mcp`) dan `created_via_client_id` (nullable), diputuskan final di T-152. Penghitung rate limit per workspace juga berbasis Postgres (ADR-138 poin 7), bentuk tabelnya diputuskan di T-154.

### Kebijakan RLS BC-04 (final, ADR-141)

Diputuskan King Rezi 2026-10-26 dan dicatat di ADR-141 (pengecualian DB-D05). Pola isolasi per-workspace di § RLS Policy Pattern (DB-D05) bergantung pada `app.current_user_id` yang di-set `withCurrentUser` dari sesi Better Auth. Jalur BC-04 tidak punya konteks itu: panggilan tool diautentikasi lewat JWT bearer (bukan sesi), pembuatan grant berjalan di dalam alur consent plugin OAuth, dan purge audit (JOB-08) berjalan tanpa pengguna. Maka kebijakannya:

- `ENABLE ROW LEVEL SECURITY` pada `mcp_grants` dan `mcp_audit_logs`.
- Satu policy per tabel `FOR ALL TO "app_runtime" USING (true) WITH CHECK (true)`, dijaga `IF EXISTS` pada `pg_roles` (shadow DB tidak punya role itu), dengan bentuk sama seperti migrasi `20261026130000_t148_oauth_tables_app_runtime_policy`.
- `anon` dan `authenticated` tidak punya policy, jadi tertolak (default-deny). Tabel ini tidak boleh terbaca lewat PostgREST atau Realtime anon key.
- Role `app_runtime` **tidak** melewati RLS: tabel dengan RLS aktif tanpa policy untuk role itu menolak semua tulis (kesalahan `42501`). Karena itu policy `app_runtime` wajib ada di migrasi yang sama dengan `ENABLE ROW LEVEL SECURITY`.

**Konsekuensi (penyimpangan dari DB-D05):** policy ini tidak memisahkan workspace atau pengguna di level database; isolasi antar workspace dan antar pengguna sepenuhnya ditegakkan application layer (setiap query repository (`IMcpGrantRepository`, `IMcpAuditRepository`, dan adapter `IMcpGrantRevocationPort`) wajib memfilter `workspace_id` dan/atau `user_id`, dan `listGrants` hanya mengembalikan milik pengguna yang sedang login). Safety net DB-D05 tidak berlaku untuk dua tabel ini; RLS hanya menutup akses dari role selain `app_runtime`. Hal serupa sudah berlaku untuk tabel plugin OAuth (T-148) dan tabel infrastruktur server-only (`background_jobs`, `outstand_webhook_events`; lihat § System Tables, tanpa RLS sama sekali).

**Alternatif yang ditolak (ADR-141):** policy per-pengguna (`user_id = current_setting('app.current_user_id', true)`) untuk jalur baca, daftar, dan cabut dengan `withCurrentUser(sub)` dari klaim token, ditambah fungsi `SECURITY DEFINER` untuk purge dan hook consent (pola ADR-099). Mempertahankan safety net, tetapi setiap pemanggil harus men-set variabel itu dan purge butuh jalur sistem tersendiri; safety net per-pengguna tidak sebanding untuk tabel yang hanya dibaca lewat service.

---

## BC-05 — Engagement

### `engagement_inbox_items`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Inbox Item ID |
| `workspace_id` | `uuid NOT NULL REFERENCES workspaces(id)` | |
| `connected_account_id` | `uuid NOT NULL REFERENCES workspace_connected_accounts(id)` | |
| `platform` | `text NOT NULL` | Platform asal interaksi |
| `type` | `text NOT NULL DEFAULT 'comment'` | MVP hanya `comment` |
| `external_id` | `text NOT NULL` | ID komentar dari Outstand Comments API |
| `author_handle` | `text NOT NULL` | Username pengirim |
| `content` | `text NOT NULL` | Isi interaksi |
| `status` | `text NOT NULL DEFAULT 'unread'` | `unread \| read \| replied \| archived` |
| `post_id` | `uuid` | Soft ref ke `publishing_posts.id` — tidak enforce FK |
| `received_at` | `timestamptz NOT NULL` | Waktu item diterima di platform |
| `read_at` | `timestamptz` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Constraint:** `UNIQUE(workspace_id, connected_account_id, external_id)` — menjaga upsert periodic/manual sync tetap idempoten.

**Catatan:** `post_id` tidak menggunakan FOREIGN KEY karena merupakan soft reference — post yang direferensi bisa tidak ada (dihapus) tanpa harus menghapus inbox item.

### `engagement_replies`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Reply ID |
| `inbox_item_id` | `uuid NOT NULL REFERENCES engagement_inbox_items(id)` | |
| `user_id` | `uuid NOT NULL` | Referensi ke `identity_user.id` |
| `content` | `text NOT NULL` | Isi balasan |
| `outstand_reply_id` | `text` | ID dari Outstand setelah reply terkirim |
| `status` | `text NOT NULL DEFAULT 'pending'` | `pending \| sent \| failed` |
| `sent_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

---

## BC-06 — Analytics

### `analytics_post_metrics`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Post Metrics ID |
| `post_id` | `uuid NOT NULL` | Soft ref ke `publishing_posts.id` |
| `connected_account_id` | `uuid NOT NULL` | Soft ref ke `workspace_connected_accounts.id` |
| `platform` | `text NOT NULL` | Platform snapshot |
| `impressions` | `integer NOT NULL DEFAULT 0` | |
| `reach` | `integer NOT NULL DEFAULT 0` | |
| `likes` | `integer NOT NULL DEFAULT 0` | |
| `comments` | `integer NOT NULL DEFAULT 0` | |
| `shares` | `integer NOT NULL DEFAULT 0` | |
| `clicks` | `integer` | Nullable — tidak semua platform menyediakan |
| `engagement_rate` | `numeric(5,4) NOT NULL DEFAULT 0` | Dihitung: (likes + comments + shares) / reach |
| `fetched_at` | `timestamptz NOT NULL` | Kapan data terakhir diambil dari Outstand |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Catatan:** `post_id` dan `connected_account_id` menggunakan soft reference (tidak enforce FK) — metrics harus tetap tersimpan meski post atau akun sudah dihapus untuk keperluan historical analytics.

### `analytics_workspace_snapshots`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Snapshot ID |
| `workspace_id` | `uuid NOT NULL REFERENCES workspaces(id)` | |
| `period` | `text NOT NULL` | `weekly \| monthly` |
| `period_start` | `date NOT NULL` | |
| `period_end` | `date NOT NULL` | |
| `total_posts` | `integer NOT NULL DEFAULT 0` | |
| `total_reach` | `bigint NOT NULL DEFAULT 0` | |
| `total_engagements` | `bigint NOT NULL DEFAULT 0` | |
| `avg_engagement_rate` | `numeric(5,4) NOT NULL DEFAULT 0` | |
| `top_post_id` | `uuid` | Soft ref ke `publishing_posts.id` |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Constraint:** `UNIQUE(workspace_id, period, period_start)` — satu snapshot per workspace per periode.

---

## BC-07 — Start Page

### `start_page_pages`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Start Page ID |
| `workspace_id` | `uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE` | |
| `slug` | `text NOT NULL UNIQUE` | URL identifier publik (misal: `nama-brand`) |
| `title` | `text NOT NULL` | Judul halaman |
| `bio` | `text` | Deskripsi singkat |
| `avatar_url` | `text` | URL avatar halaman |
| `theme` | `text NOT NULL DEFAULT 'default'` | `default \| minimal \| bold` |
| `is_published` | `boolean NOT NULL DEFAULT false` | |
| `view_count` | `bigint NOT NULL DEFAULT 0` | Basic analytics |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Catatan:** Satu workspace hanya memiliki satu Start Page. Enforce di application layer; dapat ditambahkan `UNIQUE(workspace_id)` constraint jika diperlukan.

### `start_page_links`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Page Link ID |
| `start_page_id` | `uuid NOT NULL REFERENCES start_page_pages(id) ON DELETE CASCADE` | |
| `label` | `text NOT NULL` | Teks tampilan link |
| `url` | `text NOT NULL` | Target URL |
| `position` | `integer NOT NULL` | Urutan tampil |
| `is_active` | `boolean NOT NULL DEFAULT true` | |
| `click_count` | `bigint NOT NULL DEFAULT 0` | Basic analytics |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

---

## BC-08 — Media

### `media_items`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Media Item ID |
| `workspace_id` | `uuid NOT NULL REFERENCES workspaces(id)` | |
| `uploader_id` | `uuid NOT NULL` | Referensi ke `identity_user.id` |
| `filename` | `text NOT NULL` | Nama file asli |
| `mime_type` | `text NOT NULL` | Contoh: `image/jpeg`, `video/mp4` |
| `size` | `bigint NOT NULL` | Ukuran file dalam bytes |
| `url` | `text` | Cache URL akses aplikasi yang dapat kedaluwarsa; bukan identitas aset |
| `storage_path` | `text NOT NULL` | Path internal di Supabase Storage bucket |
| `outstand_media_id` | `text` | Metadata opsional working copy Outstand |
| `outstand_media_url` | `text` | Metadata opsional URL working copy; bukan source of truth original |
| `outstand_uploaded_at` | `timestamptz` | Waktu working copy terakhir dikonfirmasi di Outstand |
| `outstand_expires_at` | `timestamptz` | Waktu kedaluwarsa working copy menurut respons Outstand |
| `type` | `text NOT NULL` | `image \| video \| gif` |
| `width` | `integer` | Resolusi horizontal (untuk image/video) |
| `height` | `integer` | Resolusi vertikal (untuk image/video) |
| `duration` | `numeric(10,2)` | Durasi dalam detik (untuk video) |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

---

## BC-09 — Notification

### `notifications`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Notification ID |
| `workspace_id` | `uuid NOT NULL REFERENCES workspaces(id)` | |
| `user_id` | `uuid NOT NULL` | Penerima — referensi ke `identity_user.id` |
| `type` | `text NOT NULL` | `post_published \| post_failed \| account_reconnect_required \| engagement_new \| member_invited \| ...` |
| `title` | `text NOT NULL` | |
| `body` | `text NOT NULL` | |
| `is_read` | `boolean NOT NULL DEFAULT false` | |
| `related_entity_type` | `text` | `post \| inbox_item \| member \| ...` |
| `related_entity_id` | `uuid` | ID entitas terkait |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `read_at` | `timestamptz` | |

---

## BC-10 — Billing (Post-MVP)

Tabel Billing didefinisikan untuk keperluan forward-compatibility — tidak diimplementasi di MVP.

### `billing_subscriptions` *(post-MVP)*

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Subscription ID |
| `workspace_id` | `uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE` | |
| `plan` | `text NOT NULL` | `free \| pro` |
| `status` | `text NOT NULL` | `active \| past_due \| canceled \| trialing` |
| `current_period_start` | `timestamptz NOT NULL` | |
| `current_period_end` | `timestamptz NOT NULL` | |
| `canceled_at` | `timestamptz` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

### `billing_invoices` *(post-MVP)*

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Invoice ID |
| `subscription_id` | `uuid NOT NULL REFERENCES billing_subscriptions(id)` | |
| `amount` | `integer NOT NULL` | Jumlah dalam satuan terkecil (misal: cents) |
| `currency` | `text NOT NULL DEFAULT 'usd'` | |
| `status` | `text NOT NULL` | `draft \| open \| paid \| void` |
| `issued_at` | `timestamptz NOT NULL` | |
| `paid_at` | `timestamptz` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

---

## System Tables (Cross-cutting Concerns)

Tabel berikut bukan milik bounded context manapun — mereka adalah infrastruktur sistem yang digunakan lintas domain. Tabel ini **tidak** menggunakan domain prefix dan tidak di-scope per workspace.

### `background_jobs`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Job ID |
| `type` | `text NOT NULL` | Tipe job — lihat Job Type Registry di `background-jobs.md` |
| `payload` | `jsonb NOT NULL` | Data yang dibutuhkan job handler |
| `status` | `text NOT NULL DEFAULT 'pending'` | `pending \| running \| done \| failed` |
| `scheduled_at` | `timestamptz NOT NULL DEFAULT now()` | Waktu job boleh dieksekusi (untuk delay/retry) |
| `started_at` | `timestamptz` | |
| `completed_at` | `timestamptz` | |
| `attempts` | `integer NOT NULL DEFAULT 0` | Jumlah percobaan yang sudah dilakukan |
| `max_attempts` | `integer NOT NULL DEFAULT 3` | Batas maksimum percobaan sebelum jadi dead letter |
| `last_error` | `text` | Pesan error terakhir |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Catatan:** Tabel ini tidak menggunakan domain prefix karena merupakan infrastruktur sistem, bukan bagian dari bounded context manapun. RLS tidak diterapkan pada tabel ini — akses hanya melalui server-side code (JobRunner Route Handler).

Detail arsitektur background job didefinisikan di `background-jobs.md`.

### `outstand_webhook_events`

Durable receipt untuk memisahkan delivery webhook Outstand dari pemrosesan internal.

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | ID receipt internal |
| `outstand_event_id` | `text NOT NULL UNIQUE` | Event ID vendor jika tersedia; jika tidak, gunakan fingerprint SHA-256 raw body |
| `event_type` | `text NOT NULL` | `post.published \| post.error \| account.token_expired` untuk MVP |
| `raw_body` | `text NOT NULL` | Raw body persis yang diverifikasi HMAC |
| `status` | `text NOT NULL DEFAULT 'received'` | `received \| processing \| processed \| failed \| dead_lettered` |
| `processing_attempts` | `integer NOT NULL DEFAULT 0` | Percobaan proses internal; bukan delivery attempt Outstand |
| `last_error` | `text` | Error pemrosesan terakhir |
| `received_at` | `timestamptz NOT NULL DEFAULT now()` | Waktu receipt durable |
| `processed_at` | `timestamptz` | Waktu selesai |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

Route Handler hanya memberi ACK `2xx` setelah insert idempoten berhasil dan JOB-01 internal tersedia. Duplicate receipt valid di-ACK tanpa enqueue ganda. Tabel ini server-only dan tidak memakai RLS.

---

# Index Strategy

Index berikut direkomendasikan berdasarkan pola query yang diantisipasi. Detail index (termasuk partial index dan composite index lanjutan) didefinisikan di Engineering Planning.

## Index Wajib (Workspace Isolation)

Kolom `workspace_id` pada semua tabel multi-tenant wajib diindex untuk performa RLS dan query filtering:

```sql
CREATE INDEX ON {table_name}(workspace_id);
```

Berlaku untuk: `workspace_members`, `workspace_connected_accounts`, `publishing_posts`, ~~`publishing_queue_slots`~~ (deprecated, ADR-083), `mcp_grants`, `mcp_audit_logs`, `engagement_inbox_items`, `analytics_workspace_snapshots`, `media_items`, `notifications`, `start_page_pages`.

## Index Query-Driven

| Tabel | Kolom | Alasan |
|-------|-------|--------|
| `publishing_posts` | `(workspace_id, status)` | Filter konten by status (Content Calendar, Queue) |
| `publishing_posts` | `scheduled_at` | Sort dan filter konten terjadwal |
| `publishing_posts` | `deleted_at` | Filter soft delete (partial index: `WHERE deleted_at IS NULL`) |
| `publishing_post_targets` | `post_id` | Lookup targets per post |
| ~~`publishing_queue_slots`~~ | `(connected_account_id, scheduled_at)` | Deprecated (ADR-083) — Queue lookup sekarang langsung ke `publishing_posts` |
| `engagement_inbox_items` | `(workspace_id, status)` | Filter inbox by status |
| `engagement_inbox_items` | `(workspace_id, connected_account_id, external_id)` | Upsert idempoten hasil sync |
| `outstand_webhook_events` | `outstand_event_id` | Durable receipt/idempotency (sudah UNIQUE) |
| `outstand_webhook_events` | `(status, received_at)` | Claim receipt untuk JOB-01 dan inspeksi dead letter |
| `analytics_post_metrics` | `post_id` | Metrics per post |
| `notifications` | `(user_id, is_read)` | Notifikasi belum dibaca per user |
| `start_page_pages` | `slug` | Public URL lookup (sudah UNIQUE) |
| `workspaces` | `slug` | Lookup internal by unique identifier — bukan URL lookup (sudah UNIQUE) |

---

# Storage Strategy

## Platform: Supabase Storage

Media file disimpan di **Supabase Storage** (keputusan pra-architecture). Supabase Storage menggunakan S3-compatible API.

## Bucket Structure

| Bucket | Tipe | Konten |
|--------|------|--------|
| `media` | Private | File yang diupload user: gambar, video, gif untuk konten |
| `avatars` | Public | Avatar workspace, Start Page, dan avatar user personal (T-016.2) |

**Alasan private untuk `media`:** File konten tidak boleh diakses langsung via URL publik tanpa authentication. Signed URL digunakan untuk generate link sementara saat merender konten.

**Alasan public untuk `avatars`:** Avatar workspace, Start Page, dan avatar user personal perlu diakses publik (Start Page adalah halaman publik; avatar user ditampilkan di berbagai UI tanpa signed URL).

## Naming Convention File

```
{bucket}/{workspace_id}/{year}/{month}/{uuid}.{ext}

Contoh:
media/abc-123-workspace/2026/07/f47ac10b-58cc-4372-a567-0e02b2c3d479.jpg
avatars/abc-123-workspace/avatar.jpg
avatars/users/{user_id}/avatar.{ext}
```

## Storage URL di Database

`media_items.storage_path` adalah source of truth lokasi original. `media_items.url`, jika diisi, hanya cache URL akses aplikasi dan boleh kedaluwarsa; application layer men-generate signed URL baru dari `storage_path`.

Untuk publishing, aplikasi **tidak** mengirim signed URL Supabase ke Outstand. Aplikasi meminta upload URL Outstand, melakukan `PUT`, mengonfirmasi upload, lalu memakai URL working copy Outstand. `outstand_media_id`/`outstand_media_url` boleh dipersistenkan secara opsional.

---

# Soft Delete Strategy (DB-D03)

## Keputusan: Hard Delete by Default

Seluruh tabel menggunakan **hard delete** (data dihapus dari database) kecuali `publishing_posts`.

**Alasan:**
* Simplicity — tidak ada `deleted_at IS NULL` filter yang perlu diingat di setiap query.
* Data sensitif (media, notifications, members) tidak perlu disimpan setelah dihapus.
* Lebih mudah compliance GDPR/privasi data.

## Exception: `publishing_posts` — Soft Delete

`publishing_posts` menggunakan soft delete (`deleted_at timestamptz`) karena:
* Post yang sudah dipublikasikan mungkin masih memiliki `PostTarget` dan `PostMetrics` yang mereferensikannya.
* Historical analytics memerlukan referensi post meski sudah "dihapus" dari tampilan.
* Creator mungkin ingin recover draft yang tidak sengaja terhapus.

Application layer wajib menyertakan `WHERE deleted_at IS NULL` pada semua query `publishing_posts` kecuali untuk keperluan audit/recovery.

---

# Migration Strategy

Detail implementasi migrasi didefinisikan di Engineering Planning (M6). Poin arsitektur yang disepakati:

* **Tooling:** **Prisma Migrate** sebagai sumber kebenaran migrasi aplikasi (ADR-031 / `../06-engineering/database-orm.md`). Supabase CLI boleh dipakai untuk tugas platform, bukan sebagai sumber skema domain.
* **Tracking:** Artefak migrasi di `apps/web/prisma/migrations/` (version-controlled).
* **Urutan Bootstrap:** Identity tables (`identity_*`) dan tabel domain dikelola dalam Prisma schema yang sama; Better Auth memakai Prisma adapter.
* **Rollback:** Prefer expand-and-contract + forward-fix migrations; detail operasional di `database-orm.md` dan `deployment-infrastructure.md`.

---

# Traceability ke Domain Model

| Entitas Domain | Tabel Database | BC |
|---------------|---------------|-----|
| `User` | `identity_user` (Better Auth) | BC-01 |
| `Session` | `identity_session` (Better Auth) | BC-01 |
| `OAuthAccount` | `identity_account` (Better Auth) | BC-01 |
| `Workspace` + `BrandSettings` | `workspaces` | BC-02 |
| `Member` | `workspace_members` | BC-02 |
| `ConnectedAccount` | `workspace_connected_accounts` | BC-02 |
| `Post` | `publishing_posts` | BC-03 |
| `PostTarget` | `publishing_post_targets` | BC-03 |
| ~~`QueueSlot`~~ | ~~`publishing_queue_slots`~~ | BC-03 — **deprecated (ADR-083, 2026-08-19):** entity dihapus dari `domain-model.md`, Queue jadi computed view atas `Post`/`PostTarget`. Tabel fisik masih ada di DB (nol referensi kode), dijadwalkan dihapus lewat migration saat T-032.5 dikerjakan |
| `McpGrant` | `mcp_grants` | BC-04 |
| `McpAuditLog` | `mcp_audit_logs` | BC-04 |
| `InboxItem` | `engagement_inbox_items` | BC-05 |
| `Reply` | `engagement_replies` | BC-05 |
| `PostMetrics` | `analytics_post_metrics` | BC-06 |
| `WorkspaceSnapshot` | `analytics_workspace_snapshots` | BC-06 |
| `StartPage` | `start_page_pages` | BC-07 |
| `PageLink` | `start_page_links` | BC-07 |
| `MediaItem` | `media_items` | BC-08 |
| `Notification` | `notifications` | BC-09 |
| `Subscription` | `billing_subscriptions` (post-MVP) | BC-10 |
| `Invoice` | `billing_invoices` (post-MVP) | BC-10 |
| *(system)* | `background_jobs` | Cross-cutting — tidak terikat ke BC manapun |
| *(system)* | `outstand_webhook_events` | Cross-cutting — durable webhook receipt |

---

# Decision Log

| ID | Keputusan | Alasan | Alternatif |
|----|-----------|--------|-----------|
| DB-D01 | Single schema `public` dengan domain prefix; exception untuk tabel utama yang namanya identik dengan domain (gunakan nama pendek: `workspaces`, `notifications`) | Standar Supabase, setup lebih sederhana, RLS tidak perlu konfigurasi lintas schema; exception menghindari nama redundan seperti `workspace_workspaces` | Per-domain schema PostgreSQL (lebih kompleks, butuh konfigurasi search_path) |
| DB-D02 | UUID v4 via `gen_random_uuid()` | Native PostgreSQL/Supabase, zero config, tidak butuh library tambahan | ULID (sortable, tapi butuh library); CUID2 (lebih baik untuk URL, tapi juga butuh library) |
| DB-D03 | Hard delete by default; soft delete hanya pada `publishing_posts` | Simplicity dan privacy by default; Posts memerlukan soft delete karena relasi dan historical data | Soft delete semua tabel (kompleksitas query meningkat); hard delete semua (data loss risk untuk Posts) |
| DB-D04 | Better Auth menggunakan prefix `identity_` | Konsisten dengan naming convention domain; mudah dibedakan dari tabel aplikasi | Tanpa prefix (nama tabel generik seperti `user`, `session` — mudah konflik) |
| DB-D05 | Application-enforced auth + RLS sebagai safety net | Better Auth tidak terintegrasi native dengan Supabase JWT; semua akses sudah server-side | Custom JWT claim untuk Supabase RLS (lebih kompleks setup untuk MVP) |
| DB-D05a | Pengecualian DB-D05 untuk tabel BC-04 (`mcp_grants`, `mcp_audit_logs`): RLS aktif dengan satu policy `app_runtime` (`USING (true) WITH CHECK (true)`), tanpa isolasi per-workspace/pengguna di level DB (ADR-141) | Pemanggil memakai token OAuth tanpa `app.current_user_id`, dan jalur sistem (purge JOB-08, hook consent) tidak punya pengguna; isolasi ada di application layer | Policy per `user_id` lewat `withCurrentUser(sub)` + fungsi `SECURITY DEFINER` (kerja dan risiko tambahan, safety net tidak sebanding) |
| DB-D06 | `created_at` dan `updated_at` di semua tabel | Standar audit trail minimal; diperlukan untuk sync, debugging, dan pagination cursor | Hanya `created_at` (kehilangan kemampuan track update waktu) |
| DB-D07 | `outstand_webhook_events` sebagai durable idempotent receipt | Menjamin event tersimpan sebelum ACK dan memisahkan delivery vendor dari processing internal | ACK sebelum persist; payload hanya di job queue |
| DB-D08 | Engagement schema MVP hanya komentar/reply | Selaras kontrak Outstand dan sumber JOB-03/manual sync | Menyimpan DM/mention yang tidak dapat disinkronkan |
| DB-D09 | ADR-040 | DB-D07–D08 serta metadata working copy media mengamandemen skema konseptual lama | — |

---

# Related Documents

* `domain-model.md` — fondasi entitas dan relasi yang dipetakan ke tabel database ini
* `application-layer.md` — bagaimana application layer berinteraksi dengan database *(dokumen berikutnya)*
* `integration-layer.md` — Outstand Comments API/JOB-03 yang mengisi `engagement_inbox_items`, webhook receipt untuk status publishing/account, dan polling analytics
* `background-jobs.md` — background job yang mengakses ~~`publishing_queue_slots`~~ (deprecated, ADR-083) dan `analytics_post_metrics`
* `realtime-strategy.md` — Supabase Realtime untuk `notifications`
* `auth-architecture.md` — Better Auth dan RLS detail — `workspace_members` sebagai authorization table
* `../02-product/roles-permissions.md` — roles dan content status kanonikal
* `../../project-os/DECISIONS.md` — ADR-014, ADR-015 (keputusan baru dari sesi ini)
