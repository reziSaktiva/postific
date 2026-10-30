## Decision ADR-150

### Title

Gerbang E2E Staging Dipicu `pull_request` ke `main` (Bukan `push` ke `staging`); Mengamandemen ADR-149 Poin 6 dan 8, CI-D06, CI-D07

### Status

Accepted

### Date

2026-10-29

### Context

ADR-149 menetapkan workflow E2E berjalan pada `push` ke `staging`, menunggu Railway selesai deploy, lalu menguji staging. Percobaan pertama (PR 211, T-175) membuktikan rancangan itu buntu: Railway "Wait for CI" menahan deploy sampai semua workflow GitHub pada push yang sama selesai, sedangkan workflow E2E menunggu deploy itu. Deploy commit `33de237` tertahan berstatus `WAITING` selama 20 menit sampai workflow gagal karena batas waktu dan deploy-nya digantikan.

Fakta yang membatasi:

- `deployment_status` hanya memicu workflow bila berkasnya ada di branch default (`main`), jadi tidak bisa dipakai sebelum promosi pertama.
- Mematikan "Wait for CI" di Railway mengubah kebijakan deploy (Quality gates tidak lagi menahan deploy staging), di luar scope ADR-149.
- Required status check untuk PR `staging` → `main` dibaca pada SHA head PR, yaitu ujung `staging`.

### Decision

1. Workflow E2E dipicu oleh `pull_request` ke `main` (job hanya berjalan bila head PR adalah branch `staging`) dan `workflow_dispatch` untuk run manual. Pemicu `push` ke `staging` dihapus.
2. Workflow tetap menunggu deployment Railway (status deployment GitHub `Postific / staging`) untuk SHA head PR berstatus `success` sebelum menjalankan Playwright terhadap staging.
3. Hijau tetap menjadi required check untuk PR `staging` → `main`. _(Catatan: penerapannya ditunda sampai MVP public launch oleh ADR-151.)_ PR dari branch lain ke `main` (hotfix) melewati job ini.
4. Secret akun test dipakai pada PR dari branch `staging` di repo yang sama (event `pull_request` dari fork tidak menerima secret). CI-D06 diamandemen sesuai itu.
5. Semua keputusan lain ADR-149 tidak berubah (Chrome, akun test, isolasi data, tanpa gerbang E2E untuk PR `feature/*` → `staging`).

### Reason

- Event `pull_request` tidak ditunggu Railway, jadi tidak ada saling tunggu, dan Quality gates tetap menahan deploy staging seperti semula.
- Check menempel di SHA head PR sehingga langsung terbaca sebagai required check.
- E2E berjalan tepat di titik promosi, yaitu gerbang yang diminta ADR-149.

### Alternatives Considered

- **Mematikan "Wait for CI" di Railway.** Ditolak: mengubah kebijakan deploy staging.
- **`deployment_status`.** Ditolak: butuh berkas di `main`.
- **Tetap `push` dengan batas waktu lebih panjang.** Ditolak: buntu, bukan soal waktu.

### Impact / Baseline yang diamandemen

- `product-discovery/06-engineering/cicd-pipeline.md`: CI-D06, CI-D07, tabel trigger.
- `project-os/decisions/ADR-149-*.md` poin 6 dan 8 (catatan amandemen), `project-os/specs/S-002.md`, tiket T-175.
- Konsekuensi yang diterima: E2E baru berjalan saat PR promosi dibuka, bukan tiap merge ke `staging`; run pertama menunggu deploy staging terbaru selesai.

---
