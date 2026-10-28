## Decision ADR-147

### Title

Token `--muted-foreground` Mode Light Diganti ke `#5c5c63` agar Memenuhi Kontras AA (T-163; Menyimpang dari Pemetaan Stone ADR-087)

### Status

Accepted

### Date

2026-10-28

### Context

ADR-087 memetakan tema Stone ke CSS variable shadcn/ui secara 1:1, termasuk `--muted-foreground` light `#83838a`. Nilai itu hanya 3,76:1 di atas `--card`, 3,40:1 di atas `--background`, dan 2,92:1 di atas `--muted`, semuanya di bawah AA 4,5:1 untuk teks normal. Teks sekunder di seluruh produk terdampak, bukan hanya Start Page (temuan QA T-073).

### Decision

1. `--muted-foreground` mode light menjadi `#5c5c63` (awalnya `#6b6b72` dipilih King Rezi 2026-10-28; diganti ke `#5c5c63` dari hasil code-review PR 207 karena `#6b6b72` masih 4,10:1 di atas fill `--muted`).
2. Rasio kontras: 6,63:1 di atas `--card`, 5,99:1 di atas `--background`, 5,14:1 di atas fill `--muted` (`#e2e2e8`): lolos AA di semua latar.
3. Mode dark (`#9d9da3`) tidak berubah. `--ring` dan `--sidebar-ring` tetap `#83838a` (bukan teks).

### Reason

`#5c5c63` satu-satunya kandidat yang lolos AA 4,5:1 di semua latar yang dipakai, termasuk fill `--muted`/`--secondary`/`--accent`.

### Alternatives Considered

- **Tetap `#83838a` (1:1 Stone).** Ditolak: gagal AA di seluruh produk.
- **`#6b6b72`.** Ditolak: 4,10:1 di atas fill `--muted` (sekitar 12 berkas memakai pasangan itu).
- **`#65656c`.** Ditolak: 4,48:1 di atas fill `--muted`, tetap di bawah AA.

### Impact / Baseline yang diamandemen

- ADR-087: satu pengecualian pada pemetaan Stone (`--muted-foreground` light).
- `product-discovery/06-engineering/design-tokens.md` § Engineering Mapping diperbarui.
- `apps/web/src/app/globals.css` diperbarui.

---
