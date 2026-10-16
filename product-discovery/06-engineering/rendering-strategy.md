# Rendering Strategy

Dokumen ini mendefinisikan strategi rendering Next.js App Router untuk
`apps/web`: kapan Server Component vs Client Component, kontrak Server
Actions, streaming/Suspense, dan kebijakan SSR/SSG/ISR.

Dokumen ini mengonkretkan pembagian entry point yang sudah ditetapkan
ADR-016 (`application-layer.md`) menjadi aturan operasional yang bisa
diikuti tanpa ambiguitas, dan melengkapi `monorepo-setup.md` (lokasi file
`actions.ts`, struktur App Router).

---

# Tujuan

* Mengonkretkan ADR-016 (Server Actions untuk mutation, Server Components
  untuk data fetching, Route Handlers untuk eksternal) menjadi aturan yang
  bisa diikuti tanpa ambiguitas.
* Mendokumentasikan pola `actions.ts` per-fitur yang sudah 100% konsisten
  di kode sebagai kontrak resmi, bukan sekadar kebiasaan.
* Menutup celah ambiguitas "Server Action dipakai untuk read" dengan aturan
  eksplisit going-forward.
* Menetapkan default no-streaming/no-static hari ini secara sadar (bukan
  lupa dikonfigurasi), dan menandai kapan itu boleh berubah.

---

# Keputusan yang Sudah Terkunci (dari Baseline)

| Topik | Keputusan | Sumber |
|-------|-----------|--------|
| Entry point split | Server Actions untuk mutation, Route Handlers untuk eksternal (webhook/OAuth), Middleware untuk auth guard | ADR-016 |
| Application Service per BC, entry point tipis tanpa business logic | `application-layer.md`, AGENTS.md rule 5 |
| Domain logic tidak boleh import Prisma/Supabase/HTTP client | AGENTS.md rule 6, `ctx-implementation.md` |
| Workspace context via cookie `active-workspace-id`, divalidasi ulang tiap request | ADR-076, `auth-architecture.md` |
| Realtime dibatasi tabel spesifik (`notifications`, `publishing_posts`) — bukan strategi rendering halaman | ADR-023, ADR-094, `realtime-strategy.md` |

---

# Keputusan Rendering (Ditetapkan/Dikonkretkan di Dokumen Ini)

| ID | Topik | Keputusan |
|----|-------|-----------|
| RS-D01 | Server Actions | Eksklusif untuk **mutation**; satu file `actions.ts` per feature folder, tidak ada `"use server"` inline di komponen |
| RS-D02 | Reads di Server Component | Data fetching pada render page **wajib** panggil Application Service langsung (pola `calendar/page.tsx`), bukan Server Action |
| RS-D03 | Client Components | Hanya untuk state/interactivity/hooks/browser API; boundary sedalam mungkin (leaf component), bukan membungkus page |
| RS-D04 | Streaming/Suspense | Belum dipakai hari ini (keputusan sadar MVP); kriteria kapan wajib mulai dipertimbangkan |
| RS-D05 | SSR/SSG/ISR | 100% dynamic/SSR hari ini; SSG/ISR eksplisit di luar scope sampai ada rute publik nyata (T-070) |
| RS-D06 | Revalidation | `revalidatePath()` dipakai setelah mutation Server Action sukses; `revalidateTag`/`unstable_cache` belum dibutuhkan (bukan dilarang selamanya) |
| RS-D07 | Request-level de-dup | `React.cache()` untuk lookup non-fetch yang dipanggil berulang dalam satu render (preseden `getCachedSession()`) |
| RS-D08 | Rendering strategy rute publik | Tetap **terbuka** — pointer eksplisit ke T-070 (Start Page); jangan diasumsikan dari dokumen ini |

---

# Server Components vs Client Components (RS-D03)

**Default: Server Component.** Tambahkan `"use client"` hanya saat file itu
benar-benar butuh salah satu dari:

* `useState`/`useEffect`/hooks React lain
* Event handler interaktif (`onClick`, `onChange`, dst.)
* Browser-only API (`window`, `localStorage`, dst.)
* Komponen pihak ketiga yang mensyaratkan client runtime

**Fakta saat ini:** 34 file `"use client"` di codebase, mayoritas leaf UI
component. **1 exception ditemukan** (review arsitektur Ridwan, 2026-08-28):
`app/(app)/settings/account/preferences/page.tsx` punya `"use client"` di
baris pertama, membuat seluruh page jadi Client Component — menyimpang dari
RS-D03. Dicatat sebagai known exception (lihat Known Issue terkait di
`PROJECT_STATE.md`), belum diperbaiki di sesi ini.

**Aturan boundary:** push `"use client"` sedalam mungkin di component tree
(leaf, bukan wrapper besar), supaya sebagian besar tree tetap Server
Component — data fetching dekat sumbernya, JS yang dikirim ke browser
minimal.

**Larangan:** jangan tambahkan `"use client"` di file yang hanya meneruskan
props dari parent ke children tanpa state/interactivity sendiri — kalau
tree butuh interactivity di satu titik, taruh `"use client"` di titik itu
saja, bukan di ancestor-nya.

---

# Server Actions (RS-D01)

**Kontrak:** satu `actions.ts` per feature folder, co-located dengan
`page.tsx`/`components/`. Contoh path nyata yang sudah konsisten:

* `app/(app)/publish/queue/actions.ts`
* `app/(app)/publish/components/draft-editor/actions.ts`
* `app/(app)/settings/members/actions.ts`
* `app/(app)/dashboard-actions.ts`
* `app/onboarding/components/actions.ts`

**Scope: mutation saja.** Server Action **tidak** dipakai untuk fetch data
yang ditampilkan di initial render sebuah page — lihat RS-D02.

