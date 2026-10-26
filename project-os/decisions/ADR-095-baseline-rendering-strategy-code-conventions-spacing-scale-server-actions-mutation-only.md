## Decision ADR-095

### Title

Baseline Rendering Strategy, Code Conventions, dan Spacing Scale — Server Actions Khusus Mutation (Konkretisasi ADR-016)

### Status

Accepted

### Date

2026-08-28

### Context

Codebase ini sudah punya konvensi rendering, error handling, dan spacing
yang matang dan konsisten secara de facto, tapi belum pernah dituliskan
sebagai baseline resmi — hanya tersirat dari kode:

- **Server Actions**: 9 file `"use server"`, 100% dalam file `actions.ts`
  terpisah per fitur, tidak ada yang inline di komponen.
- **Error handling**: hierarki matang di `apps/web/src/lib/utils/errors.ts`
  (`AppError` → `ApplicationError` → 5 subclass) + `XxxDomainError` per 9
  domain + helper `toActionError()` — dipakai di mayoritas Server Action.
  **Koreksi (review Ridwan, 2026-08-28):** belum 100% universal — 3 file
  (`draft-editor/actions.ts`, `settings/account/actions.ts`,
  `onboarding/components/actions.ts`) belum migrasi ke `toActionError()`,
  dicatat sebagai technical debt pra-existing di `code-conventions.md`.
- **Spacing**: 100% pakai prop numerik Astryx (`gap={n}`/`padding={n}`),
  bukan Tailwind class mentah — hanya 2 baris exception di
  `ChannelsSection.tsx`. Nilai yang benar-benar dipakai sudah membentuk
  skala konsisten (0/0.5/1/1.5/2/3/4/5/6/8 unit × 4px = 0–32px), sementara
  `design-tokens.md` masih menandai skala ini `TBD` sejak ADR-038.
- **Layering domain**: diverifikasi 0 pelanggaran — tidak ada file di
  `apps/web/src/domains/**` yang import `@prisma/client`/
  `@supabase/supabase-js` langsung.
- **Raw `<div>`**: diverifikasi 0 pemakaian di `apps/web/src/app/**/*.tsx`.
- **Arbitrary Tailwind value**: 7 pemakaian total di seluruh
  `apps/web/src`, semuanya token-backed CSS variable yang legit
  (transition/shadow/easing), bukan angka ajaib.

Satu inkonsistensi nyata ditemukan: `app/(app)/page.tsx` (dashboard) fetch
data lewat Server Action (`getDashboardSummaryAction`) untuk pure read —
pola yang menyimpang dari `app/(app)/publish/calendar/page.tsx` yang
memanggil Application Service langsung dari Server Component (pola yang
benar sesuai AGENTS.md rule 5). ADR-016 sudah menetapkan "Server Actions
untuk mutations" dan "Server Components untuk data fetching", tapi tidak
eksplisit melarang pola campuran ini — celah inilah yang menghasilkan
inkonsistensi di dashboard.

King Rezi memutuskan mengodifikasi tiga area ini (rendering strategy, code
conventions, spacing scale) sebagai dokumen baseline formal di
`product-discovery/06-engineering/`, mengunci skala spacing berdasarkan
pemakaian nyata, dan menegaskan kembali (bukan mengubah) aturan Server
Actions = mutation-only sebagai rule yang mengikat ke depan — sekaligus
menyertakan enforcement tooling (ESLint) untuk sebagian aturan ini.

### Decision

1. Baseline dokumen baru ditetapkan: `rendering-strategy.md` dan
   `code-conventions.md` di `product-discovery/06-engineering/` — status
   Accepted sebagai baseline, isi sesuai dokumen tersebut (tidak diulang
   di ADR ini).
2. Section `Spacing` di `design-tokens.md` dikunci: base unit 1 Astryx unit
   = 4px, skala terpakai 0/0.5/1/1.5/2/3/4/5/6/8 (0–32px), `TBD` lama
   dihapus, panduan semantik penggunaan ditambahkan. Section `Radius`/
   `Elevation` **tetap** `TBD` — tidak dikunci di ADR ini.
3. **Server Actions eksklusif untuk mutation** dikodifikasi sebagai aturan
   mengikat ke depan (memperjelas, bukan mengubah, ADR-016): data fetching
   pada render page **wajib** memanggil Application Service langsung dari
   Server Component (composition root pattern, pola
   `publish/calendar/page.tsx`), bukan lewat Server Action.
4. Pola `app/(app)/page.tsx` (dashboard) yang memanggil
   `getDashboardSummaryAction` untuk pure read **diakui sebagai exception
   pra-existing** yang menyimpang dari aturan poin 3 — **tidak** diperbaiki
   sebagai bagian ADR ini; dicatat sebagai Known Issue baru di
   `PROJECT_STATE.md` dan task cleanup terpisah di `TASKS.md`.
5. `AppError`/`ApplicationError` hierarchy dan pola `toActionError()`
   dikodifikasi sebagai kontrak error handling resmi lintas Server Action
   (rujuk `code-conventions.md` CC-D01/CC-D02).
