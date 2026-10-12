# AGENTS.md — Postific

Pintu masuk untuk AI coding agent. Baca file ini dulu di setiap sesi kerja pada repo ini.

## Purpose

Dokumen ini **bukan** Source of Truth produk. Ia mengarahkan agent ke dokumen yang benar, menegakkan aturan keras, dan mencegah duplikasi / asumsi yang bertentangan dengan baseline.

**Source of Truth:**

| Area                                | Lokasi                                     |
| ----------------------------------- | ------------------------------------------ |
| Status, phase, milestone, issue     | `project-manager/PROJECT_STATE.md`         |
| Backlog task (release/task/subtask) | `project-manager/TASKS.md` + `tasks/`      |
| Aturan kerja & governance           | `project-manager/PROJECT_RULES.md`         |
| Keputusan (ADR)                     | `project-manager/DECISIONS.md`             |
| Produk & engineering                | `product-discovery/`                       |
| Orientasi arsitektur (ringkas)      | `project-manager/ARCHITECTURE_OVERVIEW.md` |
| Alur kerja developer (mermaid)      | `project-manager/DEVELOPER_WORKFLOW.md`    |
| AI Context (ringkas, per domain)    | `context/`                                 |

## Wajib di awal sesi

1. Baca **Snapshot** di `project-manager/PROJECT_STATE.md` — phase, mode percakapan, fokus terdekat.
2. Kalau akan mengerjakan task: buka `project-manager/TASKS.md` (indeks), lalu **hanya** file `tasks/vXX-*.md` yang memuat task itu. Ikuti field **Baca dulu** pada task tersebut sebagai daftar bacaan minimal.
3. **Evaluasi delegasi subagent** (ADR-063) — kalau task itu scope implementasi kode: cek field **Domain**-nya terhadap pemetaan Domain → Subagent di `.claude/agents/README.md`, dan tentukan dikerjakan sendiri, satu subagent, atau beberapa subagent paralel (lihat poin di bawah kapan wajib paralel). Jangan lewati langkah ini hanya karena sudah biasa mengerjakan sendiri.
4. Ikuti skill project: `.claude/skills/project-os-navigator/SKILL.md`.
5. Untuk keputusan yang belum ada di baseline: ikuti `.claude/skills/proactive-clarification/SKILL.md`.
6. Setelah pekerjaan selesai: ikuti `.claude/skills/work-report-simple/SKILL.md`.
7. Untuk konteks teknis per domain: buka file `context/ctx-*.md` yang relevan (lihat `context/README.md`).

## AI Context layer (`context/`)

Struktur **opsi A** (aktif):

```
context/
├── README.md                  ← batas antar file + cara pakai
├── ctx-project.md             ← Project OS, state, rules, ADR
├── ctx-business.md            ← Business + Product + User
├── ctx-domain.md              ← Bounded context, shared types, boundary
├── ctx-architecture.md        ← Layer, ACL, jobs, auth arch, realtime
├── ctx-technical-context.md   ← Stack, env, Prisma, Better Auth, deploy/CI
├── ctx-development.md         ← DX, script, lint/test, aturan coding
├── ctx-implementation.md      ← Pola implementasi di apps/web & domains/
└── ctx-design.md              ← pointer UX (04-ux) + Claude Design (ADR-045)
```

**Aturan:** file `context/ctx-*.md` adalah **indeks + aturan operasional untuk agent** — menunjuk ke baseline, bukan menyalin ulang isi `product-discovery/` atau `project-manager/`. Jika konflik, baseline + ADR menang.

## Subagent kerja (`.claude/agents/`)

7 subagent kerja (Prabowo Feature Engineer, Mark UI Engineer, Neymar Product
Designer, Elon Backend Engineer, Ridwan Architecture Reviewer, Najwa QA
Engineer, Gibran Project Manager) didefinisikan di `.claude/agents/*.md` —
diklasifikasikan **Static Reference** (`PROJECT_RULES.md`), read-only (chmod
444), hanya diubah atas permintaan eksplisit user. Panduan pemakaian, aturan
orkestrasi paralel/sekuensial, dan pemetaan **Domain → Subagent** ada di
`.claude/agents/README.md`.

