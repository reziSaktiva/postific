## Decision ADR-128

### Title

Strategi routing halaman publik Start Page — subpath `/u/[slug]` (bukan custom domain) (T-070)

### Status

Accepted

### Date

2026-10-16

### Decision

Halaman publik Start Page (satu-satunya halaman produk yang diakses tanpa
autentikasi, lihat `tasks/v06-start-page-mvp.md`) diakses lewat **subpath di
domain utama**: `postific.com/u/[slug]`, bukan custom domain per workspace
(mis. `raka.me`).

Route `/u/[slug]` **di-bypass penuh** dari auth gate di `proxy.ts` — masuk ke
`BYPASS_PREFIXES` (pola sama seperti `/invite/[token]`, T-093.1/ADR-080),
**bukan** ke `PUBLIC_AUTH_PATHS` (yang efek sampingnya me-redirect user yang
sudah login ke `/` — tidak cocok untuk halaman publik yang memang harus bisa
dibuka siapa pun, login atau tidak). Server Component halaman itu sendiri
yang resolve data lewat use-case publik (`GetPublicStartPageBySlug`), tanpa
bergantung pada workspace context Middleware.

Custom domain per workspace **eksplisit Out of Scope** untuk rilis v0.6 ini.

### Reason

- MVP butuh jalan tercepat untuk Definition of Done rilis v0.6: "pengguna
  dapat membagikan halaman publik melalui media sosial" — subpath tidak
  butuh infra DNS/SSL/Host-header routing tambahan, bisa langsung
  memakai pola bypass route publik yang sudah terbukti jalan (`/invite`).
- Custom domain menambah kompleksitas signifikan: verifikasi kepemilikan
  domain, provisioning SSL otomatis (mis. lewat Vercel/Railway domain API),
  dan routing berbasis `Host` header di Middleware — tidak proporsional
  untuk MVP yang baru butuh 1 halaman publik.
- King Rezi memilih opsi ini secara eksplisit lewat `AskUserQuestion` saat
  breakdown subtask T-070 diminta (2026-10-16), dari 3 opsi yang diajukan:
  subpath (dipilih), custom domain, atau keduanya dengan custom domain
  opsional/disiapkan skema-nya saja.

### Alternatives Considered

- **Custom domain per workspace** — ditolak untuk MVP ini karena kompleksitas
  verifikasi domain + SSL + Host-header routing tidak sepadan dengan scope
  v0.6. Tetap dipertimbangkan sebagai item Post-MVP kalau ada kebutuhan
  konkret dari user (branding penuh).
- **Keduanya, custom domain opsional (skema disiapkan, provisioning menyusul)**
  — ditolak karena menambah 1 subtask "persiapan" tanpa manfaat langsung di
  rilis ini; lebih sederhana menambahkannya nanti sebagai task baru kalau
  benar-benar dibutuhkan, mengikuti YAGNI.

### Related

- `tasks/v06-start-page-mvp.md` § T-070 — subtask breakdown (T-070.1–.7)
  yang mengikuti keputusan ini.
- `apps/web/src/proxy.ts` — pola bypass `/invite/[token]` yang direplikasi
  untuk `/u/[slug]` (T-070.4).
- `product-discovery/05-architecture/auth-architecture.md` — baseline
  Middleware strategy (route groups, `BYPASS_PREFIXES` vs `PUBLIC_AUTH_PATHS`)
  yang jadi acuan pola ini.
- ADR-080 — preseden bypass route publik (`/invite/[token]`) yang jadi
  model untuk `/u/[slug]`.
