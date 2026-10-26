# Design Tokens

Dokumen ini adalah **Source of Truth visual tokens** untuk implementasi UI di
`apps/web` (CSS variable shadcn/ui + Tailwind token bridge, ADR-097).

Nilai token final berkembang **iteratif dan co-equal** antara dokumen ini dan
artifact desain Postific (ADR-140, menggantikan ADR-056) — tidak ada lagi
gerbang "menunggu designer masuk": project ini tidak akan merekrut designer
eksternal, perannya digantikan permanen oleh King Rezi sendiri lewat artifact
desain Postific (ADR-140; ADR-057 tetap dasar peran desainer, amandemen
ADR-038 & ADR-041). Implementasi feature memakai
token Stone theme (ADR-087, dipetakan ke shadcn/ui sejak ADR-097) dan tidak
menunggu token final.
Screenshot bukan acuan nilai final; folder `design/` (paket handoff designer)
sudah dihapus dan **tidak akan dibuat ulang** (ADR-045, ADR-057).

| Field | Value |
| ----- | ----- |
| Lokasi SoT | Dokumen ini, co-equal dengan artifact desain Postific untuk nilai token (ADR-038, ADR-140) — nilai berkembang iteratif, bukan sekali lock |
| Implementasi kode | `apps/web` (CSS variable shadcn/ui + Tailwind token bridge, ADR-097) |
| UX / struktur layar | Tetap di `../04-ux/` — **tidak** diganti dokumen ini |
| Peran desainer | Permanen digantikan King Rezi via artifact desain — tidak ada designer eksternal (ADR-057); pointer di `../../context/ctx-design.md` |

---

# Panduan PM — mengunci satu set token

Checklist lock ini dijalankan kapan pun King Rezi (berperan sebagai desainer
via artifact desain) menganggap satu set token sudah stabil — **tidak ada**
gerbang "designer eksternal masuk" (ADR-057). Selama development feature,
gunakan token Stone theme (ADR-087, dipetakan ke shadcn/ui sejak ADR-097);
jangan mengisi nilai brand sementara atau memblokir implementasi layar
karena tabel masih `TBD`.

## Langkah 1 — Review & approve di artifact desain

Artifact desain Postific menggantikan Figma sebagai design handoff tool (ADR-042, lalu
dipindah dari Claude Design ke artifact oleh ADR-140) — artifact `Postific` dan galeri
`Postific Design Review`, dibaca dan ditulis lewat tool `Artifact`. Lihat
`../../context/ctx-design.md` untuk pointer lengkap.

Pastikan hasil design selaras dengan UX Baseline (`../04-ux/`):

* Primary nav: Home → Publish → Engage → Analyze → Start Page
* Publish default: Calendar
* Tidak ada Approval Workflow di MVP
* Tidak ada AI bawaan di UI (ADR-138)
* 6 content status + `Failed` jelas terbaca

Jika artifact desain mengubah alur/IA, **hentikan** — diskusikan dulu (perlu update UX + ADR). Jangan “mengunci token” dari desain yang bertentangan dengan UX. Sinkronisasi antara baseline ini dan artifact desain bersifat manual/on-request (ADR-140) — bukan otomatis.

## Langkah 2 — Isi tabel token di dokumen ini

Salin nilai final dari artifact desain (`project/tokens.json` / `project/tokens.css`) atau style guide ke tabel di bawah:

1. Typography (font display + UI)
2. Color — brand (primary, secondary, …)
3. Color — neutral (canvas, surface, text, border)
4. Color — status konten (6 status + failed)
5. Color — feedback (success, warning, danger, info)
6. Spacing / radius / elevation (ringkas)
7. Mode tema (light-only MVP vs dark)

Ganti setiap `TBD` dengan nilai konkret (hex/HSL atau nama font). Isi kolom **Catatan** bila perlu.

## Langkah 3 — Ubah status dokumen

Di metadata atas:

* Status → **Locked — siap implementasi**
* Catat tanggal approve + link artifact desain (opsional, di Related)

## Langkah 4 — Catat di Project OS

* Tambah/update ADR di `../../project-os/DECISIONS.md` jika nilai brand/tema berdampak luas (atau amandemen singkat pada ADR-038 bahwa nilai sudah diisi).
* Update `../../project-os/CHANGELOG.md`.
* Update `../../project-os/PROJECT_STATE.md` bila ini menjadi next-task selesai / unlock UI shell.