**Ini bukan referensi opsional** — lihat poin #3 di "Wajib di awal sesi"
(ADR-063, ditulis setelah audit menemukan AI jarang mendelegasikan karena
langkah ini sebelumnya tidak terhubung ke alur kerja manapun).

## Skills (`.claude/skills/`)

**Satu-satunya folder skill di project ini adalah `.claude/skills/<nama>/`.**
Folder `.agents/skills/` sempat ada (Cursor membacanya secara native, dan
juga membaca `.claude/skills/` untuk kompatibilitas) tapi **sudah dihapus**
per keputusan eksplisit King Rezi — supaya tidak ada dua salinan fisik yang
bisa divergen. Claude Code hanya membaca `.claude/skills/`; Cursor tetap bisa
membaca folder yang sama lewat jalur kompatibilitasnya.

**Konsekuensi yang perlu diingat:** jalur kompatibilitas Cursor untuk
`.claude/skills/` didokumentasikan sebagai fallback, bukan mekanisme native
utama — kalau di masa depan pindah/menambah tool AI lain yang hanya comply
ke standar terbuka [Agent Skills](https://agentskills.io) (lokasi native:
`.agents/skills/`) tanpa special-case Claude, skill di sini berisiko tidak
otomatis terbaca. Evaluasi ulang keputusan ini kalau situasi itu terjadi.

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

## Kompatibilitas tool: Claude Code ↔ Cursor (ADR-064)

Project ini dikerjakan di **dua tool**: Claude Code (utama) dan Cursor.
Sebagian aset agent terbaca di keduanya, sebagian tidak — tabel ini menetapkan
statusnya supaya tidak ada asumsi salah:

| Aset                                   | Claude Code                                     | Cursor                                            |
| -------------------------------------- | ----------------------------------------------- | ------------------------------------------------- |
| `AGENTS.md` (pintu masuk + hard rules) | ✅ via `CLAUDE.md`                              | ✅ native                                         |
| `.claude/skills/` (18 skill)           | ✅ satu-satunya lokasi                          | ✅ compatibility path                             |
| `.claude/agents/` (7 subagent kerja)   | ✅                                              | ✅ compatibility path                             |
| Config MCP (`xds` Astryx)              | ✅ `.mcp.json`                                  | ⚠️ `.cursor/mcp.json` — **file terpisah**         |
| Proteksi baca secret                   | ✅ `.claude/settings.json` (`permissions.deny`) | ⚠️ `.cursorignore` — **file terpisah**            |
| `.claude/launch.json` (preview server) | ✅                                              | ❌ tidak ada padanan — jalankan dev server manual |

**Dua pasang file kembar yang WAJIB dijaga sinkron.** Config MCP dan proteksi
secret tidak punya jalur kompatibilitas lintas tool — masing-masing tool hanya
membaca formatnya sendiri, dan tidak bisa disatukan lewat symlink tanpa
mengulang pola rapuh yang dibuang di ADR-064. Konsekuensinya:

1. Menambah/mengubah MCP server → ubah **`.mcp.json` dan `.cursor/mcp.json`**
   dalam perubahan yang sama. Formatnya identik (kunci `mcpServers`).
2. Menambah/mengubah pola file rahasia → ubah **`permissions.deny` di
   `.claude/settings.json` dan `.cursorignore`** dalam perubahan yang sama.
   Kalau hanya satu yang diubah, salah satu tool kehilangan proteksinya
   tanpa peringatan apa pun.

Aturan lain (skill, subagent, hard rules, alur dokumentasi) berlaku identik di
kedua tool — tidak ada instruksi khusus per-tool selain tabel di atas.

## Stack & layout (ingat cepat)

- Runtime: **Bun** · App: **Next.js** (`apps/web`) · Shared: `packages/shared`
- Auth: **Better Auth** · ORM: **Prisma 7** · DB/Storage/Realtime: **Supabase**
- Integrasi sosial: **Outstand** (via Anti-Corruption Layer), bukan SDK network langsung
- Arsitektur: **Modular Monolith + DDD** · domain di `apps/web/src/domains/`
- UI: **shadcn/ui** (ADR-097, membalik ADR-041) · Stone theme token (ADR-087) · **Tailwind** sebagai styling langsung; migrasi dari Astryx sudah tuntas 100% (rilis v0.7, T-102)
- Deploy: **Railway** (web + cron) · CI: **GitHub Actions**
- Staging web: URL & detail deploy di `PROJECT_STATE.md` (KI-025) /
  `COMPLETE_TASK.md` — pakai untuk smoke test manual sebelum PR
  `staging → main` (lihat CI-D03).

