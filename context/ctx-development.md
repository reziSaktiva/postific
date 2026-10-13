# Context — Development

Indeks **Developer Experience**, perintah lokal/CI, dan **aturan coding / konvensi**.  
Pola “fitur ditaruh di mana / alur call” → `ctx-implementation.md`.  
Stack & env → `ctx-technical-context.md`.

---

## Baca dulu

| Dokumen                                                                                                                  | Topik                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| [`../product-discovery/06-engineering/dx-tooling.md`](../product-discovery/06-engineering/dx-tooling.md)                 | ESLint, Prettier, Lefthook, Vitest, script (ADR-034)                                  |
| [`../product-discovery/06-engineering/rendering-strategy.md`](../product-discovery/06-engineering/rendering-strategy.md) | Server Component vs Client, Server Actions, streaming, SSR/SSG/ISR (ADR-016, ADR-095) |
| [`../product-discovery/06-engineering/code-conventions.md`](../product-discovery/06-engineering/code-conventions.md)     | Naming, error handling hierarchy (ADR-095)                                            |
| [`cicd-pipeline.md`](../product-discovery/06-engineering/cicd-pipeline.md)                                               | Gates CI yang sama dengan lokal                                                       |
| [`monorepo-setup.md`](../product-discovery/06-engineering/monorepo-setup.md)                                             | Layout workspace & TypeScript                                                         |
| [`../README.md`](../README.md)                                                                                           | Setup cepat root                                                                      |

Config di repo: `eslint.config.*`, `prettier.config.*`, `lefthook.yml`, `vitest.config.ts` (root).

---

## Perintah inti

| Tujuan          | Perintah                                  |
| --------------- | ----------------------------------------- |
| Dev server      | `bun run dev`                             |
| Typecheck       | `bun run typecheck`                       |
| Lint            | `bun run lint` / `bun run lint:fix`       |
| Format          | `bun run format` / `bun run format:check` |
| Test            | `bun run test`                            |
| Prisma generate | `bun run db:generate`                     |
| Migrate (dev)   | `bun run db:migrate`                      |

Sebelum menganggap pekerjaan selesai: typecheck + lint (+ test bila menyentuh logic yang tercover) harus hijau.

---

## Aturan coding (operasional)

Aturan di bawah melengkapi hard rules di [`../AGENTS.md`](../AGENTS.md). Detail arsitektur tetap di baseline. Detail penuh rendering & error handling: `rendering-strategy.md`, `code-conventions.md`.

### Umum

1. Format & lint dipercayakan ke **Prettier + ESLint** — jangan reformatting massal di luar scope task.
2. TypeScript ketat: hindari `any`; prefer tipe dari `@postific/shared` untuk ID/enum lintas BC.
3. Jangan commit secret; jangan menambah dependency tanpa alasan jelas (ikuti
   `dependency-strategy.md`). shadcn/ui adalah kode sumber yang di-copy ke
   repo, bukan dependency package — tidak ada isu exact pin/Beta seperti
   Astryx sebelumnya (ADR-097).
4. Perubahan kecil & terfokus — jangan refactor spekulatif di luar task.
5. Komentar hanya untuk intent non-obvious; jangan komentar narasi ulang kode.

### UI / styling

6. shadcn/ui adalah fondasi komponen permanen (ADR-097, membalik ADR-041).
   Migrasi dari Astryx ke shadcn/ui selesai (ADR-097); detail status lihat
   `PROJECT_STATE.md` / `../project-manager/tasks/v07-astryx-shadcn-migration.md`.
7. Tailwind dipakai langsung sebagai styling komponen shadcn (bukan lagi
   layout-only seperti era Astryx).
8. Wrapper selektif tetap dipakai untuk komponen kritis/dipakai luas.
   `@stylexjs/stylex` sudah dihapus total dari dependency project (ADR-082,
   sekarang tidak relevan karena Astryx sendiri sudah tidak dipakai).

### Naming & file

9. Domain module: `apps/web/src/domains/<domain>/` — nama selaras BC (kebab/folder lowercase).
10. Public API domain diekspor dari `index.ts` module tersebut.
11. Shared types: `packages/shared` — nama jelas, tanpa logic bisnis.
12. Persona & role: pakai nama kanonikal (Raka, Maya, … / Account Owner, Admin, Creator — ADR-074).
13. Komponen React di `apps/web/src/app/` dan `src/components/`: file yang
    meng-export component pakai PascalCase, folder & file non-component
    (helper, Server Action, data map) tetap kebab-case; peletakan folder
    `components/` mengikuti lowest common ancestor (LCA) dari route
    pemakainya. Detail & contoh di `monorepo-setup.md` section
    `## src/app/ — App Router Structure` (ADR-069, resolusi KI-010).

### Struktur repository & use-case

14. Pola **Repository** (split interface domain ↔ implementasi Prisma) dan
    pola **use-case class terpisah** untuk alur dengan dependency kritis
    (mis. `IOutstandAdapter`) — didetailkan di `ctx-implementation.md`
    (bukan di sini, sesuai batas file pada `context/README.md`).

### Testing

15. Unit/domain test: **Vitest** (`bun run test`).
16. Test yang ditambah harus relevan dengan behavior yang diubah; jangan stub berlebihan tanpa nilai.
17. Service/use-case diuji dengan **fake repository** — bukan mock Prisma
    dan bukan DB nyata. Pola: factory function `createFakeRepository()`
    yang mengembalikan objek literal `implements IXxxRepository` dengan
    default no-op per method, lalu `overrides: Partial<IXxxRepository>`
    di-spread untuk test case tertentu. Preseden:
    `domains/publishing/services/publishing.service.test.ts`. Pola yang sama
    dipakai untuk double lokal `IOutstandAdapter` di use-case test (bukan
    singleton produksi — Fake produksi sudah dihapus, ADR-119).

### Git / PR (saat diminta user)

18. Commit hanya jika user meminta — Conventional Commits, imperative, fokus “why”.
19. Jangan `--no-verify` / force push ke main kecuali diminta eksplisit.

---

## Checklist sebelum selesai task kode

- [ ] Tidak melanggar hard rules `AGENTS.md` (entry point, domain imports, Prisma/Supabase batas)
- [ ] `bun run typecheck` hijau
- [ ] `bun run lint` hijau
- [ ] Test relevan hijau (jika ada)
- [ ] Jika menambah/mengubah komponen shadcn: smoke test UI + dark mode +
      Tailwind cascade layer + Next.js production build hijau
- [ ] Status task diupdate di `TASKS.md` **dan** `tasks/vXX-*.md` (ADR-062),
      `PROJECT_STATE.md` diupdate bila phase/milestone/Known Issues berubah,
      lalu entri baru di `COMPLETE_TASK.md` (ADR-061)

---

## Related context

- Pola implementasi fitur → `ctx-implementation.md`
- Stack / Prisma / env → `ctx-technical-context.md`
- Project OS → `ctx-project.md`