## Langkah 5 — Mirror ke kode (M8)

Engineering memetakan token → implementasi:

| Token di dokumen ini | Target kode (contoh) |
| -------------------- | -------------------- |
| Brand / neutral / status | CSS variables shadcn/ui di `apps/web` |
| Skala type / spacing | CSS variable shadcn/ui + Tailwind token bridge |
| Komponen UI | Komponen shadcn/ui dan wrapper selektif memakai semantic token yang sama |

**Jangan** mengisi hex hanya di artifact desain atau hanya di screenshot tanpa update dokumen ini.

## Yang tidak dilakukan

* Menjadikan PDF brief atau dokumen desain lain sebagai SoT warna/font
* Menempel banyak screenshot ke `04-ux/` sebagai pengganti token
* Mengubah IA/nav di artifact desain lalu menganggap repo otomatis ikut

---

# Keputusan yang Sudah Terkunci (proses)

| ID | Topik | Keputusan |
| ---- | ----- | --------- |
| DT-D01 | Lokasi SoT token | `product-discovery/06-engineering/design-tokens.md` |
| DT-D02 | Kapan diisi | Iteratif, co-equal dengan artifact desain (ADR-140); dikunci kapan pun King Rezi menganggap stabil — tidak ada gerbang "designer masuk" (ADR-057); gunakan token Stone theme (ADR-087) |
| DT-D03 | Hubungan dengan handoff designer | Tidak ada designer eksternal, permanen (ADR-057); folder `design/` dihapus dan tidak dibuat ulang (ADR-045); token final tetap **wajib** masuk dokumen ini |
| DT-D04 | Hubungan dengan UX Baseline | `04-ux/` mengatur alur & zona fungsi; dokumen ini hanya visual tokens |
| DT-D05 | Stack implementasi | shadcn/ui untuk komponen/theme + Tailwind sebagai styling langsung (ADR-097, membalik ADR-041) |
| DT-D06 | Pemetaan teknis Stone→shadcn (T-095.5) | Nilai literal Stone theme (ADR-087) dipetakan 1:1 ke CSS variable shadcn/ui di § Engineering Mapping — referensi implementasi T-096.1, **bukan** token brand baru (beda dari § Color — Brand yang masih `TBD` menunggu design lock) |

---

# Typography

| Slot | Peran | Nilai | Catatan |
| ---- | ----- | ----- | ------- |
| `font/display` | Brand moments (login, empty hero opsional) | `TBD` | Hindari Inter/Roboto/Arial sebagai identitas utama |
| `font/sans` | UI produk (nav, list, form, caption) | `TBD` | Prioritas keterbacaan; angka tabular untuk waktu/jadwal disarankan |
| `font/mono` | Opsional — ID teknis | `TBD` atau tidak dipakai | Jangan untuk caption sosial |

**Skala type (artifact desain → kode):** `xs · sm · md · lg · xl · 2xl` — nilai size/line-height konkret: `TBD` setelah design lock.

---

# Color — Brand

| Slot | Dipakai untuk | Nilai (hex/HSL) | Catatan |
| ---- | ------------- | --------------- | ------- |
| `brand/primary` | CTA utama, active nav | `TBD` | |
| `brand/primary-hover` | Hover/focus primary | `TBD` | |
| `brand/subtle` | Background aksen lembut | `TBD` | |
| `brand/secondary` | Aksi sekunder / aksen kedua | `TBD` | Isi jika design memakai secondary eksplisit |

---

# Color — Neutral

| Slot | Dipakai untuk | Nilai (hex/HSL) | Catatan |
| ---- | ------------- | --------------- | ------- |
| `bg/canvas` | Latar aplikasi | `TBD` | |
| `bg/surface` | Panel, list row, card interaksi | `TBD` | |
| `bg/subtle` | Zona sekunder, zebra opsional | `TBD` | |
| `border/default` | Border default | `TBD` | |
| `border/strong` | Border penekanan | `TBD` | Opsional |
| `text/primary` | Teks utama | `TBD` | |
| `text/secondary` | Teks sekunder | `TBD` | |
| `text/muted` | Meta, timestamp, hint | `TBD` | |
| `text/on-brand` | Teks di atas `brand/primary` | `TBD` | Pastikan kontras AA |