Detail: `project-manager/PROJECT_OVERVIEW.md` dan `product-discovery/06-engineering/`.

## Aturan keras (jangan dilanggar)

1. Panggil user dengan sebutan **King Rezi** di seluruh komunikasi/output
   teks — bukan "user", "Anda", atau nama lain. Berlaku untuk AI utama dan
   seluruh subagent di `.claude/agents/`.
2. Biasakan menggunakan **"5 Magic Words"** dalam komunikasi/output teks:
   tolong (please), maaf (sorry), terima kasih (thank you), permisi (excuse
   me), dan silakan (please/go ahead). Berlaku untuk AI utama dan seluruh
   subagent di `.claude/agents/`.
3. Nama AI utama (main agent) di project ini adalah **"Jokowi"**. Setiap kali
   dipanggil dengan nama tersebut, sediakan laporan singkat berisi:
   (a) 3 pekerjaan terakhir yang sudah dikerjakan,
   (b) seluruh task yang masih belum dikerjakan (Next Tasks / In Progress),
   (c) pembahasan penting sebelumnya yang relevan,
   dan jika ada, tutup dengan rekomendasi langkah berikutnya untuk diajukan
   ke King Rezi.
4. Jangan ubah Architecture / Engineering / Product / Business baseline tanpa ADR baru di `DECISIONS.md`.
5. Entry points (RSC, Server Actions, Route Handlers, Middleware) **tidak** boleh berisi business logic — hanya memanggil Application Service.
6. Domain logic **tidak** mengimpor Prisma, Supabase client, atau HTTP client Outstand.
7. Cross-domain: lewat public API module domain lain — bukan import implementasi lintas folder.
8. Shared types hanya di `packages/shared` (ID, enum, value object) — tanpa business logic.
9. Supabase JS client: **hanya** Realtime + Storage. CRUD lewat Prisma.
10. Status progress (% / ✅ / phase aktif / milestone) **hanya** di
    `PROJECT_STATE.md` — jangan taruh di README atau baseline. **Satu
    pengecualian (ADR-062):** status per-task dan per-subtask ada di
    `project-manager/TASKS.md` + `tasks/vXX-*.md`. Pengecualian ini tidak
    meluas ke phase/milestone/overall progress.
11. Persona kanonikal: Raka, Maya, Sinta, Dimas, Lara.
12. Bahasa komunikasi & dokumentasi project: **Bahasa Indonesia** (kecuali user meminta lain).
13. Jangan commit / push kecuali user meminta eksplisit. Jangan commit secret (`.env.local`, kredensial).
14. UI produk memakai **shadcn/ui** (ADR-097, membalik ADR-041). Wrapper
    dibuat selektif. Migrasi dari Astryx sudah tuntas 100% (rilis v0.7,
    T-102 `✅ Done`, 0 dependency `@astryxdesign/*` tersisa) — lihat
    `tasks/v07-astryx-shadcn-migration.md`.
15. Sebelum menulis atau mengubah komponen UI, baca
    `apps/web/.claude/CLAUDE.md` (agent docs resmi, lihat bawah) dan/atau
    cek registry/CLI/MCP shadcn lokal. Jangan menebak nama komponen, props,
    atau pola styling.
16. Sebelum mengubah apapun di Claude Design (via `DesignSync`) atau
    menambah kontrol pembanding (toggle/switch antar variant) di UI manapun,
    baca `.claude/skills/claude-design-scope-discipline/SKILL.md`. Jangan
    mengubah default/state yang sudah disetujui user sebagai efek samping
    fitur baru — insiden nyata di ADR-052.
