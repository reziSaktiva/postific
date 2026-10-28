## Decision ADR-147

### Title

Token `--muted-foreground` Mode Light Diganti ke `#6b6b72` agar Memenuhi Kontras AA (T-163; Menyimpang dari Pemetaan Stone ADR-087)

### Status

Accepted

### Date

2026-10-28

### Context

ADR-087 memetakan tema Stone ke CSS variable shadcn/ui secara 1:1, termasuk `--muted-foreground` light `#83838a`. Nilai itu hanya 3,76:1 di atas `--card`, 3,40:1 di atas `--background`, dan 2,92:1 di atas `--muted`, semuanya di bawah AA 4,5:1 untuk teks normal. Teks sekunder di seluruh produk terdampak, bukan hanya Start Page (temuan QA T-073).

### Decision

1. `--muted-foreground` mode light menjadi `#6b6b72` (King Rezi, 2026-10-28, dipilih dari tiga kandidat).
2. Rasio kontras: 5,29:1 di atas `--card`, 4,77:1 di atas `--background`, 4,10:1 di atas fill `--muted` (`#e2e2e8`).
3. Mode dark (`#9d9da3`) tidak berubah. `--ring` dan `--sidebar-ring` tetap `#83838a` (bukan teks).
4. Teks `text-muted-foreground` yang tepat di atas fill `--muted`/`--secondary`/`--accent` masih 4,10:1. Kasus itu dibiarkan dan dicatat sebagai batasan, dikoreksi per komponen bila ditemukan.

### Reason

`#6b6b72` memenuhi AA di latar yang dipakai teks sekunder pada umumnya dan paling dekat dengan tampilan Stone saat ini. Kandidat lebih gelap (`#65656c`, `#5c5c63`) membuat hierarki teks sekunder terhadap teks utama mengecil.

### Alternatives Considered

- **Tetap `#83838a` (1:1 Stone).** Ditolak: gagal AA di seluruh produk.
- **`#65656c`.** Hampir lolos di semua latar (4,48:1 di atas `--muted`), tapi lebih gelap dari yang perlu.
- **`#5c5c63`.** Lolos di semua latar, tapi teks sekunder terlalu tegas.

### Impact / Baseline yang diamandemen

- ADR-087: satu pengecualian pada pemetaan Stone (`--muted-foreground` light).
- `product-discovery/06-engineering/design-tokens.md` § Engineering Mapping diperbarui.
- `apps/web/src/app/globals.css` diperbarui.

---