6. **Enforcement tooling** ditambahkan ke `eslint.config.mjs` (3 rule,
   diverifikasi 0 pelanggaran existing sebelum diaktifkan sebagai
   `"error"`):
   - `no-restricted-imports` di `apps/web/src/domains/**` — block
     `@prisma/client`, `@supabase/supabase-js`, dan import langsung ke
     `lib/repositories/**`/`lib/adapters/**`/`lib/prisma/**`/
     `lib/supabase/**`/`**/generated/**` (menegakkan AGENTS.md rule 6).
   - `no-restricted-syntax` — block `<div>` mentah di
     `apps/web/src/app/**/*.tsx` dan `apps/web/src/components/**/*.tsx`
     (menegakkan `apps/web/.claude/CLAUDE.md`).
   - `tailwindcss/no-arbitrary-value: "error"` (sebelumnya `off` di
     `recommended` config) — 5 pemakaian token-backed di 2 file diberi
     `eslint-disable-next-line` + komentar alasan.
   - **Follow-up (2026-08-28) — 2 custom rule lokal ditambahkan** untuk
     menutup known-limitation yang ditemukan review Ridwan, tanpa
     dependency baru (didefinisikan inline sebagai plugin lokal di
     `eslint.config.mjs`):
     - `local/no-dynamic-restricted-import` — menutup celah
       `no-restricted-imports` yang hanya menjangkau static import;
       sekarang dynamic import (`await import("@prisma/client")`) ke
       target yang sama juga tertangkap di domain layer. Diverifikasi
       lewat probe file (dibuat lalu dihapus). Re-export pass-through
       tidak langsung via file perantara **tetap** tidak terjangkau
       (butuh analisis lintas-file, di luar scope lint per-file).
     - `local/no-arbitrary-value-in-variable` — menutup celah
       `tailwindcss/no-arbitrary-value` yang hanya menganalisis literal
       langsung di atribut `className`; sekarang arbitrary-value yang
       disimpan di `const`/assignment terpisah juga tertangkap. Menangkap
       `TRANSITION_FAST` (`ChannelsSection.tsx`) yang sebelumnya lolos —
       diberi `eslint-disable-next-line` karena token-backed, legit.
   - **Sengaja tidak dikerjakan** (dicatat sebagai deferred): boundary
     cross-domain via public API (AGENTS.md rule 7, butuh
     `eslint-plugin-boundaries` — dependency baru, perlu masuk
     `dependency-strategy.md` dulu) dan restriksi import HTTP client
     Outstand di domain layer (Real OutstandAdapter/T-025 belum ditulis,
     KI-003 — tidak ada yang bisa direstriksi).

### Reason

- Menuliskan konvensi yang sudah terbukti konsisten di kode nyata lebih
  murah dan lebih akurat daripada mendesain aturan baru dari nol —
  mengurangi risiko dokumen baseline menyimpang dari realita implementasi.
- Mengunci skala spacing menutup `TBD` yang sudah menggantung sejak
  ADR-038 tanpa memblokir development — nilai dikunci berdasar distribusi
  pemakaian nyata, bukan angka arbitrer.
- Menegaskan "Server Actions = mutation only" secara eksplisit mencegah
  drift lebih lanjut seperti kasus dashboard terulang di fitur baru, tanpa
  memaksa migrasi mendadak pada kode yang sudah berjalan.
- Memisahkan cleanup dashboard sebagai task independen menghindari ADR ini
  diblokir oleh scope refactor yang tidak berkaitan langsung dengan
  keputusan dokumentasi.
- Enforcement tooling dipilih hanya untuk 3 rule yang **terverifikasi 0
  pelanggaran existing** — supaya aktivasi rule baru tidak langsung
  memblokir CI dengan technical debt lama yang belum siap dibereskan.

### Alternatives Considered

- Memperbaiki dashboard sekaligus dalam ADR ini — ditolak; memperbesar
  scope perubahan kode dalam ADR yang niatnya dokumentasi + tooling,
  risiko regresi tidak perlu.
- Mengunci skala spacing ke daftar tertutup klasik (4/8/12/16/24/32/48
  saja, opsi lama di `design-tokens.md`) — ditolak; tidak merefleksikan
  pemakaian nyata yang sudah mencakup nilai pecahan (0.5, 1.5) untuk dense
  UI.
- Tidak menulis dokumen baru, cukup memperluas `ctx-development.md`/
  `ctx-implementation.md` — ditolak; melanggar aturan Opsi A (context files
  index-only, tidak boleh menyimpan detail baseline).
- Menambah `eslint-plugin-boundaries` sekarang untuk sekaligus menegakkan
  boundary cross-domain (rule 7) — ditolak; dependency baru butuh proses
  vetting `dependency-strategy.md` tersendiri, dipisah jadi follow-up.

### Impact / Baseline yang diamandemen

- `product-discovery/06-engineering/rendering-strategy.md` — baru,
  Baseline.
- `product-discovery/06-engineering/code-conventions.md` — baru, Baseline.
- `product-discovery/06-engineering/design-tokens.md` — section Spacing
  diamandemen (`TBD` dikunci); Radius/Elevation tidak berubah.
- ADR-016 — **tidak diamandemen isinya**, hanya diperjelas/dikonkretkan
  oleh `rendering-strategy.md` (cross-reference, bukan mengubah keputusan
  asli).
- `eslint.config.mjs` — 3 rule baru (domain import boundary, larangan
  `<div>`, `tailwindcss/no-arbitrary-value`).
- `context/ctx-development.md`, `context/ctx-implementation.md`,
  `AGENTS.md` — index/pointer ditambahkan ke 2 dokumen baru.
- `PROJECT_STATE.md` — 2 Known Issue baru (dashboard read-via-action;
  reminder sinkronisasi Claude Design untuk spacing token, pola ADR-056).
- `TASKS.md`/`tickets/v01-foundation.md` — task baru dicatat untuk
  deliverable ADR ini + subtask cleanup dashboard.

---