---

# Color — Content Status

Harus selaras makna status di `../02-product/roles-permissions.md` dan pola visual di Key Screen Patterns. Jangan andalkan warna saja — chip tetap punya label teks.

| Slot | Status | Nilai (hex/HSL) | Catatan |
| ---- | ------ | --------------- | ------- |
| `status/draft` | Draft | `TBD` | |
| `status/in-review` | In Review | `TBD` | |
| `status/ready` | Ready to Schedule | `TBD` | |
| `status/scheduled` | Scheduled | `TBD` | |
| `status/published` | Published | `TBD` | |
| `status/failed` | Failed | `TBD` | Wajib kontras tinggi (UXP-04) |

---

# Color — Feedback

| Slot | Dipakai untuk | Nilai (hex/HSL) | Catatan |
| ---- | ------------- | --------------- | ------- |
| `feedback/success` | Toast sukses, konfirmasi | `TBD` | |
| `feedback/warning` | Peringatan (akun hampir expired, dll.) | `TBD` | |
| `feedback/danger` | Error, destroy actions | `TBD` | Selaras semantik dengan `status/failed` bila perlu |
| `feedback/info` | Info netral | `TBD` | |

---

# Color — Platform (opsional)

Warna aksen jaringan sosial di Calendar / Account Pill. Jangan mendominasi UI.

| Platform | Nilai | Kekuatan penggunaan |
| -------- | ----- | ------------------- |
| Instagram | `TBD` | `TBD` (hint kecil / sedang) |
| Facebook | `TBD` | `TBD` |
| Twitter / X | `TBD` | `TBD` |
| LinkedIn | `TBD` | `TBD` |
| TikTok | `TBD` | `TBD` |
| YouTube | `TBD` | `TBD` |
| Threads | `TBD` | `TBD` |
| Pinterest | `TBD` | `TBD` |

---

# Spacing

**Locked (ADR-095).** Base unit: **4px grid**. Skala ini dikunci berdasarkan
nilai yang sudah dipakai konsisten di kode nyata era Astryx (prop `gap`/
`padding` pada `VStack`/`HStack`/`Stack`/`Grid`) — bukan angka baru yang
diciptakan dari nol. Nilai grid 4px tetap berlaku sebagai keputusan setelah
migrasi ke shadcn/ui (ADR-097); ekspresinya di kode sekarang Tailwind
spacing scale langsung (mis. `gap-4`, `p-4` untuk unit 4 = 16px), bukan lagi
prop `gap`/`padding` numerik Astryx — lihat `apps/web/.claude/CLAUDE.md`
untuk konvensi spacing shadcn terbaru.

| Unit (× 4px) | Px | Status |
| ----------- | -- | ------ |
| 0 | 0px | Dipakai (reset spacing sengaja) |
| 0.5 | 2px | Dipakai (dense UI, jarang) |
| 1 | 4px | Dipakai (icon-to-label, paling rapat) |
| 1.5 | 6px | Dipakai (dense UI) |
| 2 | 8px | Dipakai (item list rapat) |
| 3 | 12px | Dipakai (antar field) |
| 4 | 16px | **Paling sering dipakai** — default antar field/dalam Card |
| 5 | 20px | Dipakai (jarang) |
| 6 | 24px | Dipakai (antar section) |
| 8 | 32px | Dipakai (padding page-level) |

Nilai lain (7, 9, 10+) belum dipakai — boleh dipakai kalau kebutuhan riil
muncul, skala ini **tidak tertutup** ke daftar lama (4/8/12/16/24/32/48).
Grid 4px dengan fleksibilitas kelipatan 0.5 di ujung bawah untuk dense UI
(icon+label kecil) lebih akurat merefleksikan pemakaian nyata dibanding
daftar tertutup klasik.

## Panduan Penggunaan Semantik

