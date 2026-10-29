---
name: project-os-navigator
description: Project OS navigator untuk Social Media Management project. Memandu AI dalam memahami cara kerja, aturan dokumentasi, dan behavior yang tepat untuk setiap jenis interaksi — diskusi, planning change, pekerjaan baru, dan bug. Gunakan skill ini di awal setiap sesi kerja pada project ini, atau ketika context project dibutuhkan.
---

# Project OS Navigator — Social Media Management

Skill ini mendefinisikan cara AI berperilaku saat bekerja pada project Social Media Management. Ikuti panduan ini untuk setiap jenis interaksi.

## Langkah Pertama: Load Context (Cascade 3 Tingkat)

Jangan langsung baca semua dokumen `project-os/` secara penuh untuk setiap pesan — itu boros token untuk pertanyaan sederhana. Eskalasi bertahap, berhenti secepat mungkin begitu informasi sudah cukup untuk menjawab:

**Tingkat 1 — Fakta cepat / lookup teknis** (stack, konvensi, boundary domain, pola implementasi, dsb — bukan soal status/keputusan):

- Cukup baca `context/ctx-*.md` yang relevan (lihat `context/README.md` untuk peta file). Tidak perlu buka `project-os/` sama sekali.

**Tingkat 2 — Status / progress / pertanyaan umum** (fase sekarang, next task, kenapa satu keputusan diambil, dsb — bukan minta kerjaan):

- Baca **section "Snapshot"** di paling atas `project-os/PROJECT_STATE.md` (~15-20 baris — phase/milestone, active mode, top next tasks, top blocker). Jangan baca seluruh isi `PROJECT_STATE.md`.
- Kalau pertanyaan soal **task yang tersedia / apa yang berikutnya**, baca `project-os/AVAILABLE_TICKETS.md` saja. Jangan membuka `project-os/tickets/` untuk mencari antrian.
- Kalau ID-nya sudah dipilih, buka **hanya section tiket itu** di satu file: `tickets/vXX-*.md` untuk tiket rilis, atau `tickets/known-issues.md` untuk tiket dari Known Issue (ADR-134).
- Kalau pertanyaan menyebut ADR spesifik, buka **hanya** file `project-os/decisions/ADR-XXX-*.md` itu (lihat indeksnya di `project-os/DECISIONS.md`). Jangan baca seluruh isi folder `project-os/decisions/`.

**Tingkat 3 — Task nyata** (Pekerjaan Baru, Planning Change, Bug/Inkonsistensi — mode 3/4/5 di bawah): baca berurutan:

1. `project-os/PROJECT_STATE.md` — phase, milestone, Active Conversation Mode, Known Issues, blockers (baca Snapshot dulu supaya konteks ini tersedia sebelum memilih/merencanakan task)
2. `project-os/AVAILABLE_TICKETS.md` — antrian; temukan ID task yang relevan
3. File tiket yang disebut kolom File — `tickets/vXX-*.md` atau `tickets/known-issues.md` (ADR-134) — **hanya section tiket itu**. Lalu buka dokumen yang disebut di field **Docs** / **Baca dulu** (ADR-131)
4. `project-os/PROJECT_RULES.md` — aturan dan prinsip project
5. `project-os/DECISIONS.md` — indeks ADR; buka file `project-os/decisions/ADR-XXX-*.md` spesifik yang relevan dengan task ini
6. `project-os/PROJECT_OVERVIEW.md` — gambaran project

Kalau pekerjaannya belum punya ID task di backlog, itu sendiri sinyal: tanyakan ke King Rezi apakah perlu ditambahkan sebagai task baru lebih dulu.

Sebelum eksekusi (khusus mode 3/4/5 yang scope-nya implementasi kode): cek `.claude/agents/README.md` → pemetaan **Domain → Subagent** dan evaluasi delegasi (lihat behavior "Pekerjaan Baru" di bawah, poin 1a). Jangan asumsikan default-nya "kerjakan sendiri".

Jika diskusi menyentuh domain spesifik, baca juga dokumen relevan dari:

