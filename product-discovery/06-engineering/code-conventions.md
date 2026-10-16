# Code Conventions

Dokumen ini mendefinisikan konvensi penulisan kode: hierarki error handling,
naming (variabel, fungsi, tipe), dan struktur penulisan fungsi —
mengonkretkan aturan singkat yang sudah ada di `ctx-development.md` dan
`AGENTS.md` menjadi rujukan detail dengan contoh nyata dari kode.

Dokumen ini melengkapi `monorepo-setup.md` (struktur folder/file) dan
`dx-tooling.md` (lint/format tools yang menegakkan sebagian aturan di sini
secara otomatis — lihat `eslint.config.mjs`).

---

# Tujuan

* Mendokumentasikan hierarki error handling yang sudah matang dan konsisten
  dipakai di kode, tapi belum pernah dituliskan sebagai baseline resmi.
* Mengonsolidasikan aturan naming yang sekarang tersebar di
  `ctx-development.md` poin 9-13 menjadi satu rujukan detail dengan contoh.
* Jadi referensi tunggal untuk reviewer (Ridwan Architecture Reviewer) dan
  AI agent saat menilai kepatuhan kode baru.

---

# Keputusan yang Sudah Terkunci (dari Baseline)

| Topik | Keputusan | Sumber |
|-------|-----------|--------|
| Domain module layout & public API via `index.ts` | `monorepo-setup.md`, ADR-026 |
| Naming komponen PascalCase / folder-helper kebab-case / peletakan `components/` via LCA | ADR-069 |
| Persona & role canonical names (Raka, Maya, Sinta, Dimas, Lara / Account Owner, Admin, Creator) | ADR-074, AGENTS.md rule 11 |
| Port lokal + composition root untuk komunikasi cross-domain tanpa import konkret | ADR-078 |

---

# Keputusan Code Conventions (Ditetapkan di Dokumen Ini)

| ID | Topik | Keputusan |
|----|-------|-----------|
| CC-D01 | Error hierarchy | `AppError` → `ApplicationError` → 5 subclass tetap; `XxxDomainError` per domain terpisah |
| CC-D02 | Server Action error boundary | Server Action yang mengembalikan `{ error }` wajib `try/catch` + `toActionError()`. Action `void` / `redirect` / `null` tidak diubah kontraknya |
| CC-D03 | Naming — variables/functions | camelCase, verb-first untuk fungsi, boolean prefix `is`/`has`/`should` |
| CC-D04 | Naming — types/interfaces | PascalCase, tanpa prefix `I` untuk types/interfaces domain baru |
| CC-D05 | Naming — files/folders | Pointer ke ADR-069/`monorepo-setup.md` — tidak diduplikasi di sini |
| CC-D06 | Function-writing structure | Validasi/otorisasi dulu (throw early) → orchestration → return; pure function dipisah dari service class |

---

# Error Handling

## Hierarki (CC-D01)

Lokasi: `apps/web/src/lib/utils/errors.ts`.

```
Error (native)
  └── AppError                  (base, punya field `code: string`)
        └── ApplicationError    (marker class, tanpa constructor sendiri)
              ├── AuthorizationError    ("AUTHORIZATION_ERROR")
              ├── NotFoundError         ("NOT_FOUND_ERROR")
              ├── ValidationError       ("VALIDATION_ERROR")
              ├── ConflictError         ("CONFLICT_ERROR")
              └── ExternalServiceError  ("EXTERNAL_SERVICE_ERROR")
```

**Aturan:** Application Service **melempar** subclass `ApplicationError`
yang sesuai untuk error yang harus sampai ke boundary UI/API dengan pesan
aman. Application Service **tidak pernah** menangkap error domain-nya
sendiri — biarkan naik ke entry point (Server Action/Route Handler) untuk
diterjemahkan sesuai kebutuhan masing-masing (structured response, HTTP
status, error UI state) — sesuai "Error Handling Strategy" yang sudah
ditetapkan di `application-layer.md`.

## Domain Errors per-BC

Tiap 9 domain module (`identity`, `workspace`, `publishing`,
`ai-assistant`, `engagement`, `analytics`, `start-page`, `media`,
`notification`) punya `errors.ts` sendiri dengan `XxxDomainError extends
Error` (**bukan** `extends AppError`) — contoh: `PublishingDomainError`,
`WorkspaceDomainError`, `IdentityDomainError`.

**Kapan pakai yang mana:**

* **`XxxDomainError`** — untuk validasi invariant murni di level
  entity/domain logic yang tidak tahu-menahu soal HTTP/UI (mis. dipakai di
  unit test domain logic tanpa mock infrastruktur).
* **`ApplicationError` subclass** — untuk error yang perlu sampai ke
  boundary UI/API dengan pesan yang aman ditampilkan ke user.

## Server Action Error Boundary (CC-D02)

Kontrak: `toActionError(error: unknown): { error: string }` —

* Kalau `error instanceof ApplicationError` → return `{ error:
  error.message }`.
* Selain itu → **re-throw** (error tak terduga tidak disembunyikan; Next.js
  menangani sebagai crash/error boundary, bukan pesan halus ke user).