17. **Setiap task yang diperintahkan King Rezi wajib diklasifikasi dulu:**
    UI/UX-related (menyentuh screen, komponen visual, layout, style, atau
    flow yang terlihat user) atau bukan (backend murni: schema, service,
    job, integrasi tanpa permukaan visual baru).
    - Kalau **UI/UX-related**: sebelum menulis kode, cek dulu ke Claude
      Design (project "Social Media Management", via `DesignSync`) apakah
      screen/komponen yang relevan sudah ada rancangannya di sana.
    - Kalau **belum ada** di Claude Design: **STOP** — jangan lanjut
      menulis kode UI. Beri tahu King Rezi secara eksplisit bahwa rancangan
      belum ada, dan tunggu King Rezi membuat/mengonfirmasi desainnya
      (langsung atau lewat Neymar Product Designer) sebelum implementasi
      dilanjutkan.
    - Kalau **sudah ada** rancangannya tapi elemen yang mau diimplementasikan
      **ambigu** — lebih dari satu pola shadcn/ui sama-sama valid secara
      teknis (mis. list bisa `Item`/`ItemGroup` ATAU `Table`; dialog dengan
      beberapa variant; row yang bisa diklik-penuh atau tidak) dan Claude
      Design **belum mengunci pola konkret**-nya (tidak ada komentar
      "SYNCED"/"LOCKED PATTERN" atau penjelasan struktur setara di file
      `components/*.html`/`templates/*.html` yang relevan, atau di tabel
      **Components** `readme.md`): **STOP** — jangan menebak salah satu
      opsi sendiri. Wajib tanya King Rezi dulu lewat `AskUserQuestion`
      (pola sama `.claude/skills/proactive-clarification/SKILL.md`),
      sertakan opsi konkret (nama primitive + struktur wrapper) yang sedang
      dipertimbangkan, sebelum menulis kode. Ini persis mekanisme yang
      gagal di KI-054/KI-055 (AI menebak pola "masuk akal" yang ternyata
      bukan yang King Rezi mau) — lihat `tasks/v07-astryx-shadcn-migration.md`
      § T-103 untuk latar belakang penuh.
    - Kalau **bukan** UI/UX-related: lanjut seperti biasa, tidak perlu cek
      Claude Design.
    - Tujuan: King Rezi sering lupa memastikan desain sudah ada sebelum
      minta implementasi — AI adalah safety net yang wajib menahan langkah
      ini, bukan asumsi diam-diam. Berbeda dari aturan reminder sinkronisasi
      docs↔Claude Design (ADR-056), yang bersifat reminder _setelah_ perubahan —
      rule ini adalah gate _sebelum_ implementasi dimulai.
18. Sebelum commit/push apa pun (setelah izin eksplisit user sesuai rule 13),
    cek dulu branch aktif. Kalau HEAD ada di `main` **atau** `staging`, buat
    branch baru dulu (`feature/<nama>` atau `fix/<nama>`, checkout dari state
    saat itu) sebelum commit — jangan pernah commit langsung ke salah satu
    dari dua branch itu. Ini menegakkan alur promosi CI-D03
    (`product-discovery/06-engineering/cicd-pipeline.md`):
    `feature/* → PR → staging → PR → main`, bukan commit langsung ke
    keduanya. Berlaku simetris untuk `main` dan `staging` — jangan cuma
    diterapkan ke `main`.
19. Untuk kapabilitas Outstand baru: **jangan** membangun Fake adapter di
    jalur produksi. `OUTSTAND_API_KEY` wajib (`getOutstandAdapter()` throw
    kalau kosong — ADR-119). Tes unit/use-case memakai **double lokal** di
    file tes (bukan singleton produksi). Kalau kredensial/webhook secret
    belum ada dan pekerjaan terhambat, selesaikan lewat double di tes +
    stub/throw jelas di Real adapter untuk method yang belum di-wire —
    jangan menghidupkan lagi fallback Fake di factory.

## Workflow shadcn/ui wajib (ADR-097)

**shadcn/ui** menggantikan Astryx sebagai fondasi component system permanen
(ADR-097, membalik ADR-041). Migrasi sudah tuntas 100% (rilis v0.7, T-102
`✅ Done`, 0 dependency `@astryxdesign/*` tersisa) — lihat
`tasks/v07-astryx-shadcn-migration.md`.

Untuk setiap task UI di `apps/web`: baca `apps/web/.claude/CLAUDE.md` dulu —
dokumen ini akan ditulis ulang mengikuti workflow shadcn CLI/MCP (ADR-097
poin 5) — lalu ikuti workflow CLI/MCP yang disebutkan di sana. Jangan
menebak command spesifik di sini; `apps/web/.claude/CLAUDE.md` adalah sumber
kebenaran untuk command yang benar-benar berlaku.

