## Decision ADR-143

### Title

Keputusan Produk dan UI Start Page v0.6: Tema Preset Terbatas, Page Editor (Dialog, Simpan Draft, Avatar URL), RBAC Tiga Role, Satu Halaman per Workspace, dan Ikon Platform hugeicons (T-071 sampai T-074)

### Status

Accepted

### Date

2026-10-28

### Decision

Keputusan King Rezi selama implementasi T-071 sampai T-074, dikumpulkan di satu ADR. Rancangan layar tetap mengikuti ADR-129 (Card Stack) dan ADR-130 (Page Editor, Link List Table); ADR ini hanya mencatat pilihan yang belum terkunci di sana.

**Tema (T-073)**

1. Tema Start Page adalah **preset terbatas turunan token produk**, bukan set token sendiri dan bukan warna bebas. Enum allowlist `default | dark | accent` (`START_PAGE_THEMES`); nilai lain jatuh ke `default`. Kolom `start_page_pages.theme` tetap `text`; baseline lama (`default | minimal | bold`) adalah drift dan sudah dikoreksi.
2. `default` mengikuti tema aplikasi; `dark` memaksa scope token dark; `accent` adalah Aksen **netral tanpa hue** (inversi `--primary` Stone). **Tanpa token baru.** Rancangan LOCKED di artifact Postific (King Rezi, 2026-10-26).
3. Selector tema di Page Editor memakai `ToggleGroup` dengan 3 pilihan.

**Analytics (T-074; mekanisme di ADR-142)**

4. Analytics hanya tampil di **Page Editor**: total kunjungan di page-head, klik per tautan di meta Link List. Tidak tampil di halaman publik. Format id-ID penuh di bawah 10.000, ringkas mulai 10.000; tanpa data tampil `0` + petunjuk.

**Page Editor (T-072)**

5. Form tambah/ubah tautan memakai **Dialog**.
6. Profil memakai tombol **Simpan** dengan draft yang di-stage; Preview mengikuti draft, bukan data tersimpan.
7. Foto profil = **input URL https + pratinjau**. Upload ditunda (T-159). `avatarUrl` hanya https; `url` tautan hanya http/https.
8. Slug: panjang 3-40, format dan reserved words dari T-070.6; slug berubah di halaman published diberi peringatan.
9. **Satu halaman per workspace**, dijaga `UNIQUE(workspace_id)` (migrasi `20261026130000_t072_start_page_unique_workspace`). Halaman dibuat lewat state "Buat Halaman".
10. **RBAC: Account Owner, Admin, dan Creator** boleh mengelola (semua role yang ada, ADR-074). Dicek di Application Service (`assertActorCanManageStartPage`); baris ditambahkan ke `roles-permissions.md`.
11. Reorder tautan lewat drag dan keyboard; Publish/Unpublish dan Share di layar yang sama.
12. **Hapus tautan memakai konfirmasi Tier 2** (dialog "Hapus link?", `ConfirmActionDialog`, ADR-049), karena hitungan klik ikut hilang. Keputusan King Rezi 2026-10-28; klasifikasi "Remove Link (Start Page)" di `key-screen-patterns.md` berubah dari "Tidak wajib" menjadi Tier 2.

**Halaman publik (T-071)**

13. Tautan memakai `<a>` di dalam `Card` (komponen `card.tsx` tidak punya `asChild`). Href = `/u/[slug]/go/[linkId]` (ADR-142). `rel="noopener noreferrer nofollow ugc"`, `target="_blank"`.
14. **Render dinamis** per request (tanpa SSG/ISR). Header keamanan di `next.config.ts`: `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`, `Referrer-Policy`. **CSP penuh dengan nonce belum ada** (T-160).
15. **Ikon platform memakai `hugeicons` monokrom** (`currentColor`, tile netral sesuai rancangan Opsi B), bukan ikon brand berwarna dari `react-icons`. Ini **deviasi sadar** dari ADR-058 poin 6 (`react-icons` untuk logo brand), yang sudah dilebarkan ADR-068 (`react-icons` jadi library ikon tunggal). Praktik komponen shadcn baru di `apps/web/.claude/CLAUDE.md` memakai `hugeicons`. ADR ini tidak mengamandemen ADR-058 maupun ADR-068; deviasi hanya berlaku untuk ikon platform Start Page. Konflik ADR-068 dengan `apps/web/.claude/CLAUDE.md` diselesaikan nanti di tiket terpisah (T-165, butuh ADR baru; keputusan King Rezi 2026-10-28), bukan di PR #200.

