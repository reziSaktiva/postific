# Context — Implementation

Indeks **cara menulis fitur di repo ini**: struktur folder, alur entry → service → domain → repository, dan larangan import.  
Konvensi gaya / DX → `ctx-development.md`.  
Keputusan arsitektur → `ctx-architecture.md`.

---

## Baca dulu

| Dokumen                                                                                                                  | Topik                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| [`../product-discovery/05-architecture/application-layer.md`](../product-discovery/05-architecture/application-layer.md) | Kontrak service, repository, entry points, error handling                                |
| [`../product-discovery/06-engineering/rendering-strategy.md`](../product-discovery/06-engineering/rendering-strategy.md) | Server Component/Server Action boundary saat menulis entry point baru (ADR-016, ADR-095) |
| [`domain-model.md`](../product-discovery/05-architecture/domain-model.md)                                                | BC & boundary                                                                            |
| [`integration-layer.md`](../product-discovery/05-architecture/integration-layer.md)                                      | Outstand ACL — saat sentuh publish/webhook/OAuth                                         |
| [`../product-discovery/06-engineering/monorepo-setup.md`](../product-discovery/06-engineering/monorepo-setup.md)         | Layout `apps/web`, `packages/shared`                                                     |

---

## Layout kode (ingat cepat)

```text
apps/web/
├── prisma/                  ← schema + migrations
├── src/
│   ├── app/                 ← Next.js App Router (entry points saja)
│   ├── domains/
│   │   ├── identity/
│   │   ├── workspace/
│   │   ├── publishing/
│   │   ├── mcp-access/
│   │   ├── engagement/
│   │   ├── analytics/
│   │   ├── start-page/
│   │   ├── media/
│   │   └── notification/
│   └── lib/                 ← prisma, better-auth, env, supabase stubs
packages/shared/             ← ID, enum, VO — tanpa business logic
```

Setiap domain module punya public surface via `index.ts` (dan types/errors sesuai scaffold M7).

---

## Alur implementasi fitur

```text
UI / Route / Server Action / Route Handler
    → Application Service (domain module)
        → Domain rules / entities
        → Repository interface → Prisma implementation (infrastructure)
```

Data fetching di Server Component (`page.tsx`) memanggil Application Service
langsung, **bukan** Server Action — detail di `rendering-strategy.md` (RS-D02).

Webhook / cron / eksternal → Route Handler atau job runner → Application Service
(bukan logic di handler). Khusus webhook Outstand, receipt wajib durable sebelum
ACK; pemrosesan domain berjalan sesudah ACK melalui job internal.

---

## UI Components (ADR-097, membalik ADR-041)

- **shadcn/ui adalah fondasi component system permanen** (ADR-097, membalik
  ADR-041). Migrasi dari Astryx ke shadcn/ui selesai (ADR-097); detail status
  lihat `PROJECT_STATE.md` / `../project-os/tickets/v07-astryx-shadcn-migration.md`
  § T-102; feature tidak menunggu design tokens final. Light/Dark Mode Toggle
  (ADR-055, diamandemen ADR-097) tetap
  fitur resmi — mekanismenya lewat Tailwind `dark:` + shadcn theme provider,
  `ThemeModeContext`/`useThemeMode` (`apps/web/src/components/Providers.tsx`)
  tidak berubah.
- `src/components/ui/` berisi wrapper/re-export **selektif** untuk komponen
  kritis, dipakai luas, default konsisten, atau adaptasi behavior produk.
- shadcn/ui adalah kode sumber yang di-_copy_ ke repo (bukan dependency
  package tertutup seperti Astryx dulu) — tidak ada isu versioning
  Beta/canary; komponen sederhana yang hanya dipakai lokal boleh diimpor
  langsung dari lokasi hasil copy-nya.
- Tailwind dipakai langsung sebagai styling utama komponen shadcn (bukan lagi
  layout-only seperti era Astryx dulu, ADR-097 poin 4).
- Nilai final `design-tokens.md` (co-equal dengan Claude Design, tidak
  menunggu designer eksternal — ADR-056, ADR-057) dipetakan ke CSS variable
  shadcn + Tailwind token bridge tanpa mengganti fondasi komponen.