Fungsi ini menggantikan logic `instanceof`/switch yang **dulu diduplikasi
identik** di beberapa file `actions.ts` (`settings`, `settings/members`,
`sidebar-channels`, `publish/queue`) sebelum dikonsolidasi. **Jangan tulis
ulang logic mapping error manual per file baru** — selalu import
`toActionError` dari `apps/web/src/lib/utils/errors.ts`.

Kontrak ini **wajib** untuk Server Action yang mengembalikan `{ error }`
ke pemanggil. Jangan membungkus ulang action yang kontraknya bukan itu:
`markNotificationReadAction` mengembalikan `void` dan membiarkan error naik
(sesi kosong → `redirect("/login")`); `getCalendarPostAction` memetakan sesi
kosong ke `null`. Mengganti keduanya ke `toActionError()` mengubah kontrak
pemanggil.

Karena `toActionError` meneruskan `error.message` apa adanya ke client:
**pesan error yang di-throw dari Application Service harus aman untuk
ditampilkan ke user** — jangan bocorkan detail internal (query, stack,
secret) di dalam `message`.

## Route Handler Error Handling

Route Handler (webhook Outstand) punya kontrak error sendiri, sudah
didokumentasikan di `integration-layer.md` — tidak diduplikasi di sini.

---

# Naming Conventions

## Variables & Functions (CC-D03)

* camelCase.
* Fungsi verb-first: `getX`, `createX`, `listX`, `parseX` — contoh nyata:
  `getMonthRange`, `getWeekRange`, `parseCalendarViewState`,
  `getDashboardSummaryAction`, `getCachedSession`.
* Boolean: prefix `is`/`has`/`should` (mis. `isReadyToPublishNow`) — aturan
  ini berlaku going-forward untuk kode baru.
* Server Action: suffix `Action` (`getDashboardSummaryAction`,
  `switchWorkspaceAction`) — konsisten dengan pola yang sudah ada.

## Types & Interfaces (CC-D04)

* PascalCase, **tanpa** prefix `I` untuk types/interfaces domain baru (mis.
  `PostMetricsPort`, `ScheduledCountsPort` — bukan `IPostMetricsPort`).
* `IOutstandAdapter` (kontrak ACL eksternal besar) adalah **exception
  historis** — bukan pola untuk ditiru di tempat lain, hanya nama yang
  sudah kadung dipakai luas sejak awal.

## Domain Module & File Naming (CC-D05)

Pointer eksplisit — **jangan diduplikasi di sini**, ikuti aturan Opsi A
yang sama yang berlaku antar baseline docs, bukan cuma context/ index
files:

* File/folder komponen React: `monorepo-setup.md` section `## src/app/ —
  App Router Structure` + ADR-069.
* Domain module & public API: ADR-026, `ctx-implementation.md`.

---

# Function-Writing Conventions (CC-D06)

**Struktur Application Service method:** validasi/otorisasi dulu (throw
early) → orchestration → return. Jangan campur validasi di tengah-tengah
logic orchestration — bikin alur sulit dibaca dan gagal-cepat jadi tidak
jelas.

**Composition root pattern:** instansiasi service dengan dependency-nya
(repository, port) terjadi di `page.tsx`/`actions.ts`/`layout.tsx` — bukan
di dalam domain module itu sendiri. Preseden: ADR-078 (port lokal +
composition root untuk `ScheduledCountsPort`).

**Pure function untuk logic tanpa I/O:** logic yang tidak butuh akses
database/network ditulis sebagai pure function terpisah dari service class
— importable dan testable tanpa mock apapun. Contoh nyata:
`getMonthRange`/`getWeekRange` (`calendar-range.ts`),
`parseCalendarViewState`.

---

# Decision Log

| ID | Keputusan | Alasan | Alternatif |
|----|-----------|--------|-----------|
| CC-D01 | Hierarki error 2 lapis (`AppError`/`ApplicationError` + `XxxDomainError` per domain) | Sudah terbukti konsisten dipakai di 9 domain, tidak perlu didesain ulang | Satu hierarki error tunggal lintas domain (ditolak — domain invariant errors punya kebutuhan beda dari boundary errors) |
| CC-D02 | `toActionError()` wajib pada Server Action yang mengembalikan `{ error }` | Mencegah duplikasi logic mapping error. Action `void` / `redirect` / `null` tidak dipaksa mengikuti helper ini | Mapping error manual per file; membungkus setiap action tanpa melihat kontrak return |
| CC-D04 | Tanpa prefix `I` untuk interface baru | Konsisten dengan mayoritas kode existing (`PostMetricsPort`, dst.) | Prefix `I` konsisten mengikuti `IOutstandAdapter` (ditolak — exception itu sendiri historis, bukan pola yang disengaja) |

---

# Related Documents

* `../05-architecture/application-layer.md` — kontrak error handling per layer (rujukan asli komentar `errors.ts`)
* `rendering-strategy.md` — Server Action error boundary (RS-D01)
* `monorepo-setup.md`, ADR-069 — file/folder naming lengkap
* `../../project-os/decisions/ADR-078-amandemen-adr-018-port-lokal-composition-root-scheduled-counts.md`
* `../../project-os/decisions/ADR-095-*.md` (dokumen ini ditetapkan sebagai baseline)