| Konteks | Prop (era Astryx) | Nilai (px) | Alasan |
| ------- | ---- | ------------------ | ------ |
| Icon-to-label (Button, MenuItem, Badge) | `gap` | 1–1.5 (4–6px) | Elemen sangat dekat, jarak visual minimal |
| Item dalam list/stack rapat (baris Table, item Menu) | `gap` | 2 (8px) | Grouping jelas tapi tetap padat |
| Antar field form / antar komponen dalam satu Card/Section | `gap` | 3–4 (12–16px) | Pemisahan antar unit input yang related tapi berbeda |
| Antar section/blok dalam satu page | `gap` | 6 (24px) | Pemisahan visual section yang lebih tegas |
| Padding internal komponen kecil (Badge, Chip, Pill) | `padding` | 1–1.5 (4–6px) | Komponen dense, padding minimal |
| Padding Card/Section/Container standar | `padding` | 4 (16px) | Default paling umum dipakai |
| Padding Container/page-level wrapper besar | `padding` | 8 (32px) | Breathing room level page, dipakai sengaja lebih jarang |
| Reset/no-space (Stack yang dibungkus komponen lain) | `gap`/`padding` | 0 | Sengaja tanpa spacing tambahan |

## Larangan

Migrasi Astryx sudah tuntas (ADR-097, v0.7, T-102). Kode aktif memakai
Tailwind utility langsung pada skala 4px di atas. Larangan prop `VStack` /
`HStack` era Astryx tidak berlaku lagi.

* **Arbitrary value** (`gap-[13px]`, `p-[10px]`) — selalu pakai unit dari
  skala di atas.
* **`margin`** pada child untuk spacing antar sibling — spacing datang dari
  utility `gap` pada parent flex/grid, bukan `margin` pada child.

Dua exception historis ditemukan (`p-0`, `my-1` di `ChannelsSection.tsx`) —
dicatat sebagai technical debt kecil untuk dirapikan, **bukan** preseden
yang boleh diikuti di kode baru.

---

# Radius, Elevation

| Sistem | Keputusan | Nilai |
| ------ | --------- | ----- |
| Radius | **Tidak** dipetakan dari Stone theme — pertahankan default preset Maia (`--radius: 0.625rem` + turunan `calc()`-nya, lihat § Engineering Mapping di bawah) | `0.625rem` base, skala `radius-sm/md/lg/xl/2xl/3xl/4xl` via `calc(var(--radius) * n)` |
| Elevation | `TBD` | `TBD` — shadow terutama untuk overlay; Stone punya `--shadow-low/med/high` tapi belum dipetakan (di luar scope T-095.5, komponen shadcn generate shadow Tailwind sendiri per komponen) |

---

# Tema (Light / Dark)

| ID | Keputusan | Nilai |
| ---- | --------- | ----- |
| DT-THEME | Mode MVP | `TBD` — preferensi awal project: **light-only MVP** (boleh diganti saat lock design) |

---

# Motion (ringkas)

Minimal 2–3 motion disengaja setelah design lock — catat di sini jika design menetapkan durasi/easing:

| Motion | Tujuan | Spec |
| ------ | ------ | ---- |
| Sidebar active | Pindah section jelas | `TBD` |
| Status change | Chip Draft → Scheduled / Failed | `TBD` |
| Inbox badge | Update unread | `TBD` |

---

# Mapping implementasi

```text
Sebelum token Locked
        ↓
Token Stone theme (ADR-087) + Tailwind sebagai styling langsung (ADR-097)

Setelah design-tokens.md Locked (co-equal dengan artifact desain, ADR-140/057)
        ↓
apps/web — CSS variable shadcn/ui + Tailwind token bridge
        ↓
Komponen shadcn/ui + wrapper selektif + layar KSP-01 … KSP-08
```

Engineering **tidak** membaca paket handoff designer sebagai sumber nilai
token final (folder `design/` sudah dihapus dan tidak akan dibuat ulang,
ADR-045, ADR-057).

---

# Engineering Mapping — Stone theme → CSS variable shadcn/ui (T-095.5)

