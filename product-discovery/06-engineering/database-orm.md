# Database & ORM

Dokumen ini mendefinisikan **strategi akses data, ORM, migrasi skema, dan connection pooling** untuk produk Postific.

Dokumen ini adalah implementasi konkret dari **Database Strategy** (`../05-architecture/database-strategy.md`, ADR-015), **Repository Pattern** (ADR-017 sebagaimana diamandemen ADR-031), dan kebutuhan koneksi Better Auth (`auth-strategy.md`, ADR-030). Skema tabel dan kebijakan RLS tetap mengacu pada Architecture Baseline — dokumen ini fokus pada tooling dan pola operasional.

---

# Tujuan

* Menetapkan Prisma sebagai ORM formal untuk persistence domain.
* Mendefinisikan batas pemakaian Prisma vs Supabase client.
* Menetapkan strategi migrasi skema (Prisma Migrate) lintas Staging dan Production.
* Menetapkan connection pooling dan URL koneksi (runtime vs migrasi).
* Menyelaraskan Better Auth dengan Prisma / PostgreSQL yang sama.
* Menjadi acuan Repository & Bootstrap (M7) untuk inisialisasi Prisma schema dan client.

---

# Keputusan yang Sudah Terkunci (dari Baseline)

| Topik | Keputusan | Sumber |
|-------|-----------|--------|
| Database Platform | Supabase PostgreSQL Cloud | ADR-015, `database-strategy.md` |
| Schema | Single schema `public`, domain prefix (+ exception ADR-027) | ADR-014, ADR-027 |
| Multi-tenancy / RLS | App-layer auth primer; RLS defense-in-depth via `app.current_user_id` | DB-D05 |
| Repository Pattern | Interface di domain; satu repo per Aggregate Root | ADR-017 |
| Auth tables | Prefix `identity_`, dikelola Better Auth | DB-D04, ADR-030 |
| Storage | Supabase Storage | `database-strategy.md` |
| Realtime | Supabase Realtime untuk `notifications` | ADR-023 |
| Environment | Project Supabase terpisah prod / staging | ADR-029 |

---

# Keputusan Database & ORM (Ditetapkan di Dokumen Ini)

| ID | Topik | Keputusan |
|----|-------|-----------|
| DO-D01 | ORM formal | **Prisma** — repository implementations memakai Prisma Client |
| DO-D02 | Batas Supabase client | Supabase JS client **hanya** untuk Realtime dan Storage — bukan untuk CRUD domain |
| DO-D03 | Migrasi skema | **Prisma Migrate** sebagai sumber kebenaran migrasi di repository |
| DO-D04 | Connection pooling | Supabase **Supavisor**: `DATABASE_URL` (pooled) untuk runtime; `DIRECT_URL` untuk migrate |
| DO-D05 | Better Auth ↔ Prisma | Better Auth memakai adapter/koneksi Prisma ke DB yang sama; tabel `identity_*` ada di Prisma schema |
| DO-D06 | RLS dengan Prisma | Authorization primer tetap di Application Service; sebelum query sensitif, server set `app.current_user_id` via Prisma (`$executeRaw` / transaksi) agar RLS safety-net aktif |

---

# Arsitektur Akses Data

```
┌─────────────────────────────────────────────────────────────────┐
│  Application Service (domain)                                    │
│    → memanggil IXxxRepository saja                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Repository Implementation (`src/lib/repositories/…`)             │
│    → Prisma Client (CRUD, transaksi, mapping row ↔ entity)       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Supabase PostgreSQL (via Supavisor / direct)                    │
└─────────────────────────────────────────────────────────────────┘

Jalur terpisah (bukan CRUD domain):
┌──────────────────┐     ┌────────────────────────────────────────┐
│ Supabase Storage │     │ Supabase Realtime (browser + JWT)       │
│ (server upload)  │     │ — auth-strategy.md AS-D03               │
└──────────────────┘     └────────────────────────────────────────┘
         ▲
         │ Supabase JS client (service role di server / anon di client)
```