- `product-discovery/01-business/` — Business Baseline v1.0
- `product-discovery/02-product/` — Product Baseline v1.0
- `product-discovery/03-user/` — User Discovery Baseline v1.0
- `product-discovery/04-ux/` — UX Planning Baseline v1.0
- `product-discovery/05-architecture/` — System Architecture Baseline v1.0
- `product-discovery/06-engineering/` — Engineering Planning Baseline v1.0

`product-discovery/` adalah **Source of Truth produk** dan berada sejajar (sibling) dengan `project-os/`, bukan di dalamnya.

### Proactive Consistency Check

Setiap kali membaca dokumen bertipe **Static Reference** (README, `PROJECT_OVERVIEW.md`, `PROJECT_RULES.md`, `SKILL.md`, atau dokumen baseline), periksa apakah dokumen tersebut memuat informasi yang seharusnya hanya ada di **Living Document** (`PROJECT_STATE.md`) — seperti status (✅ 🟡 ⏳), progress (%), atau phase/milestone aktif.

Jika ditemukan, **jangan diamkan atau perbaiki secara diam-diam**. Sebutkan secara eksplisit ke user sebagai inkonsistensi sebelum melanjutkan pekerjaan, lalu tawarkan untuk memperbaikinya (lihat behavior **Bug / Inkonsistensi Dokumen**).

Lihat `project-os/PROJECT_RULES.md` bagian **Document Type Classification** untuk aturan lengkapnya.

---

## Behavior per Jenis Interaksi

### 1. Diskusi / Tanya Jawab

**Trigger:** User bertanya, mendiskusikan ide, atau meminta pendapat.

**Steps:**

1. Pastikan jawaban selaras dengan baseline yang sudah ada (Business, Product, User).
2. Jika ada potensi konflik dengan keputusan sebelumnya, sebutkan ADR yang relevan.
3. Jangan menyarankan solusi yang keluar dari scope phase aktif (lihat `Active Conversation Mode` di PROJECT_STATE.md).
4. Jika diskusi menghasilkan insight penting, catat di `project-os/CONVERSATIONS.md`.

**Format CONVERSATIONS.md entry:**

```
## [YYYY-MM-DD] — [Topik Singkat]
**Phase:** [phase aktif]
**Summary:** [ringkasan diskusi dalam 2-3 kalimat]
**Key Decision/Insight:** [jika ada]
**Impact:** [apakah ada dokumen yang perlu diupdate?]
```

---

### 2. Brainstorming

**Trigger:** User ingin explore ide, kemungkinan, atau alternatif baru.

**Steps:**

1. Ikuti mode brainstorm secara bebas — jangan terlalu terikat baseline di fase ini.
2. Tandai jelas mana yang "spekulatif" vs "selaras dengan baseline".
3. Setelah brainstorm selesai, evaluasi hasilnya terhadap baseline yang ada.
4. Jika ada ide yang layak dipertimbangkan, catat di `project-os/BRAINSTORM.md`.

**Format BRAINSTORM.md entry:**

```
## [YYYY-MM-DD] — [Topik Brainstorm]
**Phase:** [phase aktif]
**Context:** [mengapa topik ini didiskusikan]
**Ideas:**
- [ide 1]
- [ide 2]
**Evaluation:** [selaras / bertentangan / perlu ADR / perlu validasi lebih lanjut]
**Next Action:** [discard / simpan untuk fase X / buat ADR / validasi dulu]
```

---

### 3. Pekerjaan Baru / Pembuatan Dokumen

**Trigger:** User meminta membuat dokumen baru, mengerjakan task, atau melanjutkan progress.

**Steps:**

1. Cek `PROJECT_STATE.md` — pastikan task ini sesuai phase aktif.
   1a. **Kalau task ini scope implementasi kode** (bukan dokumentasi/diskusi): pastikan ada tiketnya dulu (ADR-132). Kalau belum ada, tulis tiketnya sebelum baris kode pertama — tiket rilis di `tickets/vXX-*.md`, tiket yang lahir dari Known Issue di `tickets/known-issues.md` (ADR-134). Lalu cek field **Domain** tiket itu terhadap pemetaan Domain → Subagent di `.claude/agents/README.md`. Tentukan salah satu — kerjakan sendiri (scope trivial/dokumentasi), delegasikan ke satu subagent, atau jalankan **beberapa subagent paralel** kalau ada tiket independen (domain/file berbeda) yang tidak saling menyentuh. Ini langkah wajib (ADR-063), bukan opsional.
