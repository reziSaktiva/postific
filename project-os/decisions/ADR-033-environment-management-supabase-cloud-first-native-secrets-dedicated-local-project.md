## Decision ADR-033

### Title

Environment Management — Supabase Cloud-First, Native Secrets, Dedicated Local Project

### Status

Accepted — Amended by ADR-081 (2026-08-14)

### Date

2026-07-17

### Decision

- **Platform DB MVP:** seluruh tier (local, staging, production) memakai **Supabase Cloud**. Migrasi ke self-host dievaluasi kemudian setelah skema dan operasi cloud stabil — membutuhkan ADR terpisah.
- **Local:** project Supabase Cloud terpisah `social-media-local`; aplikasi Next.js di mesin developer via `.env.local`. Tidak memakai staging/prod sebagai DB local.
- **Secret management:** native only — Railway Variables (staging/prod), Supabase dashboard, `.env.local` (gitignored). Tanpa Doppler/Infisical/Vault di MVP.
- **Repo:** commit `.env.example` saja; secret tidak masuk Git; secret produksi tidak disimpan di PR CI (selaras CI-D06).

Detail lengkap: `product-discovery/06-engineering/environment-management.md` (EM-D01 s/d EM-D06).

### Reason

- Cloud-first mengurangi beban operasional solo developer saat skema masih berubah.
- Project local terpisah menjaga isolasi kredensial/data (selaras semangat ADR-029) tanpa memaksa Docker/Supabase CLI di fase ini.
- Native secrets cukup untuk skala solo MVP.

### Alternatives Considered

- Supabase CLI / Docker local sejak hari pertama — lebih dekat prod-self-host, tetapi menambah friction setup awal.
- Memakai staging sebagai DB local — risiko merusak data pra-rilis.
- Doppler/Infisical — bermanfaat saat kolaborator bertambah; overhead untuk solo MVP.
- Self-host Supabase sejak M7 — ops prematur sebelum skema stabil.

---
