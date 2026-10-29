## Decision ADR-149

### Title

Playwright (Chrome) Jadi Standar QA End-to-End untuk Setiap Tiket dan Spec yang Selesai; Berjalan di Local dan Staging (Mengamandemen CI-D02 dan CI-D06)

### Status

Accepted. Poin 6 dan 8 (pemicu `push` ke `staging`) diamandemen oleh ADR-150: pemicu menjadi `pull_request` ke `main`.

### Date

2026-10-28

### Context

QA end-to-end selama ini dilakukan manual lewat browser pane oleh Najwa atau agen utama (`.claude/agents/najwa-qa-engineer.md`), dan hasilnya hanya tercatat di tiket. T-164 (verifikasi staging Start Page) menunjukkan dua kelemahan: pengecekan tidak bisa diulang persis (urutan klik, header, CSP diperiksa ad hoc), dan tidak ada gerbang otomatis yang menahan regresi saat promosi ke `main`.

`cicd-pipeline.md` menyebut E2E browser (Playwright/Cypress) "di luar scope MVP CI" dan CI-D06 menetapkan PR CI tanpa secret app/DB. Fakta baseline yang membatasi rancangan:

- Local dan staging memakai satu project Supabase yang sama, tanpa isolasi data (ADR-081, EM-D06).
- Aplikasi butuh Supabase dan `OUTSTAND_API_KEY` yang asli untuk berjalan; fake adapter Outstand di jalur produksi dilarang (ADR-119).
- Railway auto-deploy hanya dari branch `staging` dan `main`; tidak ada preview per-PR (CI-D04, ADR-029).

### Decision

1. **Alat:** Playwright dengan **Google Chrome** (`channel: "chrome"`) untuk QA end-to-end. Firefox/WebKit tidak termasuk standar (cek lintas-browser tetap tiket tersendiri, mis. T-171.2).
2. **Wajib per tiket/spec:** setiap tiket fitur yang selesai menambah minimal satu tes E2E **golden path**, dan seluruh suite (regresi) wajib hijau. Spec multi-sesi memuat jahitan tes E2E-nya di bagian "Jahitan tes".
3. **Target:** `local` (`http://localhost:3000`) dan `staging` (Railway), dipilih lewat `E2E_BASE_URL`.
4. **Akun test:** satu akun khusus yang disiapkan King Rezi, kredensialnya hanya di `apps/web/.env.local` (gitignored) dan GitHub Secrets; tidak pernah di repo, log, atau chat. Dilarang memakai akun atau password nyata King Rezi.
5. **Isolasi data:** karena local dan staging berbagi satu DB, tes hanya menyentuh workspace milik akun test, memberi awalan `e2e-` pada data yang dibuat, dan membersihkan data itu sendiri. Tes tidak mempublikasikan ke akun media sosial nyata lewat Outstand.
6. **Gerbang CI:** workflow GitHub Actions terpisah menjalankan suite terhadap **staging setelah deploy** pada `push` ke `staging`. **Hasil hijau menjadi syarat PR promosi `staging` → `main`** (required status check). Job ini memakai GitHub Secrets staging dan tidak jalan pada `pull_request` (sesuai catatan CI-D06 tentang job ber-secret).
7. **Gerbang PR ke `staging`:** karena tidak ada preview per-PR dan CI tanpa secret, PR `feature/*` → `staging` **tidak** diblokir oleh E2E di CI. Gantinya, penulis tiket menjalankan suite di `local` sebelum meminta merge dan melaporkan hasilnya di deskripsi PR (aturan kerja, bukan gerbang otomatis).
8. **Amandemen baseline:** CI-D02 ditambah gerbang E2E (CI-D07); kalimat "E2E di luar scope MVP CI" dihapus; CI-D06 mengizinkan secret staging untuk job E2E pada `push` ke `staging`. Quality gates PR yang ada (typecheck, lint, test) tidak berubah.

### Reason

- Playwright memberi uji yang bisa diulang dan merekam trace, dan memakai Chrome yang sudah terpasang di mesin King Rezi tanpa unduhan browser (diverifikasi lewat smoke test T-172).
- Menguji staging setelah deploy adalah satu-satunya pilihan yang menjalankan kode yang benar-benar di-deploy tanpa melanggar ADR-081, ADR-119, dan CI-D04.
- Syarat di PR promosi ke `main` memberi gerbang otomatis di titik yang paling mahal bila rusak, tanpa menambah secret ke PR CI.

### Alternatives Considered

- **Build PR di runner terhubung ke DB staging** (gerbang tiap PR). Ditolak oleh King Rezi (2026-10-28) demi tidak menambah secret ke PR CI dan karena DB bersama local/staging berisiko tercemar oleh tes dari banyak PR.
- **Postgres service container di CI tanpa secret.** Ditolak: fitur yang butuh Supabase Storage/Realtime dan Outstand tidak bisa diuji, dan fake adapter dilarang (ADR-119).
- **Tetap manual lewat browser pane.** Ditolak: tidak bisa diulang dan tidak menjadi gerbang.

### Impact / Baseline yang diamandemen

- `product-discovery/06-engineering/cicd-pipeline.md`: CI-D02 (rujuk CI-D07), CI-D06, bagian "Di luar scope MVP CI".
- Aturan kerja: definisi "tiket selesai" memuat E2E (tiket T-176); definisi Najwa diperbarui atas permintaan eksplisit King Rezi saat tiket itu dikerjakan.
- Dependensi baru di `apps/web` (`@playwright/test`) dan folder `apps/web/e2e/` (S-002).
- Pengaturan GitHub (required status check pada `main`) dilakukan King Rezi atau atas izin eksplisit.
- Konsekuensi yang diterima: kode PR ke `staging` baru terbukti end-to-end setelah ter-merge dan ter-deploy, sehingga regresi bisa masuk `staging` dan tertahan di promosi ke `main`.

---