2. Cek `Active Conversation Mode` — pastikan action type diizinkan.
3. Baca dokumen baseline yang relevan sebelum membuat dokumen baru.
4. Ikuti format dokumen yang konsisten dengan dokumen existing (lihat contoh di folder yang sama).
5. Setelah selesai, update:
   - file tiket (`tickets/vXX-*.md` atau `tickets/known-issues.md`) — ubah status tiket. Jangan menambah cerita sesi
   - `project-os/AVAILABLE_TICKETS.md` — task yang menjadi ✅ keluar dari tabel antrian
   - `project-os/PROJECT_STATE.md` — hanya bila phase / milestone / Known Issues / fokus terdekat berubah. **Jangan** menyalin detail task ke sini (ADR-062)

**Definisi "tiket fitur selesai" (ADR-149, S-002):** tiket yang mengubah
perilaku produk (`apps/`, `packages/`) baru boleh `✅` bila ada tes E2E
Playwright golden path untuk fiturnya dan seluruh suite hijau di `local`
(`bun run test:e2e`). Hasilnya dilaporkan di deskripsi PR `feature/*` →
`staging`. Pengecualian: tiket dokumentasi, perubahan sepele tanpa perilaku
yang terlihat user, dan tiket tooling. Gerbang CI terhadap staging untuk PR
`staging` → `main` diatur di CI-D07, bukan di sini.

Jejak sesi adalah commit git. Tidak ada file changelog terpisah (ADR-131).

---

### 4. Planning Change / Perubahan Keputusan

**Trigger:** User ingin mengubah arah, scope, keputusan, atau baseline.

**Steps:**

1. Identifikasi apa yang berubah dan dampaknya terhadap dokumen yang sudah ada.
2. Evaluasi apakah perubahan ini memerlukan ADR baru di `DECISIONS.md`.

**Perubahan yang WAJIB masuk DECISIONS.md:**

- Target market / user segment
- Problem statement
- Product vision / scope
- MVP definition
- Arsitektur sistem
- Tech stack
- Repository strategy
- Domain / bounded context

3. Buat file ADR baru `project-os/decisions/ADR-[NNN]-[slug-judul].md` (satu file per ADR, bukan lagi append inline ke `DECISIONS.md`) dengan format:

```
## Decision ADR-[NNN]

### Title
[nama keputusan]

### Status
Accepted

### Date
[YYYY-MM-DD]

### Decision
[apa yang diputuskan]

### Reason
- [alasan 1]
- [alasan 2]

### Alternatives Considered
- [alternatif yang tidak dipilih]
```