**Prinsip boundary (DO-D01, DO-D02):**
- Domain CRUD → Prisma saja.
- File media → Supabase Storage client.
- Notifikasi live → Supabase Realtime client.
- Application Service tidak mengimpor Prisma Client atau Supabase client secara langsung.

---

# Prisma Setup

## Lokasi di Monorepo

Selaras dengan `monorepo-setup.md`:

```
apps/web/
├── prisma/
│   ├── schema.prisma           ← model + datasource
│   └── migrations/             ← artefak Prisma Migrate (version-controlled)
└── src/lib/
    ├── prisma/
    │   └── client.ts           ← singleton PrismaClient (server-only)
    ├── supabase/
    │   ├── client.ts           ← browser (Realtime)
    │   ├── server.ts           ← server (Storage; bukan CRUD domain)
    │   └── middleware.ts
    ├── better-auth/
    │   └── auth.ts
    └── repositories/           ← implementasi via Prisma
```

## Datasource & Generator (acuan)

Prisma **7+**: URL koneksi tidak lagi di `schema.prisma`. Semantik DO-D04 tetap sama — dipisah antara CLI migrate dan runtime client.

```prisma
// apps/web/prisma/schema.prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

```ts
// apps/web/prisma.config.ts — CLI migrate / introspect
datasource: {
  url: env("DIRECT_URL"), // direct/session — bukan pooled
}
```

```ts
// apps/web/src/lib/prisma/client.ts — runtime
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter }); // pooled Supavisor
```

> Acuan struktur. Model tabel mengikuti `database-strategy.md`.

## Prisma Client Lifecycle

- Instantiasi **satu** `PrismaClient` per proses Node/Bun (singleton di `src/lib/prisma/client.ts`).
- Hanya diimpor dari kode server (Repository, Better Auth config, job runner) — tidak dari Client Components.
- Di development, gunakan pola globalThis agar hot-reload tidak membuka terlalu banyak koneksi.

---

# Connection Pooling (DO-D04)

Supabase menyediakan connection pooler (**Supavisor**). Prisma membedakan dua URL:

| Env Var | Mode | Dipakai untuk |
|---------|------|----------------|
| `DATABASE_URL` | Pooled (transaction mode / port pooler) | Runtime aplikasi: Next.js Server Components, Server Actions, Route Handlers, Better Auth |
| `DIRECT_URL` | Session / direct ke Postgres | `prisma migrate`, `prisma db push` (lokal), introspect |

**Aturan:**
- Jangan menjalankan migrasi lewat URL pooled — gunakan `DIRECT_URL`.
- Credential berbeda per environment (prod vs staging) — selaras DI-D03.
- Detail penamaan lengkap env var ada di `environment-management.md`.

Bottleneck koneksi dimitigasi oleh pooler (bukan menambah instance Railway) — selaras `deployment-infrastructure.md`.

---

# Migration Strategy (DO-D03)

## Tooling

| Aspek | Keputusan |
|-------|-----------|
| Tool primer | **Prisma Migrate** (`prisma migrate dev` / `prisma migrate deploy`) |
| Artefak | `apps/web/prisma/migrations/` di Git |
| Staging → Production | Migrate di project Supabase staging dulu, lalu production (DI-D03) |
| Rollback | Prefer **expand-and-contract** + migrasi forward-fix; hindari `migrate reset` di shared environments |

Catatan arsitektur di `database-strategy.md` yang sebelumnya menyebut Supabase CLI sebagai tooling migrasi **digantikan** oleh keputusan M6 ini untuk migrasi domain. Supabase CLI boleh tetap dipakai untuk tugas platform (mis. generate types lokal, inspeksi project), tetapi **bukan** sumber kebenaran skema aplikasi.

## Alur Kerja

```
1. Ubah prisma/schema.prisma
2. prisma migrate dev --name <deskripsi>     ← terhadap project staging yang ditumpangi local (EM-D02, ADR-081)
3. Review SQL di prisma/migrations/
4. Merge via CI (gate kualitas — cicd-pipeline.md)
5. Deploy ke staging → prisma migrate deploy (DIRECT_URL staging)
6. Verifikasi staging
7. Deploy ke production → prisma migrate deploy (DIRECT_URL production)
```

## Urutan Bootstrap (M7)

1. Inisialisasi Prisma schema + datasource.
2. Model / migrasi tabel `identity_*` selaras Better Auth (+ Prisma adapter).
3. Migrasi tabel domain sesuai `database-strategy.md` (termasuk `background_jobs`, `outstand_webhook_events`, RLS policies sebagai SQL di migrasi atau script terpisah yang di-track di repo).
4. Seed minimal hanya jika diperlukan untuk local/staging — bukan production user data.

Penyelarasan ADR-040 menggunakan migrasi aditif `20260723121000_align_outstand_contract` untuk durable webhook receipt, reconnect state, metadata media Outstand, dan constraint Engagement. Status penerapan dan implementasi runtime mengacu hanya ke `PROJECT_STATE.md`.

## RLS Policies dalam Migrasi

Policy SQL (`ENABLE ROW LEVEL SECURITY`, `CREATE POLICY`, function helper untuk `app.current_user_id`) disimpan sebagai bagian dari migrasi Prisma (raw SQL dalam migration folder) agar skema + policy tetap sejalan di kedua project Supabase.

## Shadow Database & External Tables (ADR-073)

Setiap `prisma migrate dev` mereplay **seluruh** migration history ke shadow
database kosong untuk validasi. Migrasi yang berisi raw SQL ke tabel milik
platform lain (mis. `storage.buckets` milik Supabase Storage, bukan model
Prisma) akan gagal (**P3006**) karena tabel itu tidak ada di shadow DB kosong
yang baru dibuat.

Keputusan (**ADR-073**): memakai fitur resmi **Prisma 7 External Tables**,
dikonfigurasi di `apps/web/prisma.config.ts`:

| Field config | Fungsi |
|---|---|
| `experimental.externalTables: true` | Mengaktifkan dukungan tabel eksternal |
| `tables.external: ["storage.buckets"]` | Menandai tabel yang dimiliki platform lain, tidak dikelola Prisma |
| `migrations.initShadowDb` | Isi SQL setup (stub tabel eksternal) yang dijalankan Prisma terhadap shadow DB sebelum replay migration history |

SQL stub-nya sendiri disimpan di file terpisah agar reviewable
(`apps/web/prisma/shadow-init.sql`), dibaca via `readFileSync` di
`prisma.config.ts` — **catatan penting**: `migrations.initShadowDb` di
Prisma 7.8.0 mengharapkan isi SQL script (string), bukan path file.

Pendekatan ini murni konfigurasi (`prisma.config.ts` + satu file SQL) —
tidak mengubah `schema.prisma` maupun migration.sql yang sudah applied di
DB manapun. Shadow DB bersifat efemeral (dibuat-hapus otomatis oleh Prisma
setiap run), sehingga tidak ada state yang perlu di-undo saat rollback.

---

# Repository Implementation dengan Prisma

Selaras ADR-017 (amended) dan `application-layer.md`:

| Aturan | Detail |
|--------|--------|
| Interface | Di `src/domains/<bc>/` (mis. `IPostRepository`) |
| Implementasi | Di `src/lib/repositories/<bc>/` memakai Prisma Client |
| Mapping | Repository memetakan Prisma model ↔ domain entity / aggregate |
| Transaksi | Gunakan `prisma.$transaction` untuk operasi multi-aggregate yang harus atomik di dalam satu BC |
| Soft delete | Hormati `deleted_at` pada `publishing_posts` (`database-strategy.md`) |

Application Service **tidak** mengimpor `@prisma/client` atau `src/lib/prisma/client` secara langsung.

## Durable Webhook Receipt (ADR-040)

Repository sistem untuk webhook menjalankan satu transaksi Prisma:

1. Insert `outstand_webhook_events` dengan unique vendor event identity/fingerprint deterministik.
2. Jika receipt baru, insert `background_jobs` tipe `outstand.webhook.process` yang mereferensikan receipt ID.
3. Commit transaksi, baru Route Handler mengembalikan `2xx`.
4. Jika duplicate, tidak membuat job kedua dan tetap boleh ACK `2xx`.

Raw body disimpan setelah HMAC valid agar JOB-01 dapat memproses payload yang sama tanpa bergantung pada delivery ulang Outstand. `processing_attempts`/status receipt mencatat pemrosesan internal; attempt delivery vendor tidak dicampur ke kolom tersebut.

---

# RLS dengan Prisma (DO-D06)

Pola dual-context dari `auth-strategy.md` tetap berlaku; yang berubah hanya **cara server berbicara ke Postgres** untuk Konteks 1:

**Konteks 1 — Server-side (CRUD domain via Prisma)**
1. Better Auth session → `userId`.
2. Dalam transaksi / sebelum query:  
   set `app.current_user_id = '<userId>'` (via Prisma `$executeRaw`,
   fungsi `set_config('app.current_user_id', <userId>, true)` — bukan
   literal `SET LOCAL app.current_user_id = <userId>`, karena `SET LOCAL`
   tidak menerima value sebagai bound parameter; `set_config(...)` aman
   dipakai dengan Prisma tagged-template sehingga `userId` tetap bound
   parameter, bukan string concat manual).
3. Query Prisma berikutnya dijalankan dalam koneksi/transaksi yang sama.
4. Authorization bisnis tetap di Application Service (RBAC); RLS adalah safety net.

> **Koreksi (2026-08-13, T-017):** Policy SQL yang membandingkan
> `app.current_user_id` **tidak** boleh meng-cast ke `::uuid` — Better
> Auth `identity_user.id` adalah `cuid()` string (`text`), bukan UUID, dan
> kolom `user_id` di tabel domain juga `text`. Bandingkan sebagai text
> langsung: `wm.user_id = current_setting('app.current_user_id', true)`.
> `workspace_id` tetap `uuid` di semua tabel domain, jadi cast `::uuid`
> tetap dipakai untuk sisi itu. Implementasi wrapper ada di
> `apps/web/src/lib/prisma/with-current-user.ts` (fungsi `withCurrentUser`).
>
> **Catatan status runtime:** koneksi `DATABASE_URL`/`DIRECT_URL` saat ini
> memakai role Postgres `postgres` yang di Supabase memiliki atribut
> `BYPASSRLS` secara default — RLS belum aktif secara efektif di runtime
> nyata sampai koneksi dipindah ke role tanpa `BYPASSRLS` (lihat Known
> Issues di `PROJECT_STATE.md`). RLS tetap benar secara desain SQL; ini
> gap infra/role, bukan gap desain policy.

**Konteks 2 — Realtime** tidak memakai Prisma — tetap JWT Supabase-compatible + Supabase Realtime client (AS-D03).

> Catatan: jika suatu query memakai role yang bypass RLS (mis. connection privileged), Application Service tetap menjadi penegak otorisasi utama (DB-D05). `SET LOCAL` wajib untuk jalur yang mengandalkan RLS policy.

---

# Better Auth + Prisma (DO-D05)

| Aspek | Keputusan |
|-------|-----------|
| Database | PostgreSQL Supabase yang sama dengan domain tables |
| Integrasi | Better Auth **Prisma adapter** (atau ekuivalen resmi yang menulis ke model Prisma) |
| Schema | Model `identity_*` didefinisikan di `schema.prisma` agar migrate tunggal |
| Connection | Memakai `DATABASE_URL` pooled yang sama dengan aplikasi |
| Session | Database session (AS-D02) — tabel session di-manage Better Auth melalui adapter |

Ini menuntaskan placeholder di `auth-strategy.md`: driver/dialect Better Auth = jalur Prisma ke `DATABASE_URL`.

---

# Supabase Client — Ruang Lingkup Sempit (DO-D02)

| Pakai Supabase client | Jangan pakai Supabase client |
|----------------------|------------------------------|
| Upload / signed URL Storage | `select` / `insert` / `update` / `delete` tabel domain |
| Subscribe Realtime `notifications` | Job queue CRUD (`background_jobs`) |
| Operasi admin Storage bucket | Query analytics / engagement / publishing |

Supabase Storage menyimpan original media. Flow Outstand working copy (request upload URL → `PUT` → confirm) adalah HTTP melalui ACL, bukan CRUD Supabase/Prisma. Metadata Outstand media boleh dipersistenkan opsional via repository Media.

Repository domain **tidak** boleh bergantung pada `@supabase/supabase-js` untuk persistence.

---

# Local Development

| Aspek | Pendekatan MVP |
|-------|----------------|
| Target DB lokal | Project Supabase Cloud yang sama dengan staging (EM-D02, ADR-033, amandemen ADR-081) — tidak ada isolasi local↔staging |
| Migrate lokal | `prisma migrate dev` dengan `DIRECT_URL` dari `.env.local` |
| Generate client | `prisma generate` setelah ubah schema (hook di install/bootstrap) |
| Seed | Opsional pada local; jangan mengandalkan data staging/produksi |

Detail script Bun (`db:migrate`, `db:generate`) ditetapkan di `dx-tooling.md` (DX-D04).

---

# Decision Log

| ID | Keputusan | Alasan | Alternatif |
|----|-----------|--------|-----------|
| DO-D01 | Prisma sebagai ORM formal; repository via Prisma Client | Type-safe persistence, migrate jelas, selaras keputusan stack sebelumnya & portabilitas ORM | Supabase client saja; Drizzle |
| DO-D02 | Supabase client hanya Realtime + Storage | Fitur platform tidak digantikan ORM; menghindari dual-write CRUD | Prisma untuk semua (tidak feasible); Supabase client untuk CRUD juga (mengaburkan boundary) |
| DO-D03 | Prisma Migrate sebagai sumber migrasi | Satu toolchain dengan ORM; reviewable di Git; deploy ke dua project Supabase | Supabase CLI sebagai sumber utama (catatan M5) |
| DO-D04 | Supavisor: pooled `DATABASE_URL` + `DIRECT_URL` migrate | Mencegah exhaustion koneksi di Next.js; migrate butuh session langsung | Direct-only (risiko kehabisan koneksi); pooled-only untuk migrate (sering gagal) |
| DO-D05 | Better Auth via Prisma adapter di DB yang sama | Satu skema/migrate path; konsisten AS-D01 | Better Auth raw SQL driver terpisah dari Prisma schema |
| DO-D06 | `SET LOCAL app.current_user_id` via Prisma untuk RLS | Mempertahankan defense-in-depth DB-D05 setelah pindah dari Supabase JS ke Prisma | Nonaktifkan RLS sepenuhnya (menghapus safety net) |
| DO-D07 | Receipt webhook + JOB-01 dibuat atomik sebelum ACK | Tidak ada celah receipt tersimpan tanpa job atau ACK tanpa durable state |
| DO-D08 | Original media tetap Storage; metadata working copy Outstand opsional | Ownership aset tidak berpindah ke provider publishing |
| DO-D09 | ADR-040 | DO-D07–D08 mengamandemen model operasional database Engineering Baseline |

---

# Related Documents

* `README.md` — scope dan workflow Engineering Planning
* `monorepo-setup.md` — lokasi `src/lib/repositories/`, `src/lib/prisma/`
* `auth-strategy.md` — Better Auth, dual-context RLS, `DATABASE_URL`
* `deployment-infrastructure.md` — staging/prod Supabase, rollback expand-and-contract
* `cicd-pipeline.md` — `prisma migrate deploy` di Railway release/pre-start (CI-D05, ADR-032)
* `environment-management.md` — `DATABASE_URL`, `DIRECT_URL`, secrets, local menumpang project staging (ADR-033, ADR-081)
* `dx-tooling.md` — script lokal migrate/generate (ADR-034)
* `../05-architecture/database-strategy.md` — skema tabel, RLS, soft delete
* `../05-architecture/application-layer.md` — Repository Pattern
* `../../project-manager/DECISIONS.md` — ADR-017 (amended), ADR-031
