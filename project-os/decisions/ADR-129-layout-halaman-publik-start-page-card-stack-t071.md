## Decision ADR-129

### Title

Layout halaman publik Start Page — Card Stack (T-071)

### Status

Accepted

### Date

2026-10-16

### Decision

Layout halaman publik Start Page (`/u/[slug]`, ADR-128) mengikuti pola
**Card Stack**: header horizontal (avatar di kiri, sejajar nama + bio di
kanan — bukan center-top), dengan daftar tautan ditampilkan sebagai card
(`--radius-element`, border + `--shadow-low`), masing-masing punya leading
icon kotak kecil dan chevron di kanan.

Pola ini dikunci sebagai **LOCKED PATTERN** di Claude Design
(`templates/start-page-option-b-card-stack.html`, project "Postific") —
dipilih King Rezi dari 4 opsi eksplorasi yang dibuat Neymar Product
Designer (grup `Start Page (Exploration, T-071)`):

| Opsi                 | Pola                                                        | Status                                                                         |
| -------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| A — Classic Centered | Avatar center-top, pill-button full-width                   | Tidak dipilih, disimpan sebagai referensi                                      |
| **B — Card Stack**   | **Header horizontal, tautan sebagai card + icon + chevron** | **Dipilih**                                                                    |
| C — Hero Banner      | Cover band + avatar overlap, flat list dalam card besar     | Tidak dipilih — juga butuh field `coverImageUrl` baru yang belum ada di schema |
| D — Minimal Dense    | Header rata kiri, flat list tanpa shadow                    | Tidak dipilih, disimpan sebagai referensi                                      |

Seluruh token visual (warna, radius, spacing, font) di Opsi B memakai token
Stone/shadcn existing (`var(--color-*)`, `var(--radius-*)`,
`var(--spacing-*)`, `var(--text-*)`) — **tidak ada token baru** yang perlu
dikunci ke `design-tokens.md`. Tidak ada field schema tambahan yang
dibutuhkan (`StartPagePage.title/bio/avatarUrl` + `StartPageLink[].label/url`
yang sudah ada di Prisma schema cukup).

Badge "Powered by Postific" (pill kecil muted di footer) ikut terkunci
sebagai bagian dari layout ini.

### Reason

- King Rezi secara eksplisit meminta eksplorasi layout dulu sebelum masuk
  ke kode (T-071 depends T-070, yang baseline arsitekturnya baru dikunci
  ADR-128) — menghindari asumsi struktur UI yang keliru seperti insiden
  KI-054/KI-055 (AGENTS.md rule 17).
- 4 opsi disajikan setara (tidak ada yang ditandai "direkomendasikan" secara
  default, sesuai `claude-design-scope-discipline` skill) — King Rezi
  memilih Card Stack lewat `AskUserQuestion` tanpa pengaruh urutan/framing.
- Card Stack dipilih karena menonjolkan tiap tautan sebagai item individual
  yang jelas (leading icon + chevron) — sesuai pola produk link-in-bio
  komersial (Bio.link/Beacons) yang lebih "aplikatif" dibanding list polos.
- Opsi C (Hero Banner) tidak dipilih sekaligus menghindari kebutuhan field
  schema baru (`coverImageUrl`) yang akan menambah scope T-070/T-071.

### Alternatives Considered

- **Opsi A — Classic Centered** — tidak dipilih. Paling dikenal pengguna
  (gaya Linktree klasik) dan paling breathable, tapi dinilai paling generik
  dari segi identitas brand Postific.
- **Opsi C — Hero Banner** — tidak dipilih. Kesan paling premium/editorial,
  tapi butuh keputusan terpisah soal field `coverImageUrl` baru di schema
  (upload cover asli vs tetap warna solid token) — kompleksitas tambahan
  yang tidak sepadan untuk MVP.
- **Opsi D — Minimal Dense** — tidak dipilih. Paling ringan dan cocok untuk
  banyak tautan, paling konsisten dengan nuansa tenang Postific di layar
  lain, tapi dinilai kurang "menjual" untuk halaman yang justru dibagikan
  ke publik/calon pelanggan.

### Related

- ADR-128 — strategi routing publik `/u/[slug]` yang jadi prasyarat T-071.
- `tickets/v06-start-page-mvp.md` § T-071 — task yang mengikuti keputusan ini.
- Claude Design, project "Postific" — `templates/start-page-option-b-card-stack.html`
  (LOCKED PATTERN) dan 3 opsi lain (A/C/D) sebagai referensi, grup
  `Start Page (Exploration, T-071)`.
- `.claude/agents/README.md` § "Gate pola ambigu shadcn (T-103.2)" — alasan
  pola ini perlu dikunci eksplisit sebelum Mark UI Engineer implementasi.