Lalu tambahkan satu baris ke tabel indeks di `project-os/DECISIONS.md` (ADR# | Title | Status | Date | Ringkasan 1-baris | link file), di baris paling atas (indeks terurut terbaru-di-atas).

4. Update dokumen yang terdampak.
5. Update `PROJECT_STATE.md` — section **Snapshot** (kalau relevan dengan next tasks/blocker) dan **Recent Decisions (Ringkasan)** (geser satu ADR terlama keluar dari daftar 5 kalau sudah penuh).

---

### 5. Bug / Inkonsistensi Dokumen

**Trigger:** Ditemukan konflik, inkonsistensi, atau kesalahan antar dokumen.

**Steps:**

1. Identifikasi dokumen mana yang terlibat dan apa yang bertentangan.
2. Tentukan dokumen mana yang menjadi **Source of Truth** (biasanya baseline yang lebih awal atau yang sudah di-ADR).
3. Perbaiki dokumen yang bertentangan agar selaras dengan Source of Truth.
4. Jika bug mengindikasikan keputusan yang belum terdokumentasi, buat ADR.

---

## Aturan Context (Jangan Dilanggar)

- Jangan menyarankan implementasi kode jika `PROJECT_STATE.md` belum di phase Development.
- Jangan mengubah baseline (Business, Product, User) tanpa ADR baru.
- Jangan membuat dokumen di luar scope phase aktif.
- Selalu gunakan nama persona yang sudah ditetapkan: Raka, Maya, Sinta, Dimas, Lara.
- Selalu gunakan ID yang sudah ada (ADR-XXX, I-XX, A-XX, dll.) saat mereferensikan keputusan.
- Jika ada gap antara dokumen dengan realita phase, tanyakan ke user sebelum asumsi.
- Jangan memperbaiki inkonsistensi dokumen secara diam-diam — selalu sebutkan temuannya ke user (lihat **Proactive Consistency Check**).
- Jangan menyalin detail task (subtask, dependency, catatan teknis) ke `PROJECT_STATE.md` — tempatnya di `tickets/vXX-*.md` atau `tickets/known-issues.md` (ADR-134). `PROJECT_STATE.md` hanya menyebut ID + judul singkat (ADR-062).
- Jangan mendaur ulang ID task. Task yang dibatalkan ditandai `⏸️ Deferred` beserta alasannya, bukan dihapus.
- Ikuti preferensi kerja yang tercatat di `project-os/PROJECT_OVERVIEW.md` bagian **Developer Profile & Working Preferences**, dan tambahkan preferensi baru yang ditemukan ke sana.

---

## File Map (Source of Truth)

`project-os/` dan `product-discovery/` adalah folder top-level yang sejajar (sibling), masing-masing dengan tanggung jawab berbeda:

```
social-media-management/
├── project-os/         → Cara kerja: proses, aturan, keputusan, status
│   ├── README.md            → Penjelasan project OS
│   ├── PROJECT_OVERVIEW.md  → Apa yang dibangun
│   ├── ARCHITECTURE_OVERVIEW.md → High-level architecture (blueprint Figma)
│   ├── PROJECT_RULES.md     → Cara bekerja
│   ├── PROJECT_STATE.md     → Phase, milestone, Known Issues ← update setiap ada
│   │                           perubahan (baca "Snapshot" dulu untuk lookup cepat)
│   ├── AVAILABLE_TICKETS.md   → Antrian task yang belum selesai ← berhenti di sini
│   ├── tickets/             → Tiket per rilis (`vXX-*.md`) plus
│   │                           `known-issues.md` (ADR-134) ← buka hanya
│   │                           section tiket yang ID-nya sudah dipilih
│   ├── specs/               → Spec untuk kerja multi-sesi (ADR-131)
│   ├── DECISIONS.md         → Indeks ringkas ADR ← tambah 1 baris index per ADR baru
│   ├── decisions/           → Satu file per ADR (ADR-XXX-slug.md) ← full text di sini
│   ├── CONVERSATIONS.md     → Log diskusi penting ← update jika ada insight
│   └── BRAINSTORM.md        → Bank ide ← update dari sesi brainstorm
└── product-discovery/       → Source of Truth produk: business s/d engineering
    ├── README.md
    ├── 01-business/         → Business Discovery
    ├── 02-product/          → Product Planning
    ├── 03-user/             → User Discovery
    ├── 04-ux/               → UX Planning
    ├── 05-architecture/     → System Architecture
    └── 06-engineering/      → Engineering Planning
```

---

## Mapping task → baca dulu

| Jenis task                   | Context dulu                                 | Baseline minimal                                                                                        |
| ----------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Fitur / use-case              | `ctx-domain` + `ctx-implementation`           | BC di `05-architecture/` + UX di `04-ux/` + `rendering-strategy.md` (+ `ctx-business` untuk roles/MVP)    |
| Schema / migrasi              | `ctx-architecture` + `ctx-technical-context`  | `database-strategy.md` + `database-orm.md` + `apps/web/prisma/schema.prisma`                              |
| Auth / session                | `ctx-architecture` + `ctx-technical-context`  | `auth-architecture.md` + `auth-strategy.md`                                                               |
| Outstand / webhook / publish  | `ctx-architecture`                            | `integration-layer.md`                                                                                    |
| Jobs / cron                   | `ctx-architecture`                            | `background-jobs.md`                                                                                      |
| Env / deploy / CI             | `ctx-technical-context`                       | `environment-management.md`, `deployment-infrastructure.md`, `cicd-pipeline.md`                           |
| Coding conventions / DX       | `ctx-development`                             | `dx-tooling.md` + `code-conventions.md`                                                                   |
| UI component / styling        | `ctx-design` + `ctx-implementation`           | `apps/web/.claude/CLAUDE.md` + `monorepo-setup.md` + `design-tokens.md` + ADR-097                         |
| Desain / handoff UI           | `ctx-design`                                  | `04-ux/` + pointer artifact desain Postific (ADR-140; folder `design/` dihapus, ADR-045)                                      |

---

## Skills & subagent housekeeping

**Satu-satunya folder skill di project ini adalah `.claude/skills/<nama>/`.**
`.agents/skills/` sudah dihapus (ADR-064) supaya tidak ada dua salinan fisik
yang bisa divergen. Claude Code hanya membaca `.claude/skills/`; Cursor tetap
membaca folder yang sama lewat jalur kompatibilitasnya. Jalur kompatibilitas
itu adalah fallback, bukan mekanisme native utama — evaluasi ulang kalau di
masa depan pindah ke tool AI lain yang hanya comply ke standar terbuka
[Agent Skills](https://agentskills.io) (lokasi native: `.agents/skills/`)
tanpa special-case Claude.

Aturan untuk mencegah duplikasi/divergensi terulang:

1. **Jangan buat ulang folder `.agents/skills/`** kecuali ada keputusan baru
   yang eksplisit dari King Rezi untuk kembali memakainya.
2. Skill vendor/third-party (Prisma, Supabase, Vercel, Better Auth, dst.)
   biasanya dipasang lewat installer resmi (`npx skills add ...`) yang
   **defaultnya menulis ke `.agents/skills/`** — kalau itu terjadi lagi,
   pindahkan manual hasilnya ke `.claude/skills/<nama>` (bukan dibiarkan
   berdampingan dengan folder lain), lalu hapus folder `.agents/skills/`
   yang baru terbentuk itu.
3. Edit/tambah skill custom project langsung di `.claude/skills/<nama>/`.

Berkas panduan vendor panjang di dalam sebuah skill (mis. rules lengkap)
dinamai `REFERENCE.md`, bukan `AGENTS.md` — Cursor menyuntikkan setiap berkas
bernama `AGENTS.md` ke setiap pesan, jadi nama itu dicadangkan untuk pintu
masuk repo di root (T-116).

**Delegasi subagent (ADR-063):** perubahan sepele — satu berkas, tanpa batas
domain, tanpa permukaan UI (contoh: rename file, perbaikan satu baris di
dokumen, typo) — dikerjakan agen utama langsung, tidak perlu melalui evaluasi
Domain → Subagent di `.claude/agents/README.md`. Rantai delegasi (termasuk
Ridwan → Najwa → Gibran untuk implementasi fitur) tetap wajib begitu
pekerjaannya menyentuh domain kode (`apps/`, `packages/`) atau permukaan UI.
Kalau ragu apakah sebuah perubahan "sepele", perlakukan sebagai tidak sepele
dan jalankan evaluasi delegasi seperti biasa.

**Higiene sesi:** satu task per percakapan. Kalau sebuah sesi sudah
mengerjakan satu task sampai selesai dan diminta task baru yang tidak
berhubungan, catat ringkas task yang baru selesai di `CONVERSATIONS.md` (atau
pastikan sudah tercermin di status tiket/`PROJECT_STATE.md`), lalu sarankan
melanjutkan di sesi baru untuk task berikutnya — riwayat percakapan yang
panjang ikut terbayar di setiap giliran berikutnya di sesi yang sama.

---

## Additional Resources

- Untuk detail dokumen UX Planning: `product-discovery/04-ux/README.md`
- Untuk detail dokumen Engineering Planning: `product-discovery/06-engineering/README.md`
- Untuk aturan lengkap: `project-os/PROJECT_RULES.md`
