# Dependency Strategy

Dokumen ini mendefinisikan **strategi package & dependency** untuk produk Postific: versioning eksternal, lockfile, penempatan dependency di monorepo, aturan shared package, dan cara update dependency.

Dokumen ini melengkapi `monorepo-setup.md` (workspace layout, `@postific/shared`, import rules) dan selaras dengan install CI di `cicd-pipeline.md` (`bun install --frozen-lockfile`) serta dependency tooling di `dx-tooling.md`.

---

# Tujuan

* Menetapkan cara menuliskan versi dependency eksternal sebelum Repository & Bootstrap (M7).
* Mengunci peran lockfile di root monorepo (reproducible install lokal, CI, Railway).
* Mendefinisikan di mana dependency boleh di-install (root vs `apps/web` vs `packages/*`).
* Mempertegas aturan `@postific/shared` dan kapan package baru di `packages/` boleh ditambahkan.
* Menetapkan alur update dependency yang sederhana untuk solo developer.

---

# Keputusan yang Sudah Terkunci (dari Baseline)

| Topik | Keputusan | Sumber |
|-------|-----------|--------|
| Runtime / package manager | Bun | ADR-002 |
| Monorepo | Hybrid — `apps/*`, `packages/*` | ADR-001, ADR-026 |
| Internal package link | `"@postific/shared": "workspace:*"` | `monorepo-setup.md` |
| Lockfile lokasi | Satu lockfile di root (`bun.lockb`) | `monorepo-setup.md`, DI deploy notes |
| CI install | `bun install --frozen-lockfile` | CI-D02, ADR-032 |
| Tooling di root | ESLint, Prettier, Lefthook, Vitest, TypeScript (monorepo-level) | DX-D01–D03, `monorepo-setup.md` |
| Isi `@postific/shared` | Branded IDs, enums, value objects dipakai 2+ domain | MS-D04 |

---

# Keputusan Dependency Strategy (Ditetapkan di Dokumen Ini)

| ID | Topik | Keputusan |
|----|-------|-----------|
| DS-D01 | Version ranges (eksternal) | **Caret (`^x.y.z`)** di `package.json`; resolusi tepat dikunci oleh lockfile |
| DS-D02 | Update dependency | **Manual** — bump / `bun update` saat ada kebutuhan; tanpa Renovate/Dependabot di MVP |
| DS-D03 | Lockfile | **Satu `bun.lockb` di root**, wajib di-commit; CI & deploy memakai frozen install |
| DS-D04 | Penempatan dependency | Root = tooling monorepo; `apps/web` = runtime app; `packages/shared` = tanpa runtime deps (tipe murni) |
| DS-D05 | Shared packages | Tetap satu `@postific/shared` di MVP; package baru di `packages/` hanya dengan alasan kuat (lihat aturan) |
| DS-D06 | Sinkronisasi versi lintas workspace | **Tanpa Bun Catalog** di MVP; cukup caret + satu lockfile |
| DS-D07 | Pengecualian Astryx Beta | **Superseded oleh ADR-097** (migrasi ke shadcn/ui) — Astryx tidak lagi jadi fondasi permanen; aturan exact pin di bawah ini historis, berlaku hanya untuk sisa kode Astryx yang belum termigrasi |

---

# Versioning Eksternal (DS-D01)

## Aturan penulisan versi

| Jenis | Cara menulis | Contoh |
|-------|--------------|--------|
| Dependency npm publik | Caret range | `"next": "^15.0.0"`, `"prisma": "^6.0.0"` |
| Workspace internal | Protocol workspace | `"@postific/shared": "workspace:*"` |
| Exact pin | Hanya jika ada alasan kuat (bug kritis, vendor minta pin) | `"some-lib": "1.2.3"` — dicatat di PR/ADR bila jangka panjang |
| Astryx Beta | Exact stable version | `"@astryxdesign/core": "0.1.8"`, `"@astryxdesign/theme-stone": "0.4.3"` (ADR-087) |

**Prinsip:**
- `package.json` menyatakan **rentang yang diterima**; `bun.lockb` menyatakan **versi yang terpasang**.
- Jangan mengandalkan "latest" atau range terbuka (`*`, `latest`) untuk dependency produksi.
- Major bump (breaking) selalu disengaja: baca changelog, jalankan typecheck/lint/test, lalu commit lockfile bersama perubahan kode.

### Pengecualian Astryx Beta (DS-D07) — superseded oleh ADR-097

**Sudah tidak berlaku sebagai aturan aktif.** shadcn/ui (fondasi permanen
sejak ADR-097) adalah kode sumber yang di-*copy* ke repo, bukan dependency
package — tidak ada isu versioning Beta/exact pin seperti Astryx. Section di
bawah dipertahankan sebagai riwayat, berlaku hanya selama masih ada kode
Astryx yang belum termigrasi (lihat `tasks/v07-astryx-shadcn-migration.md`).

ADR-041 mengamendemen aturan caret ADR-035 khusus untuk Astryx selama masih
Beta:

