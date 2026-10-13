## Decision ADR-119

### Title

Hapus `FakeOutstandAdapter` dari jalur produksi — `OUTSTAND_API_KEY` wajib
(amandemen mekanisme switch ADR-059)

### Status

Accepted

### Date

2026-09-25

### Decision

Real OutstandAdapter (T-025) sudah hidup di jalur produksi. Fallback ke
`FakeOutstandAdapter` saat `OUTSTAND_API_KEY` kosong (ADR-059 poin 3) tidak
lagi pantas: kredensial sudah tersedia, dan Fake di jalur produksi
meninggalkan jejak data (`outstand_post_id` `fake-post-…`, URL
`https://fake.outstand.local/…`) di database bersama dev/staging (ADR-081).

1. **`getOutstandAdapter()` hanya mengembalikan `RealOutstandAdapter`.**
   Kalau `OUTSTAND_API_KEY` kosong atau whitespace setelah trim, factory
   **throw error jelas** yang menyebut nama env var — bukan fallback ke
   Fake. Ini mengamendemen mekanisme switch ADR-059 poin 3 (dan catatan
   switch yang merujuk pola itu di ADR-079, ADR-105, ADR-106, ADR-108,
   ADR-110).
2. **Kelas produksi `FakeOutstandAdapter` dihapus**
   (`fake-outstand-adapter.ts` + tes singleton-nya). Tes use-case /
   service **tidak** mengimpor singleton produksi itu; double lokal yang
   sudah ada di file tes (mis. `createFakeOutstandAdapter` di use-case
   test, fungsi lokal `fakeOutstandAdapter` di
   `workspace.service.test.ts`) **tetap**.
3. **Poin 5 dan 6 ADR-059 tidak dicabut** — Use Case terpisah untuk
   dependency adapter, dan guard ownership di level repository, tetap
   berlaku.
4. **Pembersihan data sekali jalan** di database bersama
   dev/Railway-staging (Supabase "Sosial Media Management", ref
   `ndcrkzqgqukqfmekgoze`, ADR-081): baris
   `publishing_posts.outstand_post_id` seperti `fake-post-%`,
   `publishing_post_targets.platform_post_url` seperti
   `https://fake.outstand.local/%` atau `retry_outstand_post_id` seperti
   `fake-post-%`, plus baris yang menggantung — bukan migrasi Prisma.

### Reason

* Real adapter sudah ada; fallback Fake hanya berguna saat kredensial
  belum tersedia. Mempertahankannya di jalur produksi menyembunyikan
  misconfig env (app "berhasil" tanpa key) dan mengotori DB bersama.
* Throw loud saat key kosong menjadikan kegagalan eksplisit — selaras
  semangat "throw loud" ADR-059, hanya untuk kondisi yang sekarang
  relevan (key wajib, bukan "key terisi tapi real belum ada").
* Double lokal di tes tetap mencukupi untuk unit test tanpa mengikat
  produksi ke implementasi Fake.

### Alternatives Considered

* **Pertahankan Fake untuk local tanpa key** — ditolak: local dan staging
  berbagi satu DB; Fake lokal tetap menulis `fake-post-…` ke data yang
  sama dipakai staging.
* **Feature-flag / env `USE_FAKE_OUTSTAND=1`** — ditolak: menambah jalur
  produksi kedua yang mudah lupa dimatikan; throw tanpa key lebih sederhana
  dan lebih aman.
* **Hapus Fake + biarkan factory return `null` / optional** — ditolak:
  call site domain mengasumsikan adapter selalu ada; throw di factory
  lebih jelas daripada null-check tersebar.

### Consequences

* Dev/staging **wajib** punya `OUTSTAND_API_KEY` valid untuk jalur yang
  memanggil `getOutstandAdapter()` (Engage, Draft Schedule/Publish, jobs
  Outstand, dsb.).
* Rule 19 `AGENTS.md` diganti: jangan membangun Fake di jalur produksi
  untuk kapabilitas Outstand baru; key wajib; tes pakai double lokal.
* Catatan switch Fake di ADR lama (079/105/106/108/110) bersifat historis —
  tidak ditulis ulang; status operasional mengikuti ADR-119.
* `connect-state.ts` tetap (Real adapter masih memakai
  `parseBase64UrlJson`); hanya komentar yang mengikatnya ke Fake yang
  dibersihkan.
