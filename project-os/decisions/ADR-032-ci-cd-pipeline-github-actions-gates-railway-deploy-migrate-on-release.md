## Decision ADR-032

### Title

CI/CD Pipeline — GitHub Actions Gates + Railway Deploy + Migrate on Release

### Status

Accepted

### Date

2026-07-17

### Decision

Pipeline CI/CD MVP:

- **CI tooling:** GitHub Actions (`.github/workflows/`).
- **Quality gates pada PR** ke `staging` / `main`: install (frozen lockfile) → Prisma generate/validate → typecheck → lint → test. Merge diblokir jika gates gagal.
- **Promosi kode:** `feature/*` → `staging` → `main` (verifikasi di staging sebelum production).
- **CD:** tetap **Railway auto-deploy** dari branch (`staging`→staging, `main`→production) — selaras DI-D05; GitHub Actions tidak melakukan deploy aplikasi.
- **Migrasi:** `prisma migrate deploy` dijalankan di **Railway release/pre-start** per environment memakai `DIRECT_URL` environment tersebut — bukan dari job Pull Request.

Detail lengkap: `product-discovery/06-engineering/cicd-pipeline.md` (CI-D01 s/d CI-D06).

### Reason

- Memisahkan tanggung jawab: GitHub Actions menjaga kualitas sebelum merge; Railway menjalankan artefak di environment yang benar.
- Staging sebagai gerbang uji (ADR-029) sebelum production.
- Migrate terikat deploy environment yang sama dengan kode — mengurangi drift skema vs aplikasi.
- Secret DB produksi tidak perlu masuk ke runner PR CI.

### Alternatives Considered

- CI+CD penuh di GitHub Actions (deploy via Railway API) — menduplikasi kontrol deploy yang sudah ada di Railway.
- Hanya mengandalkan build Railway tanpa PR gates — kode rusak bisa langsung masuk branch environment.
- Menjalankan `migrate deploy` dari job PR — risiko menulis DB dari branch yang belum di-merge; secret DB di GitHub lebih dini dari yang perlu.
- Preview environment per-PR — ditolak di ADR-029.

---