- `@astryxdesign/core`, theme package aktif (`@astryxdesign/theme-stone`,
  ADR-087), dan `@astryxdesign/cli` memakai exact stable version yang sama;
- jangan memakai tag `latest`, wildcard, atau canary;
- core dan theme selalu di-upgrade sebagai satu unit;
- `@stylexjs/stylex` **dihapus total** dari dependency project (ADR-082,
  amandemen ADR-041) — Astryx dipakai Tailwind-layout-only; `swizzle` juga
  tertutup permanen sebagai konsekuensinya (swizzle butuh compiler StyleX
  yang sama); dan
- setiap upgrade wajib melewati staging serta smoke test Button, Dialog, form
  controls, Table, dark mode, Tailwind cascade layer, typecheck, lint, test, dan
  Next.js production build.

## Yang tidak dipakai di MVP

- **Exact pin semua dependency** — terlalu banyak noise update untuk solo MVP; lockfile sudah menjamin reproduksibilitas.
- **Bun Catalog** — berguna saat banyak workspace berbagi versi tooling yang sama; dengan hanya `apps/web` + `@postific/shared`, overhead belum sebanding (DS-D06). Boleh dievaluasi ulang jika jumlah package bertambah.

---

# Lockfile (DS-D03)

## Kontrak

| Aspek | Keputusan |
|-------|-----------|
| File | `bun.lockb` di **root** monorepo |
| Git | **Wajib di-commit** — artefak bersama untuk lokal, CI, Railway |
| Install lokal | `bun install` (boleh memperbarui lockfile jika `package.json` berubah) |
| Install CI / reproducible | `bun install --frozen-lockfile` — gagal jika lockfile tidak cocok dengan `package.json` |
| Deploy (Railway) | Install dari root dengan lockfile yang sama (lihat `deployment-infrastructure.md`) |

**Aturan:**
- Jangan hapus atau regenerate lockfile tanpa alasan (corrupt / migrasi format yang disepakati).
- Setiap PR yang mengubah dependency **wajib** menyertakan perubahan `bun.lockb` yang terkait.
- Jangan commit `node_modules/`.

> Jika di masa depan Bun mengadopsi format lockfile teks (`bun.lock`) sebagai default resmi project, migrasi dilakukan sekali di M7/Development dengan ADR amandemen singkat — sampai saat itu dokumen ini mengacu `bun.lockb` sesuai `monorepo-setup.md`.

---

# Penempatan Dependency (DS-D04)

```
social-media-management/
├── package.json              ← tooling monorepo saja
├── bun.lockb                 ← satu lockfile untuk semua workspace
├── apps/web/package.json     ← runtime: Next, Prisma, Better Auth, Supabase client, UI, dll.
└── packages/shared/package.json  ← tanpa dependencies runtime (tipe murni)
```

| Lokasi | Boleh berisi | Tidak boleh |
|--------|--------------|-------------|
| Root | TypeScript, ESLint, Prettier, Lefthook, lint-staged, Vitest, dan plugin config terkait | Framework app (`next`), ORM runtime app, Better Auth, Supabase client app |
| `apps/web` | Semua dependency yang dibutuhkan Next.js app saat build/runtime | Tooling lint/format/test yang sudah diangkat ke root (hindari duplikasi tanpa alasan) |
| `packages/shared` | Idealnya **tidak ada** `dependencies`; `devDependencies` TypeScript hanya jika diperlukan package sendiri | React, Next, Prisma, Better Auth, Supabase, domain logic |

**Aturan install:**
- Jalankan `bun add <pkg>` dari workspace yang tepat (`--cwd apps/web` atau dari dalam folder package), kecuali dependency memang monorepo-level → root.
- Jangan mengangkat library app ke root "supaya enak diimport" — itu mengaburkan boundary (selaras Architecture Rules: shared package hanya untuk kebutuhan lintas domain/app).

---

# Shared Package Rules (DS-D05)

Melengkapi MS-D04 dan IR-05 di `monorepo-setup.md`.

## `@postific/shared` — yang boleh / tidak

| Boleh | Tidak boleh |
|-------|-------------|
| Branded ID types (`WorkspaceId`, `PostId`, …) | Business logic / Application Service |
| Enums lintas domain (`ContentStatus`, `MemberRole`, `Platform`, …) | Import dari `@postific/web` atau `src/domains/*` |
| Value objects murni tanpa I/O (`Email`, `URL`, …) | Client infrastruktur (Prisma, Supabase, Better Auth) |
| Type yang dipakai **≥ 2 domain** (atau app + package lain di masa depan) | Duplikasi type yang hanya dipakai satu domain |

## Menambah package baru di `packages/`

MVP **hanya** `packages/shared`. Package baru (mis. `@postific/ui`, `@postific/config`) **tidak** ditambahkan kecuali memenuhi **salah satu**:

