# Environment Management

Dokumen ini mendefinisikan **katalog environment variables, strategi secret management, dan konfigurasi per tier** (local, staging, production) untuk produk Postific.

Dokumen ini menkonkretkan konsekuensi isolasi kredensial dari `deployment-infrastructure.md` (DI-D03, ADR-029) dan kebijakan secret CI dari `cicd-pipeline.md` (CI-D06). Hosting database MVP tetap **Supabase Cloud**; jalur migrasi ke self-host dicatat sebagai rencana pasca-stabilisasi skema, bukan bagian bootstrap M7.

---

# Tujuan

* Menetapkan sumber kebenaran penamaan env var untuk seluruh aplikasi.
* Memisahkan secret per environment (local / staging / production) tanpa berbagi kredensial.
* Mendefinisikan cara developer menjalankan app lokal terhadap Supabase Cloud.
* Menetapkan di mana secret disimpan (Railway, Supabase dashboard, `.env.local`) dan apa yang boleh masuk Git.
* Mencatat rencana cloud → self-host tanpa mengunci tooling self-host sekarang.

---

# Keputusan yang Sudah Terkunci (dari Baseline)

| Topik | Keputusan | Sumber |
|-------|-----------|--------|
| Topology deploy | Production + Staging (Railway) | ADR-029, DI-D02 |
| Supabase project | Terpisah per environment deploy | ADR-029, DI-D03 |
| Secret di PR CI | Tidak wajib / tidak menyimpan secret produksi | CI-D06, ADR-032 |
| DB runtime URLs | `DATABASE_URL` (pooled) + `DIRECT_URL` (migrate) | DO-D04, ADR-031 |
| Auth URLs & OAuth | `BETTER_AUTH_*`, Google OAuth terpisah per env | AS-D05, ADR-030 |

---

# Keputusan Environment Management (Ditetapkan di Dokumen Ini)

| ID | Topik | Keputusan |
|----|-------|-----------|
| EM-D01 | Platform DB MVP | **Supabase Cloud** untuk local, staging, dan production. Self-host ditunda sampai skema & operasi cloud stabil (lihat bagian Cloud → Self-host). |
| EM-D02 | Local database *(Amandemen ADR-081 — final 2026-08-14)* | ~~Project Supabase Cloud terpisah `social-media-local`.~~ Project Supabase Cloud **existing** ("Sosial Media Management", ref `ndcrkzqgqukqfmekgoze`, region `ap-southeast-1`) resmi ditetapkan sebagai project **staging** — bukan lagi disebut/dipakai sebagai project "local". Tidak ada lagi rencana membuat project `social-media-local` baru. **Final:** local development resmi **menumpang** ke project staging yang sama — developer mengisi `.env.local` dengan kredensial project staging ini, tanpa isolasi database local↔staging. Lihat bagian Environment Tiers. |
| EM-D03 | Secret management | **Native only** — Railway Variables (staging/prod), Supabase dashboard (kredensial project), `.env.local` (local, gitignored). Tanpa Doppler/Infisical/Vault di MVP. |
| EM-D04 | File env di repo | Lokasi: `apps/web/`. Commit `.env.example` (placeholder, tanpa secret). Jangan commit `.env`, `.env.local`, `.env.*.local`. |
| EM-D05 | Validasi env | Fail-fast di server startup untuk required server vars; client hanya boleh membaca `NEXT_PUBLIC_*`. |
| EM-D06 | Isolasi kredensial | Satu set secret per tier; **dilarang** menyalin secret production ke local/staging atau sebaliknya. **Pengecualian eksplisit (ADR-081):** pasangan local↔staging dikecualikan dari aturan ini secara sadar — local sengaja menumpang ke project staging yang sama (lihat EM-D02, EM-D09/EM-D10). EM-D06 tetap berlaku penuh untuk staging↔production dan local↔production — tidak dikecualikan. |

---

# Environment Tiers