### Reason

- Preset turunan token menjaga halaman publik konsisten dengan produk dan menghindari desain token baru atau kontrol warna bebas yang sulit dijaga kontrasnya.
- Draft yang di-stage dengan tombol Simpan mencegah halaman publik berubah per ketikan; Preview mengikuti draft memberi umpan balik tanpa menulis.
- Avatar URL https menunda kebutuhan Storage/Media dan kebijakan upload tanpa memblokir MVP.
- Semua role yang ada boleh mengelola karena Start Page bukan administrasi workspace (ADR-074 hanya tiga role; Creator sudah mengelola konten).
- `UNIQUE(workspace_id)` menjadikan "satu halaman per workspace" invariant database, bukan hanya konvensi aplikasi.
- `hugeicons` monokrom cocok dengan rancangan tile netral dan konsisten dengan komponen shadcn baru.

### Alternatives Considered

- **Set token tema sendiri atau warna bebas dari pengguna.** Ditolak: butuh token baru dan jaminan kontras.
- **Aksen berwarna (hijau dari trio success).** Draf awal, digantikan rancangan netral; blok draf lama itu masih tersisa di `project/styles.css` artifact Postific dan perlu dibersihkan (T-161).
- **Edit langsung tanpa tombol Simpan (autosave).** Tidak dipilih.
- **Upload foto profil lewat Storage/Media sekarang.** Ditunda ke T-159.
- **RBAC hanya Owner/Admin.** Tidak dipilih.
- **`react-icons` untuk ikon platform (patuh ADR-058/ADR-068).** Tidak dipilih; ikon brand berwarna tidak cocok dengan rancangan.
- **`asChild` pada `Card`.** Tidak tersedia di `card.tsx`.

### Consequences

- **Kontras:** token bersama `muted-foreground` mode light hanya 3,4 sampai 3,8:1 (di bawah AA 4,5:1). Ini token produk, bukan hanya Start Page; butuh keputusan token (T-163).
- Rancangan terkunci di artifact belum mencakup: slug, tombol Simpan, state "Buat Halaman", dan avatar via URL (rancangan memakai upload). Dicatat sebagai deviasi desain minor.
- Posisi tautan tidak dipadatkan setelah hapus (QA Najwa M4) dan fungsi baca publik tidak menyaring skema url (M3; aplikasi menyaring). Keduanya di T-162.
- Sebelum migrasi UNIQUE di-apply ke staging, cek duplikat: `SELECT workspace_id, count(*) FROM start_page_pages GROUP BY 1 HAVING count(*) > 1` (Ridwan F6).
- **Belum terverifikasi di staging:** migrasi T-070, T-072, T-074 belum di-apply di Supabase; `P2025` hanya diuji lewat mock; `next build` belum dijalankan.
- Pesan error domain Start Page sekarang berbahasa Indonesia.

### Related

- ADR-128, ADR-129, ADR-130, ADR-141, ADR-142; ADR-049 (konfirmasi hapus); ADR-074 (tiga role); ADR-058 poin 6 dan ADR-068 (ikon); ADR-097 (shadcn/ui).
- Baseline yang disesuaikan: `02-product/roles-permissions.md`, `04-ux/information-architecture.md`, `04-ux/key-screen-patterns.md`, `05-architecture/database-strategy.md`, `06-engineering/design-tokens.md`, `06-engineering/rendering-strategy.md`.
- Tiket: T-071, T-072, T-073, T-074 di `tickets/v06-start-page-mvp.md`; lanjutan T-159 sampai T-164; T-165 (ikon).
