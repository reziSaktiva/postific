# AGENTS.md — Postific

Pintu masuk untuk AI coding agent. Baca file ini dulu di setiap sesi kerja
pada repo ini. File ini adalah **pintu**, bukan ensiklopedia (ADR-133) — detail
yang sudah punya rumah di dokumen lain dirujuk lewat satu baris, bukan
disalin ulang. Kalau konflik antara pointer di sini dan isi dokumen yang
dirujuk, dokumen yang dirujuk menang.

## Source of Truth

| Area                             | Lokasi                                |
| -------------------------------- | ------------------------------------- |
| Status, phase, milestone, issue  | `project-os/PROJECT_STATE.md`         |
| Antrian tiket tersedia           | `project-os/AVAILABLE_TICKETS.md`     |
| Tiket, termasuk yang selesai     | `project-os/tickets/`                 |
| Spec (kerja multi-sesi)          | `project-os/specs/`                   |
| Aturan kerja & governance        | `project-os/PROJECT_RULES.md`         |
| Keputusan (ADR)                  | `project-os/DECISIONS.md`             |
| Produk & engineering             | `product-discovery/`                  |
| Referensi visual (artifact)      | `context/ctx-design.md` (ADR-140)     |
| Orientasi arsitektur (ringkas)   | `project-os/ARCHITECTURE_OVERVIEW.md` |
| Alur kerja developer (mermaid)   | `project-os/DEVELOPER_WORKFLOW.md`    |
| AI Context (ringkas, per domain) | `context/`                            |

## Wajib di awal sesi

1. Baca **Snapshot** di `project-os/PROJECT_STATE.md` — phase, mode percakapan, fokus terdekat.
2. Kalau akan mengerjakan tiket: buka `project-os/AVAILABLE_TICKETS.md` dan berhenti di situ untuk memilih ID. Baru kemudian buka **satu** section di file yang disebut kolom File (`tickets/vXX-*.md`, atau `tickets/known-issues.md` untuk tiket dari Known Issue — ADR-134). Kode hanya diubah kalau tiketnya sudah ada (ADR-132). Deskripsi mengikuti ADR-131 (docs → spec → tiket → implement).
3. **Evaluasi delegasi subagent** (ADR-063) kalau task itu scope implementasi kode atau UI — lihat pemetaan Domain → Subagent dan pengecualian perubahan sepele di navigator (poin 4) dan `.claude/agents/README.md`.
4. Ikuti skill project: `.claude/skills/project-os-navigator/SKILL.md` — cascade baca, mapping task → dokumen, higiene sesi, dan housekeeping skill/subagent ada di sana.
5. Untuk keputusan yang belum ada di baseline: ikuti `.claude/skills/proactive-clarification/SKILL.md`.
6. Setelah pekerjaan selesai: ikuti `.claude/skills/work-report-simple/SKILL.md`.
7. Untuk konteks teknis per domain: buka file `context/ctx-*.md` yang relevan — peta lengkap dan batas antar file ada di `context/README.md`.

## Aturan keras (jangan dilanggar)

1. Panggil user dengan sebutan **King Rezi** di seluruh komunikasi/output
   teks — bukan "user", "Anda", atau nama lain. Biasakan **"5 Magic Words"**:
   tolong, maaf, terima kasih, permisi, silakan. Nama AI utama di project ini
   adalah **"Jokowi"** — setiap kali dipanggil dengan nama itu, sediakan
   laporan singkat: (a) 3 pekerjaan terakhir, (b) task yang belum dikerjakan,
   (c) pembahasan penting sebelumnya yang relevan, ditutup rekomendasi
   langkah berikutnya bila ada. Berlaku untuk AI utama dan seluruh subagent.
2. Jangan ubah Architecture / Engineering / Product / Business baseline tanpa ADR baru di `DECISIONS.md`.
3. Entry points (RSC, Server Actions, Route Handlers, Middleware) **tidak** boleh berisi business logic — hanya memanggil Application Service.
4. Domain logic **tidak** mengimpor Prisma, Supabase client, atau HTTP client Outstand.
5. Cross-domain: lewat public API module domain lain — bukan import implementasi lintas folder. Shared types hanya di `packages/shared` (ID, enum, value object) — tanpa business logic.
6. Supabase JS client: **hanya** Realtime + Storage. CRUD lewat Prisma.
7. Status progress (% / ✅ / phase aktif / milestone) **hanya** di
   `PROJECT_STATE.md` — jangan taruh di README atau baseline. **Satu
   pengecualian (ADR-062, ADR-131):** status per-tiket ada di
   `project-os/AVAILABLE_TICKETS.md` (yang belum selesai),
   `project-os/tickets/vXX-*.md` (tiket rilis, termasuk yang selesai), dan
   `project-os/tickets/known-issues.md` (tiket dari Known Issue, ADR-134).