**Status: referensi teknis untuk T-096.1** (rewrite `globals.css`), bukan
"token Locked" — nilai warna semantik brand/status di atas (§ Color — Brand/
Content Status/Feedback) tetap `TBD` sampai design lock (DT-D02). Section
ini murni pemetaan **nilai literal 1:1** dari `@astryxdesign/theme-stone`
(ADR-087) ke variable shadcn/ui yang sudah ada di
`apps/web/src/app/globals.css` sejak init (T-095.1), supaya visual app
**tidak berubah** (warna Stone tetap dipakai) saat fondasi Astryx dilepas
di T-096. Sumber: `@astryxdesign/theme-stone/dist/theme.css` (versi
`0.4.3` ter-install) — semua value Stone berbentuk
`light-dark(<light>, <dark>)`, dipecah jadi `:root` (light) dan `.dark`
(dark) di bawah karena shadcn pakai strategi class `.dark`, bukan
`light-dark()` CSS native.

## Warna

| Variable shadcn/ui | Light | Dark | Sumber token Stone | Catatan |
| ------------------- | ----- | ---- | ------------------- | ------- |
| `--background` | `#f3f3f5` | `#111015` | `--color-background-body` | Canvas app |
| `--foreground` | `#25252a` | `#f3f3f5` | `--color-text-primary` | |
| `--card` | `#ffffff` | `#242325` | `--color-background-card` | |
| `--card-foreground` | `#25252a` | `#f3f3f5` | `--color-text-primary` | |
| `--popover` | `#ffffff` | `#25252a` | `--color-background-popover` | |
| `--popover-foreground` | `#25252a` | `#f3f3f5` | `--color-text-primary` | |
| `--primary` | `#25252a` | `#f3f3f5` | `--color-accent` | |
| `--primary-foreground` | `#ffffff` | `#25252a` | `--color-on-accent` | |
| `--secondary` | `#e2e2e8` | `#3b3b3f` | `--color-background-muted` | |
| `--secondary-foreground` | `#25252a` | `#f3f3f5` | `--color-text-primary` | |
| `--muted` | `#e2e2e8` | `#3b3b3f` | `--color-background-muted` | Sama dengan `--secondary` — konsisten dgn pola default shadcn (kedua value identik di preset bawaan) |
| `--muted-foreground` | `#83838a` | `#9d9da3` | `--color-text-secondary` | |
| `--accent` | `#e2e2e8` | `#3b3b3f` | `--color-background-muted` | Sama dengan `--muted`/`--secondary` — Stone tidak punya token hover-state solid terpisah yang cukup pekat (`--color-overlay-hover`/`--color-neutral` transparan, tidak cocok jadi bg solid) |
| `--accent-foreground` | `#25252a` | `#f3f3f5` | `--color-text-primary` | |
| `--destructive` | `#58413e` | `#dcc0bc` | `--color-error` | Dipakai sebagai warna teks/icon (lihat pola `button.tsx` — `bg-destructive/10 text-destructive`), bukan fill solid; `--color-error` lebih cocok dari `--color-background-red` untuk peran ini |
| `--border` | `#e2e2e8` | `rgba(255,255,255,0.10)` | `--color-border` | Nilai dark (`#f3f3f51a`) kebetulan hampir identik dengan default shadcn (`oklch(1 0 0 / 10%)`) |
| `--input` | `#e2e2e8` | `rgba(255,255,255,0.10)` | `--color-border` | Stone tidak punya token `input` terpisah dari `border` (beda dari shadcn default yang memisah opacity 10%/15%) — pakai `--color-border` untuk keduanya, konsisten dengan cara Astryx memperlakukan border field |
| `--ring` | `#83838a` | `#5e5e61` | `--color-border-emphasized` | Stone tidak punya token focus-ring dedicated; `border-emphasized` adalah padanan terdekat (dipakai untuk penekanan border) |

## Sidebar (variable `--sidebar-*`, dipakai `T-096.3` App Shell)

| Variable shadcn/ui | Light | Dark | Sumber token Stone |
| ------------------- | ----- | ---- | ------------------- |
| `--sidebar` | `#ffffff` | `#1b1b1f` | `--color-background-surface` (beda dari `--background`/canvas — surface adalah permukaan elevated generik, cocok utk sidebar) |
| `--sidebar-foreground` | `#25252a` | `#f3f3f5` | `--color-text-primary` |
| `--sidebar-primary` | `#25252a` | `#f3f3f5` | `--color-accent` |
| `--sidebar-primary-foreground` | `#ffffff` | `#25252a` | `--color-on-accent` |
| `--sidebar-accent` | `#e2e2e8` | `#3b3b3f` | `--color-background-muted` |
| `--sidebar-accent-foreground` | `#25252a` | `#f3f3f5` | `--color-text-primary` |
| `--sidebar-border` | `#e2e2e8` | `rgba(255,255,255,0.10)` | `--color-border` |
| `--sidebar-ring` | `#83838a` | `#5e5e61` | `--color-border-emphasized` |

