# Lane brief

Satu brief per jalur. Isi dengan penunjuk (path atau URL), bukan salinan dokumen (ADR-133).

## Tujuan

Satu kalimat: hasil yang harus ada saat jalur selesai.

## Lingkup

- Tiket: `T-xxx` (`project-os/tickets/...`), butir yang dikerjakan.
- Spec dan ADR yang berlaku: `specs/S-NNN.md`, `ADR-xxx`.
- Berkas yang boleh diubah, dan berkas yang tidak boleh disentuh jalur lain.

## Batasan

- Branch dan worktree jalur dipotong dari branch integrasi `<nama>`.
- Jangan merge. Jangan menerapkan migrasi. Jangan commit atau push kecuali diminta King Rezi.
- Pertanyaan yang milik King Rezi dikembalikan, tidak dijawab sendiri.
- Di worktree baru jalankan `bun install` dulu; hook pre-commit tidak dilewati.

## Definisi selesai

- [ ] Acceptance tiket terpenuhi (sumbu Spec).
- [ ] Sesuai aturan repo dan arsitektur (sumbu Standards).
- [ ] `typecheck`, `lint`, dan tes hijau; E2E golden path bila tiket mengubah perilaku produk (ADR-149). Aturan menjalankannya ada di bagian E2E.
- [ ] Bagian "Belum terbukti" di tiket diperbarui dengan jujur.

## E2E

Bila jalur mengubah perilaku produk (ADR-149):

- Jalankan E2E di checkout utama. `E2E_BASE_URL` menunjuk ke dev server yang sudah berjalan di checkout itu.
- E2E golden path hanya sah bila checkout yang menyajikan `E2E_BASE_URL` sedang berada di commit jalur. Server di checkout lain menguji kode checkout itu. Playwright memakai server yang sudah hidup (`reuseExistingServer` di `apps/web/playwright.config.ts`).
- Worktree jalur tidak punya `apps/web/.env.local`. Berkas itu diabaikan git. Playwright memuat berkas itu di samping config, jadi E2E dari worktree jalur tidak membawa env checkout utama.
- Jangan menjalankan `next dev` kedua di direktori yang sama. `next dev` mengunci `.next/dev` per direktori, jadi kunci checkout utama tidak menahan worktree lain. Bukti: T-225.1 (`project-os/tickets/v01-foundation.md`).

## MCP shadcn

- `.mcp.json`, `.cursor/mcp.json`, dan `apps/web/components.json` terlacak git, jadi worktree jalur sudah memilikinya. Jangan menyalin atau menautkannya. `.mcp.json` dan `.cursor/mcp.json` pasangan kembar (`AGENTS.md` aturan 12); bila perlu diubah, ubah bersamaan, dan itu di luar jalur kecuali tiketnya menyebut berkas itu.
- `apps/web/components.json` memakai `"registries": {}`. `search_items_in_registries` menjawab tidak ada registry terkonfigurasi bila objek itu kosong, atau bila pencarian dijalankan dari akar repo, bukan dari `apps/web`. Bukti: T-225.3 (`project-os/tickets/v01-foundation.md`).
- Penanganan: jalankan pencarian shadcn dengan direktori kerja `apps/web` di worktree jalur. Bila registry tetap kosong, baca sumber komponen lokal di worktree itu. Sesi MCP IDE melekat pada workspace yang dibuka, bukan pada worktree kedua.

## Daftar periksa tes (anti-pola)

Tolak tes yang:

- **Terikat implementasi:** gagal saat refactor tanpa perubahan perilaku (mengintip fungsi privat, urutan panggilan, atau struktur internal).
- **Tautologis:** membuktikan sesuatu yang selalu benar (menegaskan nilai yang baru saja diatur, atau mock yang mengembalikan jawabannya sendiri).

Tes yang baik menembus batas publik (use case, repository, route) dan gagal bila perilaku berubah.

## Laporan jalur

Tulis hasil sebagai penunjuk: commit, tes yang dijalankan, temuan terbuka. Jangan melaporkan "sudah di-push" tanpa nama commit.
