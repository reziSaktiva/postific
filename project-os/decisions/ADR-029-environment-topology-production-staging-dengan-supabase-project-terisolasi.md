## Decision ADR-029

### Title

Environment Topology — Production + Staging dengan Supabase Project Terisolasi

### Status

Accepted

### Date

2026-07-17

### Decision

MVP menggunakan **dua environment persisten**:

- **Production** — melayani user nyata, di-deploy dari branch `main`.
- **Staging** — mirror struktural production untuk uji pra-rilis, di-deploy dari branch `staging`.

Setiap environment memiliki **project Supabase terpisah** (`social-media-prod`, `social-media-staging`) untuk isolasi data dan kredensial penuh. Setiap Railway environment berisi dua service: `web` (Next.js) dan `cron` (trigger background jobs via Railway Cron, selaras ADR-022).

Preview environment per-PR (ephemeral) tidak digunakan pada MVP.

Detail lengkap: `product-discovery/06-engineering/deployment-infrastructure.md` (DI-D02, DI-D03, DI-D04, DI-D05).

### Reason

- Staging sebagai mirror memungkinkan uji perubahan (termasuk migration) tanpa menyentuh data produksi.
- Project Supabase terpisah menjamin isolasi data dan mencegah staging membaca/menulis data prod.
- Dua tier persisten cukup untuk skala MVP tanpa overhead infra preview per-PR.

### Alternatives Considered

- Production-only — paling murah, tetapi tidak ada tempat uji aman sebelum rilis.
- Production + Staging + Preview per-PR — paling robust, tetapi kompleksitas dan biaya berlebih untuk fase MVP.
- Satu project Supabase dipakai bersama antar environment — lebih murah, tetapi berisiko staging menyentuh data produksi.

---