**Error handling:** Server Action yang mengembalikan `{ error }` wajib
`try/catch` dan return lewat `toActionError()` (detail kontrak di
`code-conventions.md` CC-D02) — jangan tulis ulang logic mapping error
manual per file. Action yang kontraknya `void`, `redirect`, atau `null`
tidak diubah supaya pemanggilnya tetap sama.

**Revalidation:** panggil `revalidatePath("<path>")` setelah mutation
sukses jika path itu menampilkan data yang berubah (contoh existing:
`/settings/members`, `/publish/queue`).

---

# Data Fetching di Server Component (RS-D02)

**Pola yang benar** (rujuk `app/(app)/publish/calendar/page.tsx`):
instansiasi Application Service langsung di `page.tsx` (composition root),
panggil method-nya, pass hasil sebagai props ke Client Component di
bawahnya. Ini pola yang harus diikuti untuk **semua page baru**.

**Pola yang menyimpang (known exception, jangan ditiru):**
`app/(app)/page.tsx` (dashboard) memanggil Server Action
(`getDashboardSummaryAction`) untuk pure read — dicatat sebagai technical
debt (lihat Known Issue terkait di `PROJECT_STATE.md`, dan tiket cleanup di
`tasks/`). **Bukan pola yang benar untuk dicontoh di fitur baru.**

**Alasan aturan ini:** Server Action membawa overhead POST + serialisasi
yang tidak perlu untuk read; Server Component sudah punya akses langsung ke
Application Service tanpa lapisan tambahan itu — selaras AGENTS.md rule 5.

---

# Streaming & Suspense (RS-D04)

**Status saat ini:** tidak dipakai sama sekali — 0 `loading.tsx`, 0
`<Suspense>` di seluruh `apps/web/src/app/`.

Ini **keputusan default MVP** (kesederhanaan di atas progressive rendering
saat ini), bukan keterbatasan teknis atau sesuatu yang terlewat.

**Kapan mulai wajib dipertimbangkan:**

* Page dengan data fetch yang lambat atau beberapa data source independen
  yang bisa di-render paralel (mis. dashboard multi-widget).
* Ada keluhan nyata soal waterfall/loading yang terasa lambat.

**Kalau nanti dipakai:** `loading.tsx` per route segment untuk instant
loading state; `<Suspense>` boundary granular untuk streaming partial UI.
Dicatat di sini sebagai pola yang tersedia dan diizinkan, bukan yang sudah
diaktifkan — jangan tambahkan tanpa kebutuhan konkret.

---

# SSR / SSG / ISR (RS-D05)

**Status saat ini:** 100% dynamic rendering (SSR on-demand). Tidak ada
`generateStaticParams`, `export const dynamic`, konfigurasi `fetch cache`,
atau `unstable_cache` di manapun. `next.config.ts` tidak mengaktifkan
experimental flag apapun (tidak ada PPR/`dynamicIO`/`cacheComponents`).

**Alasan:** seluruh route ada di balik auth + workspace context (data
personalized per-request) — SSG/ISR tidak applicable untuk app shell saat
ini. Ini status quo eksplisit, bukan lupa dikonfigurasi.

**Pengecualian terbuka:** Start Page / rute publik (v0.6, **T-070**).
Strategi rendering-nya (SSG/ISR/dynamic) **belum diputuskan** — jangan
diasumsikan dari dokumen ini. URL publik sudah dikunci di ADR-128
(`/u/[slug]`). Strategi SSG/ISR/dynamic masih terbuka dan akan mendapat
ADR sendiri saat diputuskan.

---

# Middleware & Workspace Context

Ringkas — detail penuh ada di `auth-architecture.md`/`ctx-architecture.md`,
tidak diduplikasi di sini:

* Middleware melakukan auth guard + resolve workspace context dari cookie
  `active-workspace-id`, divalidasi ulang terhadap `workspace_members` tiap
  request (ADR-076).
* `getCachedSession()` (`apps/web/src/lib/better-auth/session.ts`)
  membungkus session lookup dengan `React.cache()` untuk de-dup per-request
  (RS-D07) — preseden yang sama dipakai kalau ada lookup lain yang perlu
  di-dedupe dalam satu render.

---

# Decision Log

| ID | Keputusan | Alasan | Alternatif |
|----|-----------|--------|-----------|
| RS-D01 | Server Actions eksklusif mutation | Mencegah drift seperti kasus dashboard terulang di fitur baru | Membolehkan Server Action untuk read juga (ditolak — overhead POST tidak perlu) |
| RS-D02 | Data fetching page.tsx via Application Service langsung | Selaras AGENTS.md rule 5, sudah terbukti di `calendar/page.tsx` | Tetap lewat Server Action seperti dashboard (ditolak — pola menyimpang, tidak direplikasi) |
| RS-D04 | Streaming/Suspense belum diaktifkan | Kesederhanaan MVP, belum ada kebutuhan nyata | Aktifkan proaktif di semua page (ditolak — kompleksitas tanpa manfaat terukur saat ini) |
| RS-D05 | 100% dynamic, SSG/ISR di luar scope | Seluruh route personalized per-request di balik auth | Kunci strategi rute publik sekarang (ditolak — T-070 belum diputuskan) |

---

# Related Documents

* `../05-architecture/application-layer.md` — kontrak service & entry point (ADR-016)
* `code-conventions.md` — kontrak error handling Server Action (CC-D02)
* `monorepo-setup.md` — struktur `app/`, penamaan file
* `../../context/ctx-implementation.md` — alur implementasi fitur
* `../../project-manager/decisions/ADR-016-application-layer-next-js-entry-point-strategy.md`
* `../../project-manager/decisions/ADR-095-*.md` (dokumen ini ditetapkan sebagai baseline)