- Penamaan & peletakan file/folder komponen (PascalCase untuk file yang
  meng-export component, kebab-case untuk folder & helper, peletakan
  `components/` berdasar lowest common ancestor pemakainya) mengikuti
  konvensi di `monorepo-setup.md` section `## src/app/ — App Router
Structure` (ADR-069, resolusi KI-010).

---

## Aturan operasional

1. Hard rules entry point / domain logic / cross-domain / shared types —
   lihat **`../AGENTS.md` rules 5-8**, tidak diulang di sini. (Server Actions
   khusus mutation — lihat `rendering-strategy.md`.)
2. **Satu Application Service per BC** — orchestrasi, otorisasi (RBAC), koordinasi repo.
3. **Repository**: dua lapis — interface (`IXxxRepository`) di
   `apps/web/src/domains/<domain>/repositories/`, implementasi Prisma nyata
   di `apps/web/src/lib/repositories/<domain>/`. Domain layer hanya
   bergantung ke interface (hard rule 6 `AGENTS.md` — domain tidak boleh
   impor Prisma langsung); Server Action/Application Service yang
   meng-_inject_ implementasi Prisma dari `lib/repositories`. Preseden:
   `domains/publishing/repositories/publishing.repository.ts` ↔
   `lib/repositories/publishing/`.
4. **Use-case class terpisah**: kalau sebuah alur butuh dependency tambahan
   yang wajib ada di constructor (mis. `IOutstandAdapter`) dan urutan
   operasinya kritis (persist dulu → panggil adapter → persist outcome),
   taruh sebagai use-case class terpisah (`xxx.use-case.ts`) — bukan method
   baru di service umum domain tersebut. Tujuannya supaya lupa pass
   dependency ketahuan TypeScript di call site (compile error), bukan baru
   meledak saat runtime. Preseden: `SchedulePostsUseCase`,
   `PublishNowUseCase`, `CancelScheduleUseCase`
   (`domains/publishing/services/*.use-case.ts`),
   `AnalyticsIngestionUseCase` (`domains/analytics/services/`).
5. **Outstand**: hanya lewat adapter/ACL — lihat `integration-layer.md`.
6. **Billing (BC-10)**: jangan diimplementasi sebagai fitur MVP kecuali keputusan berubah + ADR.
7. Schema DB: selaraskan dengan `database-strategy.md` + `schema.prisma`; migrasi lewat Prisma Migrate.
8. **Kontrak Outstand ADR-040:** jangan membuat handler webhook komentar/DM,
   jangan mengirim signed URL Supabase sebagai media publish, dan jangan
   meminta secret X dari user aplikasi. Gunakan tiga event webhook resmi,
   Outstand Media API working copy, comment sync 30 menit/manual refresh, serta
   X BYOK manual di dashboard Outstand.
9. Keberadaan kontrak dokumentasi atau schema **bukan** bukti runtime sudah
   diimplementasikan. Saat mulai M8, verifikasi service, adapter, handler, job,
   dan test yang benar-benar ada sebelum mengandalkannya.

---

## Checklist fitur baru (ringkas)

1. Identifikasi BC + baca service contract di `application-layer.md`.
2. Cek roles/status di `roles-permissions.md` jika menyentuh akses atau workflow konten.
3. Cek UX flow di `04-ux/` (pointer di `ctx-design.md`) jika ada UI.
4. Jika menyentuh Outstand, baca ADR-040 dan checklist kontrak di
   `ctx-architecture.md`.
5. Implement di `domains/<bc>/` + entry point tipis di `app/`.
6. Jika ada UI, ikuti boundary shadcn/Tailwind di atas dan UX Baseline melalui
   `ctx-design.md`.
7. Jalankan checklist di `ctx-development.md`.

---

## Related context

- Coding/DX → `ctx-development.md`
- Architecture “mengapa” → `ctx-architecture.md`
- Technical stack → `ctx-technical-context.md`
- Domain map → `ctx-domain.md`