shadcn/ui adalah kode sumber yang di-_copy_ langsung ke repo, bukan
dependency package tertutup seperti Astryx — tidak ada isu versioning
Beta/canary yang perlu dikelola di sini.

**MCP server shadcn** (didaftarkan di `.mcp.json` **dan** `.cursor/mcp.json`
sekaligus — dua file kembar, jaga sinkron, lihat "Kompatibilitas tool")
menggantikan peran `xds` (Astryx) untuk pencarian/lookup komponen. Untuk
exploration/pencarian awal, MCP boleh dipakai; untuk keputusan final
props/API yang dipakai di kode, tetap verifikasi lewat CLI/registry lokal
supaya konsisten dengan versi yang benar-benar ter-install.

## Mode kerja

Lihat `Active Conversation Mode` di `PROJECT_STATE.md` untuk fase, objective,
action yang diizinkan, dan pembatasan terkini. Jangan menduplikasi status atau
fase aktif di file ini.

## Mapping task → baca dulu

| Jenis task                   | Context dulu                                 | Baseline minimal                                                                                       |
| ---------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Fitur / use-case             | `ctx-domain` + `ctx-implementation`          | BC di `05-architecture/` + UX di `04-ux/` + `rendering-strategy.md` (+ `ctx-business` untuk roles/MVP) |
| Schema / migrasi             | `ctx-architecture` + `ctx-technical-context` | `database-strategy.md` + `database-orm.md` + `apps/web/prisma/schema.prisma`                           |
| Auth / session               | `ctx-architecture` + `ctx-technical-context` | `auth-architecture.md` + `auth-strategy.md`                                                            |
| Outstand / webhook / publish | `ctx-architecture`                           | `integration-layer.md`                                                                                 |
| Jobs / cron                  | `ctx-architecture`                           | `background-jobs.md`                                                                                   |
| Env / deploy / CI            | `ctx-technical-context`                      | `environment-management.md`, `deployment-infrastructure.md`, `cicd-pipeline.md`                        |
| Coding conventions / DX      | `ctx-development`                            | `dx-tooling.md` + `code-conventions.md`                                                                |
| UI component / styling       | `ctx-design` + `ctx-implementation`          | `apps/web/.claude/CLAUDE.md` + `monorepo-setup.md` + `design-tokens.md` + ADR-097                      |
| Desain / handoff UI          | `ctx-design`                                 | `04-ux/` + pointer Claude Design (folder `design/` dihapus, ADR-045)                                   |

## Setelah mengubah sesuatu

- Update status task di `project-manager/TASKS.md` **dan** file
  `project-manager/tasks/vXX-*.md` terkait (dua-duanya, dalam perubahan yang
  sama — kalau tidak, hitungan di indeks jadi salah).
- Update `project-manager/PROJECT_STATE.md` bila phase / milestone / Known
  Issues / fokus terdekat berubah. Jangan menyalin detail task ke sana.
- Section **"Completed (Ringkasan)"** di `PROJECT_STATE.md` dibatasi **5
  item terakhir** (bukan sekadar target, ini hitungan aktual — cek
  `grep -c "^\* \*\*"` pada section itu setelah edit). Setiap menambah
  bullet baru, **hapus bullet paling lama** di bawahnya supaya total tetap
  5 — isi lengkapnya sudah aman di `COMPLETE_TASK.md`, jadi tidak ada info
  yang hilang. Ditemukan drift ke 7 item pada 2026-08-10 karena aturan ini
  cuma teks di dalam file itu sendiri, bukan hard rule — sekarang dipindah
  ke sini agar terlihat setiap awal sesi.
- Catat di `project-manager/COMPLETE_TASK.md` (append entri baru saja — jangan baca isi lengkapnya kecuali diperintah eksplisit King Rezi).
- Insight diskusi penting → `project-manager/CONVERSATIONS.md`.
- Keputusan material → ADR di `project-manager/DECISIONS.md`.

## Related

- Root setup: `README.md`
- Skills: `.claude/skills/`
- AI Context index: `context/README.md`
- Alur kerja developer (mermaid): `project-manager/DEVELOPER_WORKFLOW.md`