1. Ada **aplikasi deployable kedua** di `apps/` yang membutuhkan kode bersama yang bukan domain module; atau
2. Ada library yang jelas terpisah, tanpa domain logic, dan ekstraksi mengurangi kompleksitas nyata (bukan spekulasi "nanti berguna").

Domain modules **tetap** di `apps/web/src/domains/` (ADR-026) — jangan dipromosikan menjadi workspace package di MVP.

---

# Update Dependency (DS-D02)

## Alur MVP (manual)

```
1. Identifikasi kebutuhan (security, fitur, bug, major framework)
2. Ubah versi di package.json yang relevan (atau bun update / bun add)
3. bun install di root → perbarui bun.lockb
4. bun run typecheck && bun run lint && bun run test
5. Commit package.json + bun.lockb (+ perubahan kode adaptasi) dalam satu PR
```

Untuk komponen shadcn (kode yang di-copy ke repo, ADR-097), update berarti
menarik ulang komponen dari CLI/MCP dan menyesuaikan customisasi lokal —
jalankan smoke test UI dan production build di branch terpisah, lalu uji di
staging sebelum promosi. (Langkah khusus Astryx di bawah historis, berlaku
untuk sisa kode Astryx yang belum termigrasi.)

Untuk Astryx (legacy), tambahkan langkah khusus: bump core + theme + CLI
sebagai satu unit, verifikasi peer StyleX, jalankan smoke test UI dan
production build di branch terpisah, lalu uji di staging sebelum promosi.

| Situasi | Tindakan |
|---------|----------|
| Patch/minor dalam caret | Boleh `bun update <pkg>` berkala; commit lockfile |
| Major (breaking) | Baca migration guide; adaptasi kode; uji penuh; sebutkan di PR |
| Security advisory kritis | Prioritaskan bump segera meski di luar siklus fitur |
| Tooling root (ESLint, Vitest, …) | Update di root; pastikan script CI masih hijau |

## Yang ditunda

- **Dependabot / Renovate** — boleh dievaluasi setelah frekuensi update jadi beban atau saat kolaborator bertambah. Bukan bagian bootstrap M7.
- Auto-merge dependency PR — tidak dipakai di MVP.

---

# Ringkasan Perintah (Acuan M7)

| Tujuan | Perintah |
|--------|----------|
| Install seluruh monorepo | `bun install` (root) |
| Install CI | `bun install --frozen-lockfile` |
| Tambah dep app | `bun add <pkg> --cwd apps/web` |
| Tambah dep tooling root | `bun add -d <pkg>` (root) |
| Update satu paket | `bun update <pkg>` (di workspace yang tepat) |
| Verifikasi setelah bump | `bun run typecheck && bun run lint && bun run test` |

---

# Artefak yang Diharapkan di M7

* Root `package.json` + `apps/web/package.json` + `packages/shared/package.json` mengikuti penempatan DS-D04.
* `bun.lockb` ter-commit sejak bootstrap pertama yang menginstal dependency.
* Tidak ada dependency runtime di `@postific/shared`.
* CI memakai `--frozen-lockfile` (sudah di `cicd-pipeline.md`).
* Tidak ada config Renovate/Dependabot di MVP kecuali diputuskan belakangan.

---

# Decision Log

| ID | Keputusan | Alasan | Alternatif |
|----|-----------|--------|-----------|
| DS-D01 | Caret (`^`) untuk dependency eksternal | Lockfile mengunci resolusi; caret mengurangi noise bump harian untuk solo MVP | Exact pin semua paket; Bun Catalog |
| DS-D02 | Update manual | Paling sederhana untuk solo developer; kontrol penuh kapan breaking change masuk | Dependabot; Renovate |
| DS-D03 | Satu `bun.lockb` root, commit + frozen di CI | Reproducible builds lokal/CI/Railway; selaras monorepo Bun | Lockfile per package; tidak commit lockfile |
| DS-D04 | Root = tooling; web = runtime; shared = tanpa runtime deps | Boundary jelas; mencegah "god root package.json" | Semua dependency di root |
| DS-D05 | Hanya `@postific/shared` di MVP; package baru butuh alasan kuat | Hindari premature package explosion; selaras ADR-026 | Banyak packages sejak awal |
| DS-D06 | Tanpa Bun Catalog di MVP | Hanya dua workspace relevan; catalog belum memberi nilai | Catalog sejak hari pertama |
| DS-D07 | Exact stable version untuk Astryx Beta | Mengurangi risiko breaking change; core/theme harus tetap kompatibel dan diuji sebagai satu unit | Caret; canary; update otomatis |

---

# Related Documents

* `README.md` — scope dan workflow Engineering Planning
* `monorepo-setup.md` — workspace layout, `@postific/shared`, import rules (MS-D04, IR-05)
* `cicd-pipeline.md` — `bun install --frozen-lockfile` (CI-D02)
* `dx-tooling.md` — dependency tooling monorepo di root
* `deployment-infrastructure.md` — install dari root saat build Railway
* `../../project-manager/DECISIONS.md` — ADR-002, ADR-026, ADR-032, ADR-035, ADR-041