> **Amandemen ADR-081 (final 2026-08-14):** diagram dan tabel di bawah
> mencerminkan realita terkini — project Supabase Cloud existing ("Sosial
> Media Management", ref `ndcrkzqgqukqfmekgoze`) resmi jadi project
> **staging**, menggantikan rencana `social-media-local` +
> `social-media-staging` terpisah. **Local development resmi menumpang ke
> project staging yang sama** — bukan lagi open question.

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│ Local           │     │ Staging          │     │ Production        │
│ Next.js @ :3000 │     │ Railway staging  │     │ Railway production│
│ .env.local      │     │ Railway Variables│     │ Railway Variables │
└────────┬────────┘     └────────┬─────────┘     └─────────┬─────────┘
         │                       │                         │
         └───────────┬───────────┘                         ▼
                      ▼                          ┌───────────────────┐
         ┌──────────────────────────┐            │ social-media-prod │
         │ Sosial Media Management  │            │ (belum dibuat —   │
         │ ref ndcrkzqgqukqfmekgoze │            │ KI-028)            │
         │ (local + staging, satu   │            └───────────────────┘
         │ project yang sama)       │
         └──────────────────────────┘
```

| Tier | Compute | Supabase project | Sumber env |
|------|---------|------------------|------------|
| Local | `bun run dev` di laptop | **"Sosial Media Management"** (ref `ndcrkzqgqukqfmekgoze`) — **project yang sama dengan staging**, tidak ada isolasi (ADR-081, final) | `.env.local` — diisi kredensial project staging |
| Staging | Railway env `staging` (`web` + `cron`) | **"Sosial Media Management"** (ref `ndcrkzqgqukqfmekgoze`, project existing — bukan project baru `social-media-staging`) *(ADR-081)* | Railway Variables |
| Production | Railway env `production` (`web` + `cron`) | `social-media-prod` — **belum dibuat**, lihat KI-028 di `PROJECT_STATE.md` | Railway Variables |

**Aturan:**
- Preview environment per-PR tetap tidak dipakai (ADR-029).
- Region project Supabase mengikuti Singapore/SEA (ADR-028); project staging existing berada di `ap-southeast-1`, production wajib mengikuti region yang sama saat dibuat.
- Production **tetap wajib** project Supabase terpisah dari staging/local (DI-D03, tidak diamandemen) — larangan berbagi project dengan staging/local tetap berlaku penuh untuk production.
- Local dan staging **sengaja berbagi satu project Supabase yang sama** (ADR-081, final 2026-08-14) — keputusan sadar King Rezi demi kesederhanaan operasional, bukan open question lagi. Konsekuensi: tidak ada isolasi data/skema antara local dan staging; lihat catatan risiko di bagian "Alur Setup Local" dan ADR-081.

---

# Secret Management (EM-D03)

| Lokasi | Isi | Siapa yang mengisi |
|--------|-----|-------------------|
| Supabase dashboard (per project) | URL, anon key, service role, JWT secret, connection strings | Developer saat membuat project |
| Railway Variables (per environment + per service jika perlu) | Seluruh runtime + migrate secrets untuk staging/prod | Developer saat setup Railway |
| `.env.local` (mesin developer) | Salinan kredensial project **staging** (ref `ndcrkzqgqukqfmekgoze`) + OAuth/dev secrets — local menumpang ke staging, tidak ada project local terpisah (ADR-081, final) | Developer; tidak di-commit |
| GitHub Actions | Tidak menyimpan secret app/DB untuk MVP PR gates | — (CI-D06) |
| Git | Hanya `.env.example` | Repo |

**Praktik:**
- Rotasi secret dilakukan per environment (mis. rotate `BETTER_AUTH_SECRET` staging tanpa menyentuh production).
- Setelah rotate, redeploy Railway environment terkait agar proses memuat nilai baru.
- Jangan paste secret ke chat, issue, atau dokumen project.

---

# File Strategy (EM-D04)

| File | Di Git? | Peran |
|------|---------|-------|
| `.env.example` | Ya | Template nama var + komentar; nilai dummy / kosong |
| `.env.local` | Tidak | Local override untuk Next.js / Bun |
| `.env` | Tidak | Hindari; prefer `.env.local` agar tidak bentrok dengan convention Next |
| Railway / Supabase UI | N/A | Sumber kebenaran staging & production |

Lokasi file di monorepo (ditetapkan M7): **`apps/web/`** — `.env.example` (di Git) dan `.env.local` (gitignored) hidup di samping app Next.js agar env dimuat secara native tanpa wiring ekstra dari root. `.env.example` harus mencerminkan lokasi yang sama.

---

# Katalog Environment Variables

## Server (wajib di runtime web)

| Variable | Local | Staging | Production | Keterangan |
|----------|-------|---------|------------|------------|
| `DATABASE_URL` | local pooled | staging pooled | prod pooled | Supavisor transaction mode — Prisma runtime, Better Auth |
| `DIRECT_URL` | local direct | staging direct | prod direct | Session/direct — `prisma migrate` |
| `SUPABASE_URL` | local project URL | staging URL | prod URL | Platform API (Realtime, Storage) |
| `SUPABASE_SERVICE_ROLE_KEY` | local | staging | prod | **Server only** — jangan expose ke browser |
| `SUPABASE_JWT_SECRET` | local JWT secret | staging | prod | Sign JWT Supabase-compatible (AS-D03) |
| `BETTER_AUTH_SECRET` | unik local | unik staging | unik prod | Min. entropy tinggi; generate terpisah |
| `BETTER_AUTH_URL` | `http://localhost:3000` | `https://staging.<domain>` | `https://<production-domain>` | Base URL Better Auth + OAuth callback |
| `BETTER_AUTH_API_KEY` | tidak diset | **tidak diset** | **tidak diset** | Wajib kosong di semua env (ADR-070) — kalau terisi, plugin `dash` (Better Auth Cloud) aktif dan mensyaratkan Base URL publik |
| `GOOGLE_CLIENT_ID` | OAuth client local/dev | OAuth staging | OAuth prod | Client terpisah atau redirect URI terpisah per env (AS-D05) |
| `GOOGLE_CLIENT_SECRET` | local/dev | staging | prod | Pasangan client di atas |
| `OUTSTAND_API_KEY` | sandbox/local key | staging key | prod key | Integrasi Outstand |
| `OUTSTAND_WEBHOOK_SECRET` | local | staging | prod | Verifikasi HMAC webhook |
| `JOB_SECRET` | local | staging | prod | Header `X-Job-Secret` untuk trigger cron → web |

**Tidak ada env var X/Twitter Client ID atau Client Secret.** BYOK X dikonfigurasi Project Owner langsung di dashboard Outstand per environment. Secret tersebut tidak disalin ke `.env.local`, Railway Variables, GitHub Actions, database, atau aplikasi.

## Client (boleh di-bundle)

| Variable | Keterangan |
|----------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL project — sama nilai dengan `SUPABASE_URL` tier terkait; dipakai browser client Realtime/Storage bila diperlukan |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (pengganti anon/public key pada sistem API key Supabase terbaru) — **bukan** service role; dilindungi RLS |

Hanya prefix `NEXT_PUBLIC_` yang boleh dibaca di Client Components. Service role, DB URLs, auth secrets, Outstand secrets, dan `JOB_SECRET` **wajib** server-only.

## Opsional / deferred

| Variable | Status |
|----------|--------|
| Provider email transactional (`RESEND_API_KEY`, dll.) | Belum ditetapkan (AS-D04) — ditambahkan ke katalog saat provider dipilih |
| `NODE_ENV` | Diatur runtime (`development` / `production`) — tidak perlu diisi manual di Railway kecuali override khusus |

---

# Perbedaan Konfigurasi per Tier

| Aspek | Local | Staging | Production |
|-------|-------|---------|------------|
| HTTPS | HTTP `localhost` | HTTPS Railway | HTTPS Railway |
| Cookie `Secure` | `false` (HTTP) | `true` | `true` |
| `BETTER_AUTH_URL` | `http://localhost:3000` | URL staging publik | URL production |
| Google redirect | `http://localhost:3000/api/auth/callback/google` | staging callback | production callback |
| Migrate | `prisma migrate dev` → project staging (menumpang, ADR-081 final) | `prisma migrate deploy` di Railway release | sama, project prod |
| Seed / reset | **Hati-hati** — database sama dengan staging (menumpang, ADR-081), jangan reset sembarangan | Hati-hati; jangan reset sembarangan | Dilarang reset |
| Cron (`JOB_SECRET`) | Boleh panggil manual / script | Railway Cron → `web` | Railway Cron → `web` |

Implementasi cookie local vs HTTPS harus selaras `auth-strategy.md` — staging/production memakai `useSecureCookies: true`; local memakai konfigurasi non-secure untuk HTTP.

---

# Alur Setup Local (Acuan M7)

> **Amandemen ADR-081 (final 2026-08-14):** langkah 1 di bawah (buat project
> Supabase Cloud khusus `social-media-local`) sudah tidak berlaku — rencana
> itu dibatalkan seiring project existing dipakai sebagai staging. **Local
> development resmi menumpang ke project staging yang sama** (ref
> `ndcrkzqgqukqfmekgoze`) — bukan open question lagi. Developer mengisi
> `.env.local` dengan kredensial project staging tersebut.

1. ~~Buat project Supabase Cloud `social-media-local` (region Singapore/SEA).~~ **Dibatalkan (ADR-081)** — local resmi menumpang ke project staging existing, tidak ada project local terpisah.
2. Salin connection strings, URL, anon key, service role, JWT secret **project staging** (`ndcrkzqgqukqfmekgoze`) ke `.env.local`.
3. Salin `.env.example` → `.env.local`, isi semua required vars dengan nilai staging tersebut.
4. Buat OAuth Google client (atau tambahkan redirect URI local) mengarah ke `http://localhost:3000/api/auth/callback/google`.
5. `bun install` → `bunx prisma migrate dev` (memakai `DIRECT_URL` staging — perubahan skema langsung berdampak ke staging, lihat catatan risiko di bawah).
6. `bun run dev` — verifikasi auth, Realtime (anon + JWT), dan Storage dasar.
7. Konfigurasikan X BYOK di dashboard Outstand untuk akun/environment test bila alur Twitter/X akan diverifikasi; jangan menyalin secret X ke file env aplikasi.

Developer **tidak** mengarah `DATABASE_URL` local ke **production** — itu
tetap dilarang mutlak. Local **boleh dan memang menumpang** ke project
staging (`ndcrkzqgqukqfmekgoze`) — keputusan final ADR-081 (2026-08-14).
**Konsekuensi yang perlu diingat setiap hari kerja:** tidak ada isolasi
data/skema antara local dan staging — migrasi, seed, atau reset yang
dijalankan dari laptop developer langsung menyentuh database yang sama
dengan yang dipakai Railway staging. Ini adalah trade-off yang disadari
demi kesederhanaan operasional (bukan kelalaian), tapi tetap hati-hati
saat menjalankan operasi destruktif secara lokal.

---

# Validasi Env (EM-D05)

Pada bootstrap server (`apps/web`):

* Validasi keberadaan required server vars saat proses start (fail-fast dengan pesan jelas).
* Jangan silent-fallback ke string kosong untuk secret.
* CI PR **tidak** membutuhkan nilai secret nyata — gates typecheck/lint/test/validate boleh memakai env dummy hanya jika suatu test benar-benar membacanya; prefer mock di unit test (lihat `dx-tooling.md`).

---

# Cloud → Self-host (Rencana, Bukan MVP)

| Fase | Platform | Catatan |
|------|----------|---------|
| MVP / M7–M9 | Supabase Cloud (`local`, `staging`, `prod`) | Fokus stabilkan skema Prisma, RLS, Realtime, Storage |
| Pasca skema stabil | Evaluasi self-host Supabase (atau Postgres + komponen setara) | Butuh ADR baru: hosting, backup, upgrade, secrets, region |

**Prinsip migrasi kelak:**
- Aplikasi hanya bergantung pada Postgres + API yang kompatibel (Prisma `DATABASE_URL`/`DIRECT_URL`, Supabase client untuk Realtime/Storage, JWT secret untuk Realtime).
- Self-host **tidak** mengubah katalog nama env var secara masif — yang berubah terutama *nilai* URL/keys dan operasional infra.
- Jangan mulai self-host sebelum migrate path, RLS, dan backup cloud terbukti lancar.

Keputusan self-host di masa depan wajib ADR di `DECISIONS.md`; dokumen ini hanya mengunci **cloud-first**.

---

# Decision Log

| ID | Keputusan | Alasan | Alternatif |
|----|-----------|--------|-----------|
| EM-D01 | Supabase Cloud untuk semua tier MVP; self-host ditunda | Kurangi beban ops awal; skema bisa distabilkan dulu | Self-host sejak hari pertama (ops berat); campur cloud/self-host per tier (kompleks) |
| EM-D02 | Project Cloud terpisah `social-media-local` — **diamandemen EM-D09/EM-D11/ADR-081, lihat baris di bawah** | Isolasi eksperimen dari staging/prod; tetap cloud-first | Pakai staging sebagai local (risiko data); Supabase CLI Docker (ops lokal lebih berat untuk fase ini) |
| EM-D03 | Secret native (Railway + Supabase + `.env.local`) | Cukup untuk solo MVP; zero tooling ekstra | Doppler/Infisical (nilai tambah belakangan jika kolaborator bertambah) |
| EM-D04 | `.env.example` + `.env.local` di `apps/web/`; secret file di-gitignore | Next.js memuat env dari app dir secara native; template onboarding tanpa membocorkan secret | Env di root monorepo (butuh wiring ekstra); commit `.env` terenkripsi (overhead); tanpa example (onboarding buram) |
| EM-D05 | Fail-fast validasi required server env | Gagal cepat lebih baik daripada runtime error samar | Optional env dengan default berbahaya |
| EM-D06 | Larangan berbagi secret lintas tier — **dikecualikan untuk pasangan local↔staging oleh EM-D11/ADR-081**, tetap berlaku penuh untuk staging↔production | Konsekuensi langsung DI-D03 / isolasi kredensial | Satu key dipakai semua env (blast radius besar) |
| EM-D07 | Tidak ada X client credential di env aplikasi | BYOK X dikelola manual di dashboard Outstand; mengurangi exposure secret |
| EM-D08 | ADR-040 | EM-D07 mengamandemen katalog/prasyarat integrasi Engineering Baseline |
| EM-D09 | Project Supabase existing ("Sosial Media Management", ref `ndcrkzqgqukqfmekgoze`) resmi jadi project staging; rencana project baru `social-media-local` dibatalkan | Efisiensi — project sudah ada dan sehat, sudah terverifikasi via Railway staging (KI-025); tidak perlu bikin project baru terpisah | Buat project `social-media-staging` baru sesuai EM-D02 asli (kerja migrasi tanpa manfaat nyata untuk MVP solo developer) |
| EM-D10 | ADR-081 | EM-D09 mengamandemen EM-D02 (ADR-033) | — |
| EM-D11 | Local development resmi menumpang ke project staging yang sama (ref `ndcrkzqgqukqfmekgoze`) — final, menutup open question yang tercatat di body ADR-081 | Efisiensi/kesederhanaan operasional (King Rezi, 2026-08-14) — project ini baru satu-satunya yang aktif, tidak perlu dipersulit dengan project ketiga | Project Supabase Cloud terpisah untuk local (kembali ke pola tiga-project asli EM-D02) — ditolak, kerumitan setup tidak sepadan untuk MVP solo developer |

---

# Related Documents

* `README.md` — scope dan workflow Engineering Planning
* `deployment-infrastructure.md` — topology Railway/Supabase, ringkasan secrets
* `auth-strategy.md` — `BETTER_AUTH_*`, OAuth, JWT Supabase-compatible
* `database-orm.md` — `DATABASE_URL` / `DIRECT_URL`, migrate
* `cicd-pipeline.md` — CI-D06, Railway memegang secret deploy
* `dx-tooling.md` — script local `dev`, `db:*`, test tanpa secret prod
* `../05-architecture/database-strategy.md` — platform data, RLS
* `../../project-manager/DECISIONS.md` — ADR-029, ADR-032, ADR-033 (Amended by ADR-081)
