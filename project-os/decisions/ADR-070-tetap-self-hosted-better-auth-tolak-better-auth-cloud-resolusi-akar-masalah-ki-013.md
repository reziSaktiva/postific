## Decision ADR-070

### Title

Tetap Self-Hosted Better Auth, Tolak Better Auth Cloud — Resolusi Akar Masalah Dependency Ngrok di Dev (Terkait KI-013)

### Status

Accepted

### Date

2026-08-06

### Context

King Rezi mengeluhkan proses dev jadi merepotkan karena auth "mengharuskan"
tunnel ngrok setiap kali autentikasi diuji di dev mode — sering lupa
menjalankan tunnel, tunnel mati, dan menyebabkan agent (Claude Code)
berulang kali gagal login lewat link `localhost`.

Penelusuran menemukan bahwa baseline resmi project ini (`auth-strategy.md`,
ADR-024) mendeskripsikan Better Auth sebagai **library self-hosted** —
instance dibuat langsung di kode (`apps/web/src/lib/better-auth/auth.ts`),
`BETTER_AUTH_URL` hanya env var biasa yang dibaca app, tanpa validasi ke
platform eksternal manapun. Sesuai desain ini, `http://localhost:3000` valid
dipakai untuk dev — tidak ada requirement ngrok.

Namun project ini ternyata sempat memakai **Better Auth Cloud** (produk
hosted resmi dari Better Auth, terpisah dari library open-source) tanpa
pernah tercatat sebagai keputusan di ADR manapun. Dashboard Better Auth
Cloud menolak Base URL non-publik dengan pesan: _"Base URL must be a public
http(s) URL. Private networks, localhost, and link-local hosts are not
allowed"_ — field ini **required**. Itulah sumber sebenarnya requirement
ngrok, bukan keterbatasan library `better-auth` maupun bug tersembunyi.

Alasan awal memakai Better Auth Cloud: tidak ada — King Rezi mengonfirmasi
ini murni belum tahu ada constraint tersebut, tanpa kebutuhan fitur spesifik
dari Better Auth Cloud yang mengharuskan dashboard tersebut.

Efek samping requirement ini juga bersinggungan dengan KI-013 (hydration
gagal saat diakses lewat tunnel ngrok) — QA (Najwa) terpaksa selalu
memverifikasi browser lewat ngrok (`QA_TEST_ACCOUNTS.md`) karena mengikuti
constraint Better Auth Cloud tersebut, bukan karena Better Auth (self-hosted)
memang tidak bisa membaca cookie di `localhost`.

### Decision

1. **Berhenti memakai Better Auth Cloud.** Kembali ke Better Auth
   **self-hosted** (npm library `better-auth`) sesuai desain asli ADR-024 /
   `auth-strategy.md` — tidak ada perubahan arsitektur, karena ini memang
   baseline yang sudah dirancang sejak awal dan belum pernah benar-benar
   dijalankan sesuai desainnya.
2. Instalasi dilakukan di komputer lokal King Rezi sendiri — `bun run dev`
   di `localhost:3000`, `BETTER_AUTH_URL=http://localhost:3000`,
   `BETTER_AUTH_SECRET` digenerate sendiri (bukan dari dashboard Cloud).
   Database tetap Supabase Cloud (sesuai rencana yang sudah ditetapkan),
   diakses via Prisma seperti biasa (AS-D01) — tidak perlu Railway untuk
   dev.
3. Saat nanti pindah ke Railway (staging/production), yang berubah hanya
   env var (`BETTER_AUTH_URL`, secret) per tabel `environment-management.md`
   — bukan migrasi arsitektur. `BETTER_AUTH_API_KEY` **wajib tetap tidak
   diset** di Railway Variables staging maupun production — kalau terisi
   (sengaja atau terwarisi), plugin `dash` di `auth.ts` aktif kembali dan
   mengulang constraint Base URL publik dari Better Auth Cloud yang baru
   dihindari lewat ADR ini.

### Reason

- Self-hosted Better Auth adalah baseline yang sudah dirancang lengkap
  (dual-context RLS AS-D01–D06, RBAC Middleware AU-D01–D11, Bearer plugin
  mobile ADR-043) — kembali ke jalur ini nol biaya migrasi kode/arsitektur.
- Requirement ngrok terbukti berasal dari constraint platform Better Auth
  Cloud (Base URL wajib publik), bukan dari library `better-auth` itu
  sendiri maupun bug hydration yang perlu di-root-cause lebih lanjut.
- Tidak ada kebutuhan fitur yang mengharuskan Better Auth Cloud — biaya
  (friction dev, ngrok efemeral, hydration gagal) jauh lebih besar dari
  manfaat yang didapat.

### Alternatives Considered

- **Migrasi ke Supabase Auth.** Dipertimbangkan di awal diskusi karena
  gejalanya (harus pakai ngrok) tampak seperti keterbatasan inheren Better
  Auth. Ditolak setelah akar masalah teridentifikasi sebagai constraint
  Better Auth Cloud (bukan Better Auth secara umum) — migrasi ini akan
  memaksa redesain dual-context RLS, JWT bridge Realtime (AS-D03), Bearer
  plugin mobile (ADR-043), dan migrasi data user existing, untuk masalah
  yang ternyata bisa diselesaikan tanpa mengubah baseline sama sekali.
- **Tetap pakai Better Auth Cloud, cari workaround ngrok** (tunnel
  permanen/reserved domain, dsb). Ditolak — tidak menghilangkan
  ketergantungan pada layanan eksternal yang tidak dibutuhkan, dan tetap
  mewarisi risiko KI-013 (hydration gagal lewat tunnel) setiap kali
  verifikasi browser dilakukan.

### Impact / Baseline yang diamandemen

Tidak ada — keputusan ini **menegaskan kembali** baseline ADR-024 /
`auth-strategy.md` yang sudah ada, bukan mengubahnya. Tidak ada dokumen
baseline yang perlu diedit.

### Catatan implementasi

- KI-013 (`PROJECT_STATE.md`) tetap dicatat terpisah — root cause "kenapa
  ngrok jadi wajib" sudah terjawab lewat ADR ini, tetapi bug hydration
  spesifik saat diakses lewat tunnel ngrok itu sendiri belum perlu
  ditelusuri lebih lanjut karena ngrok tidak lagi dipakai untuk dev/testing
  begitu self-hosted Better Auth berjalan normal di `localhost`.
- `QA_TEST_ACCOUNTS.md` (bagian "Kenapa testing browser pakai ngrok") perlu
  ditinjau ulang begitu instalasi self-hosted selesai dan terverifikasi
  jalan di `localhost` — kemungkinan besar catatan ngrok-wajib di sana
  sudah tidak berlaku.
- Instalasi self-hosted dilakukan mandiri oleh King Rezi di komputer
  lokal — belum ada perubahan kode yang dieksekusi AI per keputusan ini.

---
