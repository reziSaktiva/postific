## Decision ADR-081

### Title

Project Supabase Cloud Existing ("Sosial Media Management") Resmi Ditetapkan Sebagai Staging — Amandemen EM-D02 (ADR-033)

### Status

Accepted

### Date

2026-08-14

### Context

**ADR-033** (EM-D02) menetapkan tiga project Supabase Cloud terpisah per
tier: `social-media-local`, `social-media-staging`, `social-media-prod`.

Realitas operasional saat penutupan KI-025 (Railway staging live,
2026-08-14): project Supabase Cloud yang **sudah ada sebelumnya**
("Sosial Media Management", ref `ndcrkzqgqukqfmekgoze`, region
`ap-southeast-1` Singapore) — yang sebelumnya dipakai untuk kebutuhan
local/dev — dipasang langsung sebagai database **staging** di Railway
Variables (`DATABASE_URL`/`DIRECT_URL`/`SUPABASE_*` environment
`staging`), bukan membuat project Supabase Cloud baru bernama
`social-media-staging` sesuai EM-D02 asli. Ini sudah dicatat sebagai
gap terhadap EM-D02 di `PROJECT_STATE.md` (KI-028) dan `COMPLETE_TASK.md`.

King Rezi mengonfirmasi eksplisit (2026-08-14): pemakaian project existing
ini sebagai staging adalah keputusan **permanen**, bukan shortcut
sementara yang akan dirapikan kembali ke pola tiga-project-terpisah.

Project untuk **production** belum dibuat sama sekali — tetap terbuka
sebagai KI-028, di luar cakupan amandemen ini. **DI-D03**
(`deployment-infrastructure.md` — project Supabase terpisah per
environment _deploy_: staging vs production) **tidak berubah** dan tetap
berlaku penuh: staging dan production tetap wajib dua project berbeda.

### Decision

Amandemen terhadap **EM-D02** (`environment-management.md`, ditetapkan
ADR-033):

1. Project Supabase Cloud existing **"Sosial Media Management"**
   (ref `ndcrkzqgqukqfmekgoze`, region `ap-southeast-1`) resmi ditetapkan
   sebagai **project staging** — menggantikan rencana lama membuat project
   baru bernama `social-media-staging`. Project ini tidak lagi dianggap/
   disebut sebagai project "local".
2. Tidak ada lagi project Supabase Cloud khusus bernama `social-media-local`
   yang akan dibuat terpisah dari staging — rencana pembuatannya di EM-D02
   asli **dibatalkan**.
3. Production **tetap** wajib project Supabase Cloud terpisah (tidak boleh
   berbagi dengan staging) — konsisten dengan DI-D03 yang tidak diamandemen
   di sini. Pembuatannya masih pending, dicatat KI-028.

4. Local development (`bun run dev` di laptop) resmi **menumpang** ke
   project staging yang sama — bukan project terpisah. Developer mengisi
   `.env.local` dengan kredensial project **"Sosial Media Management"**
   (ref `ndcrkzqgqukqfmekgoze`) yang persis sama dengan yang dipakai
   Railway staging. Tidak ada isolasi database antara tier local dan
   staging — keduanya benar-benar satu project Supabase yang sama.
   Keputusan ini menutup open question yang sebelumnya tercatat di ADR
   ini (dikonfirmasi eksplisit King Rezi, 2026-08-14, alasan: efisiensi
   operasional — project ini baru satu-satunya yang aktif, tidak perlu
   dipersulit dengan project ketiga).

**Konsekuensi yang disadari dan diterima (bukan dianggap kesalahan):**

- Eksperimen/migrasi skema yang dijalankan developer secara lokal
  (`prisma migrate dev`, seed, reset data uji coba) langsung menyentuh
  database yang sama dengan staging — tidak ada sandbox terpisah.
  Perubahan skema lokal yang belum matang bisa mempengaruhi staging, dan
  sebaliknya data uji coba staging terlihat oleh developer saat run lokal.
- EM-D06 (larangan berbagi secret lintas tier) **tidak berlaku penuh**
  untuk pasangan local↔staging — ini adalah pengecualian sadar terhadap
  EM-D06, bukan pelanggaran; EM-D06 tetap berlaku penuh untuk
  staging↔production (DI-D03 tidak berubah, isolasi itu tetap wajib).
- Karena tidak ada isolasi, developer harus lebih hati-hati saat
  menjalankan `prisma migrate reset` atau operasi destruktif lain secara
  lokal — akan langsung berdampak pada staging (lihat juga baris "Seed /
  reset" di `environment-management.md`, tetap berlaku: hati-hati, jangan
  reset staging sembarangan, dan ini sekarang termasuk saat reset "local").
- Kalau di masa depan kebutuhan isolasi jadi nyata (mis. kolaborator
  developer bertambah, atau eksperimen migrasi berisiko tinggi mulai
  sering terjadi), keputusan ini perlu ditinjau ulang lewat ADR baru —
  bukan diasumsikan berubah sendiri.

Body ADR-033 sendiri **tidak diedit** — hanya kolom Status di
`DECISIONS.md` ditandai `Accepted — Amended by ADR-081 (2026-08-14)`,
mengikuti pola ADR-066/067, ADR-071/075, ADR-076/077, ADR-018/078.

### Reason

- Efisiensi — project Supabase Cloud existing sudah sehat, terverifikasi
  end-to-end (Railway staging live + job runner sukses 2x run), dan berada
  di region yang benar (Singapore, selaras ADR-028/DI-D01). Membuat project
  `social-media-staging` baru dan memindahkan data/koneksi tidak menambah
  nilai pada tahap ini.
- Menghindari duplikasi kerja setup ulang (schema, RLS, storage bucket,
  Realtime) yang sudah berjalan di project existing.
- Tidak mengubah prinsip isolasi produksi (DI-D03) — hanya menyesuaikan
  bagaimana slot "staging" diisi, bukan menghapus kebutuhan project
  terpisah untuk production.

### Alternatives Considered

- Tetap ikuti EM-D02 asli — buat project baru `social-media-staging` dan
  migrasikan data/konfigurasi dari project existing — ditolak: kerja
  migrasi tanpa manfaat nyata untuk MVP solo developer, project existing
  sudah terverifikasi sehat.
- Buat project baru untuk local terpisah dari staging, kembalikan ke pola
  tiga-project — **ditolak** (keputusan final, 2026-08-14): menambah
  kerumitan setup/maintenance project ketiga tidak sepadan untuk MVP solo
  developer; King Rezi memilih kesederhanaan operasional meski
  konsekuensinya local dan staging berbagi satu database yang sama.

### Impact / Baseline yang diamandemen

- `project-os/DECISIONS.md` — baris ADR-033: Status diubah jadi
  `Accepted — Amended by ADR-081 (2026-08-14)`; baris indeks ADR-081
  ditambahkan.
- `product-discovery/06-engineering/environment-management.md` — EM-D02
  dan bagian terkait (diagram tier, tabel tier, alur setup local, secret
  management) diupdate merefleksikan amandemen ini, ditandai
  `(Amandemen ADR-081)`.
- `project-os/PROJECT_STATE.md` — KI-028 tetap terbuka (production
  project belum dibuat); tidak ada perubahan status/phase lain.
- Tidak menyentuh **DI-D03** (`deployment-infrastructure.md`) — isolasi
  staging↔production tetap wajib project terpisah, tidak diamandemen.
- Tidak mengubah kode runtime — murni penyesuaian baseline dokumentasi
  terhadap keputusan operasional yang sudah berjalan.

---