8. Persona kanonikal: Raka, Maya, Sinta, Dimas, Lara. Bahasa komunikasi & dokumentasi project: **Bahasa Indonesia** (kecuali user meminta lain).
9. Jangan commit / push kecuali user meminta eksplisit. Jangan commit secret (`.env.local`, kredensial). Sebelum commit/push: kalau HEAD ada di `main` **atau** `staging`, buat branch baru dulu (`feature/<nama>` atau `fix/<nama>`) — jangan pernah commit langsung ke salah satu dari dua branch itu (alur CI-D03: `feature/* → PR → staging → PR → main`).
10. **UI produk memakai shadcn/ui** (ADR-097). **Setiap task yang diperintahkan
    King Rezi wajib diklasifikasi dulu**: UI/UX-related (menyentuh screen,
    komponen visual, layout, style, atau flow yang terlihat user) atau bukan.
    - Kalau **UI/UX-related**: sebelum menulis kode, cek dulu ke artifact
      desain Postific (artifact "Postific", pointer di `context/ctx-design.md`,
      dibaca lewat tool `Artifact` action `read`; ADR-140) apakah
      screen/komponen yang relevan sudah ada rancangannya di sana. Kalau
      **belum ada**: **STOP**, beri tahu King Rezi, tunggu rancangan dibuat
      dan dikonfirmasi di galeri "Postific Design Review" sebelum lanjut. Kalau sudah ada tapi elemen yang mau
      diimplementasikan **ambigu** (lebih dari satu pola shadcn/ui sama-sama
      valid dan rancangan belum mengunci pola konkretnya): **STOP**,
      tanya King Rezi lewat `AskUserQuestion` dengan opsi konkret, jangan
      menebak (insiden KI-054/KI-055, lihat `tickets/v07-astryx-shadcn-migration.md` § T-103).
    - Kalau **bukan** UI/UX-related: lanjut seperti biasa.
    - Sebelum menulis/mengubah komponen UI, baca juga `apps/web/.claude/CLAUDE.md`
      dan jangan menebak nama komponen/props/pola styling. Sebelum mengubah
      apapun di artifact desain atau menambah kontrol pembanding (toggle/switch
      antar variant), baca `.claude/skills/claude-design-scope-discipline/SKILL.md`
      dulu (insiden ADR-052).
11. Untuk kapabilitas Outstand baru: **jangan** membangun Fake adapter di
    jalur produksi. `OUTSTAND_API_KEY` wajib (`getOutstandAdapter()` throw
    kalau kosong — ADR-119). Tes unit/use-case memakai double lokal di file
    tes, bukan singleton produksi.
12. Config MCP dan proteksi baca secret adalah dua pasang file kembar
    (`.mcp.json`/`.cursor/mcp.json`, `permissions.deny`/`.cursorignore`) yang
    **wajib diubah bersamaan** — detail dan alasannya di
    `context/ctx-technical-context.md` (ADR-064).
13. Perubahan kode di `apps/` dan `packages/` wajib punya tiket di
    `project-os/tickets/` (ADR-132), boleh dibuat di sesi yang sama sebelum
    baris kode pertama. Known Issue yang masih terbuka punya tiket (ADR-132).
14. Kalau kebenaran produk berubah, urutan tulisnya: `product-discovery/`,
    lalu `context/` hanya bila penunjuknya berubah, lalu `project-os/` (ADR,
    tiket, phase). Jangan menyalin paragraf yang sama ke ketiganya.

## Stack & layout (ingat cepat)

- Runtime: **Bun** · App: **Next.js** (`apps/web`) · Shared: `packages/shared`
- Auth: **Better Auth** · ORM: **Prisma 7** · DB/Storage/Realtime: **Supabase**
- Integrasi sosial: **Outstand** (via Anti-Corruption Layer), bukan SDK network langsung
- Arsitektur: **Modular Monolith + DDD** · domain di `apps/web/src/domains/`
- UI: **shadcn/ui** (ADR-097) · Tailwind sebagai styling langsung
- Deploy: **Railway** (web + cron) · CI: **GitHub Actions**
- Staging web: URL dan detail deploy di `PROJECT_STATE.md` (KI-025).

Detail: `project-os/PROJECT_OVERVIEW.md`, `context/ctx-technical-context.md`, dan `product-discovery/06-engineering/`.

## Subagent kerja

7 subagent kerja (Prabowo Feature Engineer, Mark UI Engineer, Neymar Product
Designer, Elon Backend Engineer, Ridwan Architecture Reviewer, Najwa QA
Engineer, Gibran Project Manager) didefinisikan di `.claude/agents/*.md` —
Static Reference, read-only, hanya diubah atas permintaan eksplisit user.
Panduan pemakaian, aturan orkestrasi, dan pemetaan Domain → Subagent ada di
`.claude/agents/README.md`.

## Skills (`.claude/skills/`)

Satu-satunya folder skill di project ini adalah `.claude/skills/<nama>/`.
Aturan lengkap (kenapa, cara mencegah duplikasi, penamaan `REFERENCE.md`
untuk panduan vendor panjang) ada di `.claude/skills/project-os-navigator/SKILL.md`
bagian **Skills & subagent housekeeping**.

## Workflow shadcn/ui (ADR-097)

Untuk setiap task UI di `apps/web`: baca `apps/web/.claude/CLAUDE.md` dulu —
dokumen itu adalah sumber kebenaran untuk workflow CLI/MCP shadcn yang
berlaku. Jangan menebak command di sini.

## Mode kerja

Lihat `Active Conversation Mode` di `PROJECT_STATE.md` untuk fase, objective,
action yang diizinkan, dan pembatasan terkini.

## Mapping task → baca dulu, dan setelah mengubah sesuatu

Tabel "task → context/baseline" dan checklist "setelah mengubah sesuatu" ada
di `.claude/skills/project-os-navigator/SKILL.md` — jangan diduplikasi di
sini.

## Related

- Root setup: `README.md`
- Skills: `.claude/skills/`
- AI Context index: `context/README.md`
- Alur kerja developer (mermaid): `project-os/DEVELOPER_WORKFLOW.md`