## Chart (`--chart-1..5`)

**Tidak dipetakan** — Stone/Astryx tidak punya sistem palet chart (di luar
scope komponen Astryx yang diaudit). Rekomendasi: biarkan default grayscale
CLI shadcn apa adanya sampai domain Analytics benar-benar dimigrasi
(setelah T-102, di luar scope 8 task rilis v0.7 ini) — jangan mengarang
warna chart sekarang.

## Radius

**Tidak dipetakan dari Stone.** Stone punya skala radius sendiri
(`--radius-inner: 0.25rem`, `--radius-element: 0.5rem`,
`--radius-container: 0.75rem`, `--radius-page: 1.5rem`,
`--radius-full`), tapi preset Maia (shadcn) sudah generate komponen
(mis. `Button` → `rounded-4xl`, lihat `apps/web/src/components/ui/button.tsx`)
yang dikalibrasi ke base `--radius: 0.625rem` bawaan CLI + turunan
`calc(var(--radius) * n)` di `globals.css` `@theme inline`. Mengganti base
radius ke nilai Stone (mis. `--radius-element` 0.5rem) akan menggeser
seluruh skala turunan tanpa review visual — **keputusan T-095.5: pertahankan
default Maia**, bukan dipetakan 1:1. Kalau King Rezi ingin bentuk radius
Stone yang lama dipertahankan persis, itu perubahan visual terpisah yang
perlu di-approve eksplisit (bukan bagian "migrasi tanpa ubah visual").

## Font

| Variable shadcn/ui | Nilai | Sumber Stone | Status |
| ------------------- | ----- | ------------- | ------ |
| `--font-sans` (body) | Figtree | `--font-family-body` | **Sudah cocok** — Figtree sudah di-load `next/font/google` di `layout.tsx` sejak T-095.1 (`const figtree = Figtree({ variable: '--font-sans' })`), tidak perlu perubahan |
| `--font-heading` | **Gap**: saat ini `var(--font-sans)` (ikut Figtree) di `globals.css` `@theme inline` baris 16 | `--font-family-heading` = Montserrat | Stone pakai Montserrat khusus heading (`h1`–`h6`), belum di-load di project. **Untuk T-096.1:** load `Montserrat` via `next/font/google` (pola sama seperti `figtree`/`geistSans` di `layout.tsx`), lalu ganti `--font-heading: var(--font-sans)` → `--font-heading: var(--font-montserrat)` |
| `--font-mono` | Geist Mono (dibiarkan) | `--font-family-code` = "JetBrains Mono" | Prioritas rendah — dipakai untuk kode/ID teknis saja (§ Typography `font/mono`, opsional). Tidak perlu diganti kecuali ada kebutuhan konkret menampilkan kode di UI produk |

## Yang sengaja tidak dipetakan

* **Warna brand/status/feedback semantik** (§ Color — Brand/Content
  Status/Feedback di atas) — tetap `TBD`, menunggu design lock (DT-D02),
  bukan bagian pemetaan teknis Stone→shadcn ini.
* **Chart palette** — lihat di atas.
* **Motion/duration** — Stone punya `--duration-fast/medium/slow` tapi
  belum ada requirement animasi konkret yang memakainya (§ Motion masih
  `TBD`).

---

# Related Documents

* `README.md` (folder Engineering)
* `../../project-os/DECISIONS.md` — ADR-038, ADR-041, ADR-056, ADR-057, ADR-095 (kunci skala Spacing), ADR-097 (migrasi ke shadcn/ui, membalik ADR-041)
* `../../project-os/PROJECT_OVERVIEW.md` — shadcn/ui + Tailwind langsung (ADR-097)
* `../04-ux/` — UX Baseline (alur & layar)
* `../02-product/roles-permissions.md` — status konten kanonikal
* `../../context/ctx-design.md` — pointer artifact desain (folder `design/` dihapus, ADR-045)
