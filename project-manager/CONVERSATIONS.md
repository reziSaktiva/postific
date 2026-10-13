# CONVERSATIONS

Dokumen ini berisi log percakapan penting antar sesi yang memiliki dampak terhadap project — insight baru, keputusan yang muncul dari diskusi, atau konteks yang perlu diingat di sesi berikutnya.

> Diisi otomatis oleh AI setiap kali ada diskusi yang menghasilkan insight atau perubahan signifikan.

---

# Format Entry

```
## [YYYY-MM-DD] — [Topik Singkat]
**Phase:** [phase aktif saat diskusi]
**Summary:** [ringkasan diskusi dalam 2-3 kalimat]
**Key Insight / Decision:** [jika ada]
**Impact:** [dokumen mana yang perlu diupdate, jika ada]
```

---

## 2026-10-08 — Pola berulang: gap kontrak Outstand baru ketemu pas verifikasi OpenAPI spec sungguhan (T-112, ADR-123)

**Phase:** Phase 6 / M8 Development

**Summary:** T-112 (wiring `importPosts`/`fetchImportJobStatus` sungguhan)
menemukan DUA gap kontrak sekaligus yang baru ketahuan setelah diverifikasi
langsung ke OpenAPI spec resmi Outstand — signature `fetchImportJobStatus`
butuh `outstandAccountId` di path (bukan cuma `importJobId`), dan endpoint
status job ternyata tidak membawa data post sama sekali (perlu panggilan
`GET /v1/posts` tambahan). Ini kejadian ke sekian kalinya pola yang sama
terjadi di integrasi Outstand — lihat ADR-113 (komentar/reply), ADR-115/
ADR-116 (Facebook), ADR-118 (Pinterest `board_id`) untuk presedan
sebelumnya.

**Key Insight / Decision:** Dokumentasi/asumsi awal Outstand (termasuk ADR
desain awal seperti ADR-093) cenderung tidak cocok 100% dengan shape API
sungguhan begitu benar-benar diverifikasi via OpenAPI spec resmi — pola ini
sudah cukup sering terjadi sehingga sebaiknya jadi default expectation,
bukan kejutan, untuk SETIAP endpoint Outstand baru yang belum pernah
diverifikasi langsung. Implikasi praktis: task yang scope-nya "wiring
endpoint Outstand baru" sebaiknya selalu dianggap berpotensi mengubah
kontrak publik (`IOutstandAdapter`) yang sudah ditulis sebelumnya, bukan
cuma mengisi stub yang sudah ada — rencanakan breaking change sebagai
kemungkinan nyata, bukan edge case.

**Impact:** Tidak ada perubahan proses formal yang diminta King Rezi di
sesi ini (murni insight), jadi tidak menulis ADR baru untuk pola ini
sendiri. Dicatat di sini supaya sesi berikutnya yang mengerjakan endpoint
Outstand baru (atau alumni mirip) mengecek riwayat ini sebelum berasumsi
kontrak existing sudah cukup.

---

## 2026-10-09 — Pola baru: endpoint Outstand yang ASYNC butuh polling status, bukan cek sekali

**Phase:** Phase 6 / M8 Development

**Summary:** Tuntasnya T-112.5 (verifikasi end-to-end) menemukan bug
terpisah dari gap kontrak OpenAPI yang sudah dicatat sesi 2026-10-08 di
atas — `ImportPostsTriggerUseCase.runImportSync` memanggil
`fetchImportJobStatus` cuma sekali langsung setelah `importPosts()`, padahal
job import Outstand betulan diproses async di sisi mereka. Status pertama
yang didapat hampir selalu `pending`/`queued`/`running`, bukan hasil final
— jadi selalu ditandai gagal walau job sebenarnya akan sukses beberapa
detik kemudian. Fix: method `pollImportJobStatus` baru, polling tiap 2
detik sampai status resolve atau timeout 25 detik (margin dari budget 30
detik BG-D05 job runner).

**Key Insight / Decision:** Beda dari insight 2026-10-08 (soal shape
request/response tidak cocok dokumentasi), ini soal **timing** — endpoint
Outstand yang mengembalikan "job id" untuk dicek statusnya lagi (pola
`POST .../imports` → `GET .../imports/{id}`) kemungkinan besar genuinely
async di sisi Outstand, bukan sinkron-tapi-dibungkus-job-id. Default
expectation untuk integrasi Outstand berikutnya yang punya pola serupa
(submit lalu cek status terpisah): rencanakan polling dengan timeout sejak
awal, jangan asumsikan satu kali cek status sudah cukup — gejalanya mirip
bug ("selalu gagal/pending") padahal sebenarnya desain yang kurang
mengakomodasi job async.

**Impact:** Tidak ada ADR baru (tidak mengubah kontrak publik
`IOutstandAdapter`, murni perilaku internal use-case). Dicatat di sini
sebagai referensi kalau ada integrasi Outstand async lain di masa depan
(mis. publish job lain yang pakai pola submit+poll serupa).

---

## 2026-09-26 — Supabase MCP `read_only=true` dihapus sementara untuk keperluan fix data live (KI-073–076)

**Phase:** Phase 6 / M8 Development

**Summary:** Saat verifikasi live KI-073–076, akun test Instagram
`turanilkerl` tanpa sengaja ter-*Disconnect* (lihat **KI-078** baru) dan
tidak ada jalur UI untuk reconnect (unique constraint `outstandAccountId`
menahan). King Rezi memutuskan memperbaikinya langsung lewat SQL manual
(`UPDATE workspace_connected_accounts SET status='active'`) supaya
verifikasi bisa lanjut, sehingga parameter `&read_only=true` di URL MCP
Supabase (yang tadinya mencegah write lewat MCP) dihapus atas permintaan
eksplisit King Rezi.

**Key Insight / Decision:** Perubahan dilakukan di **kedua** file kembar
sekaligus (`.mcp.json` dan `.cursor/mcp.json`, konsisten aturan
kompatibilitas tool ADR-064) — bukan cuma satu, supaya Claude Code dan
Cursor tidak divergen soal proteksi write MCP. Ini pengecualian sesaat
untuk kebutuhan operasional (fix data), bukan keputusan permanen menghapus
proteksi read-only — perlu dipertimbangkan ulang apakah `read_only=true`
mau dikembalikan di sesi berikutnya sekarang datanya sudah beres.

**Impact:** `.mcp.json`, `.cursor/mcp.json` (URL Supabase MCP kehilangan
`&read_only=true`). Tidak ada perubahan skema/dokumen governance lain dari
keputusan ini sendiri.

---

## 2026-09-25 — Sisa channel dan post Fake di luar filter T-106.4

**Phase:** Phase 6 / M8 Development

**Summary:** Setelah T-106.1–.4, browser masih menampilkan channel dan post palsu. Filter cleanup hanya `outstand_post_id` `fake-post-%` dan URL `fake.outstand.local`. Akun di `workspace_connected_accounts` (`fake-%` / `mock-%`) dan post tanpa id Outstand tidak terhapus.

**Key Insight / Decision:** King Rezi meminta subtask baru, bukan task terpisah. T-106.5 mencakup seluruh sisa data Fake/mock di DB bersama dev/staging. T-106 kembali 🟡 In Progress.

**Impact:** `tasks/v02-publishing-mvp.md` § T-106, indeks `TASKS.md`, Snapshot `PROJECT_STATE.md`.

## 2026-09-25 — Hapus FakeOutstandAdapter dilacak sebagai task, bukan Known Issue

**Phase:** Phase 6 / M8 Development

**Summary:** Setelah T-025, post ber-id `fake-post-…` masih tampil karena sisa QA di database, sementara `FakeOutstandAdapter` tetap jalur produksi kalau `OUTSTAND_API_KEY` kosong (ADR-059). King Rezi meminta agar adapter itu dihilangkan dari project.

**Key Insight / Decision:** Ini pekerjaan terencana, bukan bug. Dicatat sebagai T-106 (⏳), bukan KI. Kode baru dilarang sebelum ADR yang mengamendemen ADR-059 berstatus Accepted. Menghapus kelas adapter tidak otomatis menghapus 22 baris post palsu; pembersihan data ada di T-106.4.

**Impact:** `tasks/v02-publishing-mvp.md`, indeks `TASKS.md`, hitungan backlog di Snapshot `PROJECT_STATE.md`, entri `COMPLETE_TASK.md`.

## 2026-09-02 — Gap token warna semantik `--success`/`--warning` belum ada di Stone theme shadcn

**Phase:** M8 Development (v0.7 migrasi Astryx → shadcn/ui, ADR-097)

**Summary:** Saat migrasi Accept Invite (T-097.3) ke shadcn/ui, Mark UI Engineer menemukan Stone theme yang sudah dipetakan ke CSS variable shadcn (T-095.5/T-096.1) hanya berisi token `--destructive`, tanpa padanan `--success`/`--warning`. Astryx lama punya `EmptyState color="success"/"warning"/"error"` untuk 3 state Accept Invite (success/expired/invalid). Ridwan Architecture Reviewer memverifikasi ulang secara independen lewat grep `globals.css` dan mengonfirmasi temuan yang sama.

**Key Insight / Decision:** Tanpa token resmi, tidak boleh mengarang hex/token warna baru di kode tanpa ADR (`AGENTS.md` rule 15) — jadi state "invalid" dipetakan ke `text-destructive` (token yang memang ada), sedangkan "expired"/"success" sengaja dibiarkan netral. Ini keputusan sementara, bukan solusi final — King Rezi perlu memutuskan apakah menambah token `--success`/`--warning` ke Stone theme (perlu ADR baru, mengamandemen pemetaan T-095.5) atau tetap netral selamanya untuk state-state itu.

**Impact:** Dicatat sebagai **KI-041** (Open) di `project-manager/PROJECT_STATE.md`, referensi implementasi di `project-manager/tasks/v07-astryx-shadcn-migration.md` § T-097. Belum ada ADR baru — menunggu keputusan King Rezi terlebih dulu.

---

## 2026-09-09 — Scope retry manual publishing: single-target, bukan whole-post

**Phase:** M8 Development (v0.2 Publishing MVP, T-034.4)

**Summary:** Saat mengerjakan T-034.4 (aksi retry manual untuk target publishing yang gagal), muncul pertanyaan yang belum dijawab ADR-092: karena `outstandPostId` bersifat post-level (satu ID untuk SEMUA target/akun dalam satu post, hasil redesain kontrak 1-call-semua-target), retry untuk satu target yang gagal secara teknis bisa berarti recreate seluruh post (delete+create ulang, sesuai rekomendasi resmi Outstand) atau hanya recreate target yang gagal saja. Pertanyaan ini diajukan langsung ke King Rezi lewat `AskUserQuestion`, bukan diasumsikan.

**Key Insight / Decision:** King Rezi memilih **single-target** — retry hanya me-recreate akun yang gagal, target lain di post yang sama yang sudah `published` tidak disentuh sama sekali. Alasannya: whole-post-recreate berisiko me-re-publish ulang konten yang sudah sukses tayang di akun lain (duplikat konten, UX buruk), sementara desain UI Claude Design yang sudah dikonfirmasi sebelumnya (KI-048) memang menempatkan tombol "Coba Lagi" per-baris akun, bukan per-post — jadi single-target juga konsisten dengan desain yang sudah ada.

**Impact:** Dicatat sebagai **ADR-102** (melengkapi ADR-092, tidak membatalkan) di `project-manager/DECISIONS.md`. Implementasi: kolom Prisma baru `PublishingPostTarget.retryOutstandPostId`, method adapter baru `IOutstandAdapter.deletePost`, use-case `retry-failed-target.use-case.ts`. Dengan T-034.4 selesai mengikuti keputusan ini, **T-034 tuntas 4/4 subtask, `✅ Done`** — detail di `project-manager/tasks/v02-publishing-mvp.md` § T-034.

---

## 2026-08-31 — Pola bug: backend RBAC benar, tapi UI-level gate lupa dicek (T-093.4)

**Phase:** M8 Development

**Summary:** Saat verifikasi RBAC end-to-end T-093 (3 akun real Owner/Admin/Creator), Najwa QA Engineer menemukan Creator tetap bisa mengakses penuh halaman `/settings/members` (termasuk data member + email lengkap terkirim ke client) padahal `roles-permissions.md` menetapkan Creator "Tidak ada akses" ke halaman itu. Root cause: `MembersTable` hanya menyembunyikan tombol aksi per baris, tidak pernah mengecek role si pengunjung halaman itu sendiri — sementara backend (`assertActorCanManageMembers`, dipakai `removeMember`/`updateMemberRole`/`inviteMember`) sudah benar sejak awal, sehingga tidak ada mutasi tidak sah yang pernah berhasil.

**Key Insight / Decision:** RBAC assertion di service layer melindungi **mutasi**, tapi tidak otomatis melindungi **exposure data lewat halaman/komponen read-only** — keduanya perlu gate terpisah. Pola aman: gate akses halaman (redirect kalau role tidak berhak) harus dicek **di server, sebelum fetch data**, bukan cuma menyembunyikan elemen UI setelah data sudah terkirim ke client. Untuk task RBAC lain (mis. verifikasi role di screen lain), checklist QA sebaiknya eksplisit memisahkan "mutasi diblokir?" dari "halaman/data ikut ter-gate untuk role yang tidak berhak?" — dua pertanyaan berbeda, code review yang hanya menelusuri service layer bisa lolos padahal UI-level gate-nya lupa.

**Impact:** Fix `WorkspaceService.canManageMembers` + gate server-side di `apps/web/src/app/(app)/settings/members/page.tsx` (commit `6fdf272`). Dicatat di `project-manager/tasks/v01-foundation.md` § T-093.4, `project-manager/COMPLETE_TASK.md` (entri 2026-08-31).

---

## 2026-08-18 — Batas wrapper Astryx: `TimeInput` real-time constraint ditolak King Rezi

**Phase:** M8 Development

**Summary:** Saat implementasi T-029 (Schedule Picker Draft Editor), ditemukan `TimeInput` Astryx tidak membatasi input real-time (elemen internal `<input type="text">` tanpa `maxLength`/`pattern`, tanpa prop resmi untuk itu). Sempat dicoba mitigasi via wrapper `onKeyDownCapture`/`onPaste` (level "wrapper selektif", bukan swizzle — secara arsitektur diizinkan ADR-041) dengan varian `status` error saat blur untuk feedback.

**Key Insight / Decision:** King Rezi menolak wrapper ini secara eksplisit — dianggap belum sesuai harapan (tidak menangkap paste/drag-drop/IME sepenuhnya, berisiko konflik dengan state internal `TimeInput` yang tidak dikontrol), bukan solusi final meski secara teknis "boleh" dalam batas ADR-041. Wrapper dihapus dari kode, gap dicatat sebagai KI-030 (Open) — menunggu Astryx menambah prop resmi. Preseden: batas wrapper selektif bukan cuma soal "boleh secara arsitektur", tapi juga soal kualitas hasil — kalau workaround-nya rapuh, lebih baik dicatat sebagai gap terbuka daripada dipaksakan.

**Impact:** `project-manager/PROJECT_STATE.md` § KI-030, `project-manager/COMPLETE_TASK.md` (entri 2026-08-18 T-029).

---

## 2026-08-10 — Dua keputusan turunan untuk rencana hapus `[slug]` dari routing

**Phase:** M8 Development

**Summary:** Rencana perubahan routing & Settings (hapus dynamic segment
`[slug]`, workspace context pindah ke cookie, gabung "Workspace Settings" +
"User Settings" jadi "Organization Settings" + "Account Settings") punya 2
keputusan turunan yang masih terbuka sebelum 14 file baseline
(`product-discovery/` + `context/`) bisa ditulis ulang — lihat catatan
"tahap eksekusi" di plan terkait. King Rezi diminta memutuskan lewat
`AskQuestion` (bukan diasumsikan AI), dengan pilihan yang sudah dikurasi.

**Key Insight / Decision:**
1. **Nama route group pengganti `[slug]`** (lawan `(auth)`) di
   `monorepo-setup.md`: **`(app)`** — pasangan idiomatis untuk `(auth)`
   (pre-login vs aplikasi utama pasca-login), konvensi Next.js yang umum,
   netral terhadap detail implementasi. Route group ini membungkus Home,
   Publish, Engage, Analyze, Start Page, Settings — layout dengan sidebar +
   workspace context dari cookie, tanpa tampil di URL.
2. **Nasib field `Workspace.slug`** di data model
   (`domain-model.md`, `database-strategy.md`, `updateWorkspace` di
   `application-layer.md`): **dipertahankan sebagai internal unique
   identifier (non-URL)** — bukan dihapus total. Deskripsi field berubah
   dari "URL identifier unik" menjadi "internal unique identifier, tidak
   dipakai di routing/URL" (rasion: referensi human-readable di
   log/debugging/support, dan future-proofing kalau multi-workspace
   URL-based direvisit post-MVP). Kolom `workspaces.slug` (termasuk index
   terkait) tetap ada di skema, hanya keterangannya yang direvisi saat 14
   file baseline ditulis ulang.

**Impact:** Belum ada file baseline yang diubah sesi ini (rewrite 14 file
tetap di luar scope, menunggu eksekusi terpisah). Keputusan ini jadi input
wajib saat rewrite `monorepo-setup.md`, `domain-model.md`,
`database-strategy.md`, `application-layer.md` dilakukan. ADR baru untuk
perubahan routing & Settings secara keseluruhan tetap wajib dibuat saat
eksekusi (bukan sesi ini), sesuai catatan di plan terkait dan hard rule #4.

---

## 2026-08-10 — KI-019: kode ikut Design System untuk footer sidebar (avatar vs tombol teks)

**Phase:** M8 Development

**Summary:** KI-019 mencatat mismatch elemen UI footer sidebar — Design
System (Claude Design, `components/navigation.html`) memakai avatar bulat
berisi inisial, sedangkan `WorkspaceSideNav.tsx` memakai tombol teks nama/
email. King Rezi memutuskan arah resolusinya: kode mengikuti Design System
(bukan sebaliknya, dan Design System tidak direvisi). Mark UI Engineer
mengimplementasikan (ganti `button` `DropdownMenu` jadi `isIconOnly` dengan
`icon: <Avatar ... />`), lalu diverifikasi manual di browser (light/dark
mode, dropdown Profile/Logout normal, tanpa regresi).

**Key Insight / Decision:** Untuk KI-019, kode menyesuaikan Design System
untuk footer sidebar. Kasus lain memerlukan keputusan eksplisit sesuai
konteksnya.

**Impact:** `PROJECT_STATE.md` (KI-019 dihapus, resolved), `COMPLETE_TASK.md`
(entri baru). Tidak ada ADR baru — bukan keputusan arsitektur/domain/
teknologi material. KI-020 (layout `justify="between"`) resolved terpisah
di PR #59 — lihat entri KI-020 di `PROJECT_STATE.md`/`COMPLETE_TASK.md`.

---

## 2026-07-29 — Astryx agent docs & MCP server: manual vs resmi, project-scoped vs global

**Phase:** M8 Development

**Summary:** User menanyakan apakah "Workflow Astryx wajib" di `AGENTS.md`
sesuai dokumentasi resmi Astryx atau cuma buatan AI — jawabannya buatan
manual (ADR-041), bukan output CLI. Diganti dengan agent docs resmi
(`apps/web/.claude/CLAUDE.md`, hasil `astryx init --features agents --agent
claude`). Dilanjutkan setup MCP server Astryx (`xds`) khusus project ini
(bukan global) via `.mcp.json` di root repo — sempat gagal terdeteksi cukup
lama karena dua sebab: (1) field `"type": "url"` dari contoh dokumentasi
Astryx ternyata tidak valid untuk Claude Code (harus `"http"`/`"sse"`/`"ws"`),
dan (2) sesi/chat yang sudah berjalan tidak re-scan `.mcp.json` — butuh
sesi/chat baru. Proses troubleshooting juga menemukan app punya 3 UI
berbeda yang mirip tapi tidak sama: Directory/Connectors (marketplace
publik, bukan untuk custom server), "Local MCP servers" → Edit Config
(untuk `claude_desktop_config.json` **global**, bukan project), dan `/mcp`
command bawaan (yang benar-benar baca `.mcp.json` project). Setelah field
`type` diperbaiki, server akhirnya connect di background pada sesi yang
sudah berjalan (tidak butuh dialog approval eksplisit seperti dugaan awal).

**Key Insight / Decision:** (1) Selalu bedakan config **project-scoped**
(`.mcp.json` di root repo, ikut di-commit, khusus project) vs **global**
(`claude_desktop_config.json` di `~/Library/Application Support/Claude/`,
berlaku semua project) sebelum menambah MCP server — user secara eksplisit
memilih project-scoped supaya tidak "bocor" ke project lain. (2) Contoh
config dari dokumentasi vendor pihak ketiga (Astryx) tidak selalu cocok
1:1 dengan schema Claude Code — field `type` wajib divalidasi lewat
dokumentasi resmi Claude Code (`code.claude.com/docs/en/mcp`), bukan
disalin mentah.

**Impact:** `AGENTS.md`, `apps/web/.claude/CLAUDE.md` (baru), `.mcp.json`
(baru), `DEVELOPER_WORKFLOW.md`, `CHANGELOG.md`, `PROJECT_STATE.md` — sudah
diupdate dan di-commit di branch `docs/astryx-agent-docs-and-mcp`.

---

## 2026-07-28 — Folder `design/` dihapus — bukan acuan AI/engineering

**Phase:** M8 Development

**Summary:** Audit sinkronisasi dokumentasi menemukan `design/` punya 4
inkonsistensi kecil (version mismatch, section ketinggalan). User bertanya
lebih dalam: apakah `design/` benar-benar dibutuhkan untuk mengerjakan UI?
Ditelusuri lewat `context/ctx-design.md` sendiri — jawabannya tidak; SoT UI
yang benar-benar dipakai AI adalah `04-ux/` (alur), `design-tokens.md`
(token), dan Astryx CLI lokal (komponen). `design/` cuma paket handoff untuk
designer manusia yang belum join project. Karena menganggur tanpa dipakai,
disepakati dihapus dengan versi ringan: pindahkan pointer Claude Design yang
masih berguna, baru hapus sisanya.

**Key Insight / Decision:** ADR-045 — hapus folder `design/` seluruhnya;
pointer project Claude Design (project ID, akses, `DesignSync`) dipindah ke
`context/ctx-design.md`. Tidak mengubah ADR-038 (SoT token tetap
`design-tokens.md`) maupun ADR-042 (Claude Design tetap handoff tool) — hanya
mencabut keberadaan folder `design/` itu sendiri. Saat designer benar-benar
join, paket handoff disusun ulang dari `04-ux/` + `design-tokens.md`.

**Impact:** `DECISIONS.md` (ADR-045), `context/ctx-design.md` (ditulis
ulang), `PROJECT_STATE.md`, `CHANGELOG.md`, dan 10 dokumen lain yang tadinya
merujuk `design/` (`AGENTS.md`, `context/README.md`,
`context/ctx-technical-context.md`, `PROJECT_OVERVIEW.md`, `README.md`,
`DEVELOPER_WORKFLOW.md`, `.agents/skills/project-os-navigator/SKILL.md`,
`product-discovery/README.md`, `06-engineering/README.md`,
`06-engineering/design-tokens.md`, `04-ux/README.md`).

---

## 2026-07-23 — Astryx sebagai fondasi UI permanen

**Phase:** M7 complete → siap M8 Development

**Summary:** Designer baru tersedia setelah implementasi feature selesai.
Project Owner menetapkan Astryx sebagai fondasi komponen permanen, bukan
prototype sementara. Selama M8, feature memakai neutral theme Astryx; visual
direction dan design tokens final diterapkan setelah designer masuk.

**Key Insight / Decision:** ADR-041 menggantikan shadcn/ui dengan Astryx,
mempertahankan Tailwind hanya untuk layout dan responsive composition, memakai
wrapper selektif, serta menerima risiko Beta dengan exact pin, tanpa
canary/swizzle awal, update manual, staging, dan smoke test Next.js 16.
ADR-041 mengamendemen ADR-035 dan urutan kerja ADR-038.

**Impact:** ADR-041 ditambahkan; `PROJECT_STATE.md` dan catatan Project Owner
diperbarui. Alignment Engineering Baseline/AI Context, instalasi, dan smoke test
masih menjadi pekerjaan berikutnya.

---

## 2026-07-23 — Sinkronisasi Project OS setelah ADR-040

**Phase:** M7 complete → siap M8 Development

**Summary:** Setelah ADR-040 menetapkan kontrak resmi Outstand, Project OS,
overview arsitektur, AI Context, dan catatan pertanyaan Project Owner
diselaraskan. Alignment dokumentasi baseline dan schema/migration dicatat
selesai, sementara implementasi runtime tetap belum diklaim.

**Key Insight / Decision:** M8 wajib memakai tiga webhook
`post.published`/`post.error`/`account.token_expired`, durable-before-ACK dengan
retry internal, Engagement komentar/reply via sync 30 menit + manual refresh,
Supabase original + Outstand media working copy, dan X BYOK manual di dashboard
Outstand. Tidak ada DM/comment webhook.

**Impact:** `ARCHITECTURE_OVERVIEW.md`, `PROJECT_STATE.md`, context operasional,
dan section Outstand 3–5 di `TEMP-project-owner-questions.md` diperbarui.
Handler, adapter, job runner, sync runtime, dan UI tetap next task M8.

---

## 2026-07-21 — Content Format (Post/Reel/Story/Pin) wajib di MVP

**Phase:** M7 complete → siap M8 Development

**Summary:** Setelah membandingkan Create Post Outstand (FB/IG punya Post·Reel·Story; TikTok tanpa radio itu; Pinterest = Pin), PM menyatakan fitur ini **harusnya ada**. Dipilih opsi MVP sekarang: tipe konten per platform + update Product/UX/domain + ADR. Review konsistensi menemukan gap (UF-01, confirmation summary, default Pinterest vs DB, context pointers) dan sudah dirapikan.

**Key Insight / Decision:** ADR-039 — `ContentFormat` per `PostTarget`; IG/FB: post/reel/story; Pinterest: pin; TikTok & lainnya: post. Outstand memfasilitasi; ACL yang memetakan. Default DB `post` ≠ izin bisnis untuk Pinterest.

**Impact:** Product + Architecture + UX + shared enum + migrasi Prisma; laporan ke PM; implementasi UI Draft Editor menjadi bagian M8.

---

## 2026-07-21 — Lokasi SoT design tokens setelah design siap

**Phase:** M7 complete → siap M8 Development

**Summary:** PM menanyakan cara menerapkan hasil design ke repo. Disepakati tidak menjadikan folder `design/` sebagai acuan token. SoT visual tokens disiapkan di Engineering: `design-tokens.md`, diisi setelah design di-approve, lalu di-mirror ke kode.

**Key Insight / Decision:** ADR-038 — lokasi SoT = `product-discovery/06-engineering/design-tokens.md`. UX (`04-ux/`) tetap SoT alur; `design/` tetap handoff saja.

**Impact:** Template `design-tokens.md` + panduan PM; update Engineering README, `design/README.md`, context, `DECISIONS.md`, `CHANGELOG.md`, `PROJECT_STATE.md`.

---

## 2026-07-21 — Daftar platform sosial yang didukung (aditif)

**Phase:** M7 complete → siap M8 Development

**Summary:** Product owner meminta catatan daftar platform yang tersedia di app: Facebook, Instagram, Threads, Pinterest, TikTok, YouTube. Dibandingkan dengan baseline/enum lama (Instagram, Facebook, Twitter/X, LinkedIn, TikTok, YouTube). Diputuskan opsi **tambah saja** — Threads & Pinterest masuk; Twitter/X & LinkedIn tetap.

**Key Insight / Decision:** ADR-037 — daftar resmi jadi 8 platform. Source of Truth: `SocialPlatform` di `packages/shared` + Shared Types di `domain-model.md`.

**Impact:** Enum shared, Architecture/UX docs terkait platform, `DECISIONS.md`, `CHANGELOG.md`, `PROJECT_STATE.md` diupdate.

---

## 2026-07-17 — AI Context opsi A (struktur + coding rules)

**Phase:** M7 complete → siap M8 Development

**Summary:** Sebelum scaffold `context/`, dievaluasi apakah 8 file `ctx-*` sudah sesuai kebutuhan. Disepakati **opsi A**: pertahankan struktur screenshot; Product+User masuk `ctx-business`; UX masuk `ctx-design`; aturan coding di `ctx-development` dan pola fitur di `ctx-implementation`. Scaffold kemudian dieksekusi sebagai indeks + aturan operasional (bukan duplikasi baseline).

**Key Insight / Decision:** Jangan tambah `ctx-product` / `ctx-ux` / `ctx-coding-rules` terpisah. Batas keras antar file ditulis di `context/README.md` agar architecture / technical / development / implementation tidak overlap.

**Impact:** Folder `context/` dibuat; `AGENTS.md`, `README.md`, `PROJECT_STATE.md`, `CHANGELOG.md` diupdate. Next: M8 Development.

---

## 2026-07-14 — Project Overview & Gambaran Folder Structure

**Phase:** Phase 2 — UX Planning (M4)

**Summary:** Diskusi tentang gambaran keseluruhan project berdasarkan semua dokumentasi yang sudah dibuat. User memahami bahwa project belum masuk ke tahap coding. Dijelaskan tech stack (Bun, Next.js, TypeScript, Modular Monolith, DDD), proyeksi folder structure (Hybrid Monorepo dengan `apps/web` dan `packages/`), dan mapping domain ke code (`modules/workspace`, `modules/publishing`, dll.).

**Key Insight:** User belum memulai Next.js sama sekali — perlu overview yang menyeluruh sebelum masuk ke fase implementasi.

**Impact:** Tidak ada perubahan dokumen. Digunakan sebagai referensi orientasi project.

---

## 2026-07-14 — Pembuatan Skill Project OS Navigator

**Phase:** Phase 2 — UX Planning (M4)

**Summary:** User meminta pembuatan Cursor skill agar AI selalu bekerja dalam konteks project tanpa harus diperintahkan ulang setiap sesi. Skill mencakup behavior untuk 5 jenis interaksi: diskusi, brainstorm, pekerjaan baru, planning change, dan bug/inkonsistensi dokumen.

**Key Insight:** User menginginkan workflow yang lebih otomatis — AI harus tahu apa yang harus dilakukan berdasarkan jenis interaksi, bukan menunggu instruksi eksplisit.

**Impact:** Skill `project-os-navigator` dibuat di `.cursor/skills/project-os-navigator/SKILL.md`. `CONVERSATIONS.md` dan `BRAINSTORM.md` dibuat sebagai dokumen baru.

---

## 2026-07-14 — Klasifikasi Tipe Dokumen (Static Reference vs Living Document vs Append-Only)

**Phase:** Phase 2 — UX Planning (M4)

**Summary:** User mengangkat keresahan bahwa banyak README memuat status indicator (✅ 🟡 ⏳) yang berpotensi menyebabkan inkonsistensi karena informasi yang sama harus diupdate di banyak tempat. Didiskusikan solusi: mengklasifikasikan dokumen menjadi tiga tipe — Static Reference (README, rules, baseline — tidak boleh memuat status), Living Document (`PROJECT_STATE.md` — satu-satunya source of truth status), dan Append-Only (`DECISIONS.md`, `CHANGELOG.md`, dll — hanya bertambah).

**Key Insight:** Root cause dari risiko inkonsistensi dokumentasi adalah percampuran tanggung jawab "deskripsi struktur" dengan "status yang berubah-ubah" dalam satu dokumen yang sama. User menyetujui pendekatan single source of truth untuk status.

**Impact:** Aturan **Document Type Classification** ditambahkan ke `PROJECT_RULES.md`. Seluruh README di `product-discovery/` dan `SKILL.md` dibersihkan dari status indicator.

---

## 2026-07-14 — Pemisahan `product-discovery/` dari `project-manager/`

**Phase:** Phase 2 — UX Planning (M4)

**Summary:** User memindahkan folder `product-discovery/` keluar dari `project-manager/` menjadi folder top-level yang sejajar. Alasan yang disampaikan: `product-discovery/` adalah dokumentasi lengkap produk (Source of Truth produk) dan tidak lagi punya hubungan struktural dengan `project-manager/`, yang kini didedikasikan khusus untuk membantu proses kerja Rezi — terdokumentasi dengan jelas apa yang AI dan Rezi lakukan, diputuskan, dan kerjakan.

**Key Insight:** `project-manager/` bukan tempat menyimpan pengetahuan produk, melainkan "Project OS" pribadi untuk proses kerja. Ini memperjelas mental model: `project-manager/` = bagaimana kita bekerja, `product-discovery/` = apa yang kita bangun.

**Impact:** ADR-011 ditambahkan di `DECISIONS.md`. `project-manager/README.md` ditulis ulang total. Seluruh path referensi antar dokumen (~30 file) diperbaiki untuk mengikuti struktur baru.

---

## 2026-07-15 — Keputusan Pra-Architecture: Domain Boundary, Storage & Deployment

**Phase:** Phase 3 — System Architecture (M5)

**Summary:** Melengkapi sisa keputusan pra-architecture yang belum diputuskan dari sesi sebelumnya. Domain Boundary Strictness ditetapkan ke Pragmatic Boundary (Opsi C) — domain tidak boleh saling import implementasi langsung, tapi boleh berbagi tipe dan kontrak melalui shared package. Storage ditetapkan ke Supabase Storage (konsisten dengan platform pilihan). Railway sebagai deployment platform dikonfirmasi ulang (sudah disebut di ADR-010).

**Keputusan yang Ditetapkan:**
1. **Domain Boundary Strictness** — Pragmatic Boundary: domain tidak boleh import implementasi langsung dari domain lain; shared types/contracts boleh melalui `packages/shared`. Bisa di-tighten nanti jika dibutuhkan.
2. **Storage** — Supabase Storage (built-in, terintegrasi RLS, satu platform dengan database).
3. **Deployment** — Railway (sudah tercatat di ADR-010, dikonfirmasi ulang).

**Impact:** Seluruh keputusan pra-architecture kini lengkap. Siap masuk ke dokumentasi `domain-model.md`.

---

## 2026-07-15 — Keputusan Pra-Architecture: Database, Auth & Real-time

**Phase:** Phase 3 — System Architecture (M5)

**Summary:** Diskusi dan penetapan 4 keputusan penting sebelum masuk ke dokumentasi M5. Dimulai dari Database Strategy (Supabase Cloud vs Self-host), dilanjutkan ke Auth library, kemudian Real-time Strategy. Outstand webhook dievaluasi dan disimpulkan sudah meng-cover kebutuhan event dari platform sosial — sehingga real-time client-side tidak diperlukan untuk MVP.

**Keputusan yang Ditetapkan:**
1. **Database** — Supabase PostgreSQL Cloud. Prinsip portabilitas dijaga: akses database melalui ORM, Supabase client hanya di layer paling luar. Migrasi ke self-host di masa depan dimungkinkan.
2. **Multi-tenancy** — Row-Level Security (RLS) dengan kolom `workspace_id`. Schema tunggal untuk semua workspace.
3. **Auth** — Better Auth sebagai auth library.
4. **Real-time** — In-app notification + tombol manual refresh. Tidak ada polling, WebSocket, atau SSE. Outstand webhook meng-handle status event dari platform sosial ke server; user di-notify dan bisa refresh manual.

**Keputusan yang Masih Pending:**
- Domain Boundary Strictness (#1) — akan dibahas saat topik Domain Model
- Background Job & Scheduler (#4) — belum dibahas

**Impact:** 4 keputusan ini perlu masuk sebagai ADR di DECISIONS.md sebelum atau saat dokumentasi `product-discovery/05-architecture/` dibuat.

---

## 2026-07-15 — Briefing M5: System Architecture Planning

**Phase:** Phase 2 — UX Planning (M4) → transisi ke M5 — System Architecture

**Summary:** Briefing awal untuk memasuki M5 — System Architecture. Disepakati bahwa M5 dan M6 adalah dua milestone paling krusial sebelum development dimulai. Diidentifikasi 4 keputusan penting yang belum diputuskan dan 7 topik yang perlu didefinisikan secara berurutan. Setiap topik akan dibahas di chat terpisah, masing-masing menghasilkan ADR. Room ini (chat ini) ditetapkan khusus sebagai briefing & navigasi M5+M6.

**4 Keputusan Penting yang Belum Diputuskan:**
1. **Domain Boundary Strictness** — seberapa ketat isolasi antar domain: boleh saling import langsung, atau harus melalui interface/service layer?
2. **Database Strategy** — pilihan database (PostgreSQL via Supabase/Railway?) dan strategi multi-tenancy / workspace isolation.
3. **Real-time Strategy** — apakah Queue, status konten, dan notifikasi tim perlu WebSocket/SSE, atau polling cukup untuk MVP?
4. **Background Job & Scheduler** — arsitektur untuk scheduled posting: Bun native, library terpisah, atau platform job queue?

**7 Topik yang Perlu Didefinisikan di M5 (berurutan berdasarkan dependency):**
1. Domain Model & Bounded Context
2. Database Strategy
3. Application Layer (Next.js App Router ↔ domain logic)
4. External Integration Layer (Outstand API + webhook handling)
5. Background Job & Scheduler
6. Real-time Strategy
7. Security & Auth Architecture

**Key Insight:** User menegaskan pendekatan sequential — topik dibahas satu per satu karena setiap keputusan dapat mempengaruhi keputusan berikutnya (dependency order).

**Impact:** Perlu transisi phase setelah ADR-013 (UX Planning Baseline) ditetapkan. Dokumen `product-discovery/05-architecture/` belum ada — akan dibuat saat mulai dokumentasi M5.

---

## 2026-07-14 — Evaluasi: Apakah `project-manager/` Sudah Menjadi Asisten Pribadi?

**Phase:** Phase 2 — UX Planning (M4)

**Summary:** User bertanya apakah struktur `project-manager/` saat ini sudah cukup untuk disebut sebagai asisten pribadi mengenai project ini. Evaluasi menemukan beberapa gap: (1) `PROJECT_OVERVIEW.md` masih memuat status/phase yang melanggar aturan Document Type Classification yang baru dibuat, (2) `CONVERSATIONS.md` tidak konsisten diisi meski ada beberapa diskusi bermakna, (3) belum ada tempat mencatat preferensi kerja personal Rezi, (4) belum ada mekanisme proaktif untuk mengecek konsistensi dokumen.

**Key Insight:** Sebuah "asisten pribadi" yang baik tidak cukup hanya tahu tentang project — ia juga harus tahu bagaimana orangnya suka bekerja, dan harus disiplin menjalankan aturan yang ia buat sendiri.

**Impact:** `PROJECT_OVERVIEW.md` dibersihkan dari status basi. Section **Developer Profile & Working Preferences** ditambahkan ke `PROJECT_OVERVIEW.md`. Entry `CONVERSATIONS.md` yang terlewat ditambahkan retroaktif. `SKILL.md` ditambah langkah proactive consistency check.

## 2026-07-17 — Prisma ditetapkan sebagai ORM formal (ADR-031)

**Phase:** Phase 4 — Engineering Planning (M6)

**Summary:** User mengklarifikasi bahwa Prisma sudah pernah diputuskan (sempat tercatat di PROJECT_OVERVIEW lalu terhapus saat audit ADR-017). Setelah membandingkan tiga opsi (Prisma, Supabase client saja, hybrid), user menetapkan kembali **Prisma sebagai ORM formal**.

**Key Decision/Insight:** ADR-031 mengamandemen ADR-017: repository CRUD memakai Prisma; Supabase client dibatasi ke Realtime dan Storage. Prisma Migrate + Supavisor pooling menjadi standar M6.

**Impact:** `database-orm.md` dibuat; Overview, monorepo-setup, auth-strategy, application-layer, dan database-strategy migration section diselaraskan.

---

## 2026-07-17 — AI Context layer (`context/` + `AGENTS.md`)

**Phase:** M7 complete → siap M8 Development

**Summary:** User menanyakan apakah dokumentasi baseline sudah cukup tanpa AI Context. Disepakati dokumentasi = Source of Truth, sementara AI Context tetap diperlukan sebagai lapisan operasional agent. User meminta struktur folder `context/` persis seperti referensi screenshot (`ctx-project`, `ctx-business`, `ctx-domain`, `ctx-architecture`, `ctx-technical-context`, `ctx-development`, `ctx-implementation`, `ctx-design`, + `README.md`), dan meminta `AGENTS.md` dibuat di root.

**Key Insight / Decision:** AI Context tidak menggantikan `product-discovery/` / `project-manager/`; file `ctx-*.md` berisi indeks + aturan operasional. `AGENTS.md` adalah pintu masuk; isi penuh `context/` menyusul sebagai next task.

**Impact:** `AGENTS.md` dibuat; `PROJECT_STATE.md` + `CHANGELOG.md` diupdate. Scaffold `context/` belum dieksekusi.

---

## 2026-07-17 — Engineering Planning Review (M6)

**Phase:** Phase 4 — Engineering Planning (M6)

**Summary:** User meminta Engineering Planning Review untuk verifikasi konsistensi seluruh 8 dokumen M6. Review lintas dokumen terhadap Architecture Baseline dan ADR-028–035 menemukan 6 inkonsistensi (3 Major, 3 Minor). Temuan dicatat sebagai ENG-REVIEW-01 s/d ENG-REVIEW-06; perbaikan belum dijalankan menunggu konfirmasi user.

**Key Insight:** Keputusan inti M6 (Railway/SEA, Prisma, Better Auth, CI/CD, env, DX, dependency) saling selaras; gap utama ada di kelengkapan App Router (`/api/jobs`, `/api/auth`) dan cookie Secure lokal vs hardcode auth-strategy.

**Impact:** `PROJECT_STATE.md` Known Issues diisi; perbaikan dokumen M6 + Baseline v1.0 menunggu setelah temuan Fixed.

---

## 2026-07-17 — Perbaikan ENG-REVIEW-01 s/d ENG-REVIEW-06

**Phase:** Phase 4 — Engineering Planning (M6)

**Summary:** User meminta perbaikan seluruh temuan Engineering Planning Review. Enam inkonsistensi diperbaiki di `monorepo-setup.md`, `auth-strategy.md`, dan `cicd-pipeline.md`.

**Key Insight:** App Router M6 sekarang mencakup Better Auth catch-all dan job runner; cookie Secure lokal selaras environment-management; label domain MVP diklarifikasi (9 + Billing post-MVP).

**Impact:** Known Issues ENG-REVIEW ditutup; next task = penetapan Engineering Planning Baseline v1.0.

---

## 2026-07-17 — Engineering Planning Baseline v1.0 (ADR-036)

**Phase:** Phase 4 → Phase 5 (M6 ditutup, M7 dibuka)

**Summary:** User menyetujui penetapan Engineering Planning Baseline setelah semua temuan review Fixed. ADR-036 menetapkan seluruh 8 dokumen `06-engineering/` sebagai Baseline v1.0. M6 ditutup; project masuk M7 — Repository & Bootstrap.

**Key Decision/Insight:** AS-D04 (email provider) tetap Known Issue dan tidak memblokir bootstrap. Mode percakapan mengizinkan Bootstrap scaffolding, bukan feature implementation.

**Impact:** `DECISIONS.md` ADR-036; `PROJECT_STATE.md` phase/milestone ke M7; navigator skill diselaraskan ke label Baseline.

---

## 2026-07-30 — Draft Editor jadi Modal Reusable (ADR-052) — Tahap Dokumentasi

**Phase:** Phase 6 / M8 Development

**Summary:** User meminta New Post & Edit Draft (KSP-05 Draft Editor) diubah dari full-page route menjadi modal reusable, supaya alur kerja terasa lebih cepat/ringan dan konsisten dengan pola aplikasi lain. Diskusi berlangsung bertahap: klarifikasi motivasi & trade-off lewat `AskUserQuestion`, lanjut ke plan mode (`EnterPlanMode`) untuk merancang detail teknis (state management, localStorage schema, penghapusan route). User mengoreksi scope plan sebelum eksekusi — dan secara eksplisit meminta urutan kerja bertahap: **dokumentasi dulu → Design System (Claude Design) → baru implementasi kode**. Sesi ini menyelesaikan tahap dokumentasi; audit konsistensi lanjutan menemukan `history/[postId]` (Post Detail, KSP-D10) sempat salah ikut disebut akan dihapus — dikoreksi sebelum lanjut ke Tahap 2.

**Key Decision/Insight:** Trade-off NP-D02 asli (modal menutupi Calendar/Queue, kehilangan konteks jadwal) diterima sadar oleh user demi kecepatan alur kerja — bukan pelanggaran diam-diam, dicatat eksplisit di ADR-052/NP-D11. Resume unsaved state (localStorage + dialog "Resume unfinished post?") sengaja **dipersempit ke New Post saja**, tidak untuk Edit Draft, untuk membatasi kompleksitas awal. `history/[postId]` ("Post Detail") adalah layar terpisah yang sudah lama diputuskan (KSP-D10) sengaja tidak didalami — di luar scope ADR-052 sepenuhnya, berbeda dari `calendar`/`queue`/`drafts` yang labelnya "Draft Editor".

**Impact:** ADR-052 baru di `DECISIONS.md` (+ catatan silang di ADR-046 yang dikoreksi: premis "Publish satu-satunya section dengan sibling `[postId]`" ternyata **tetap berlaku**, bukan batal). `navigation-patterns.md` (NP-D11), `key-screen-patterns.md` (KSP-05-F10 reword + KSP-05-F13 baru), `monorepo-setup.md` (diagram App Router), `PROJECT_STATE.md`, `CHANGELOG.md` semua diperbarui. Next: Tahap 2 — Design System (sinkronisasi mockup ke Claude Design).

---

## 2026-07-30 — Retrospektif insiden Claude Design: default toggle berubah tanpa diminta

**Phase:** Phase 6 / M8 Development

**Summary:** User melaporkan (di sesi terpisah dari eksekusi awal) bahwa saat mengerjakan Tahap 2 ADR-052 di Claude Design, AI sempat membuat "kesalahan fatal": diminta menambah toggle pembanding Fullscreen/Standard, toggle-nya benar dan berfungsi, tapi AI diam-diam mengganti default tampilan ke Standard — mengubah layout Media/Account Selector yang tidak pernah diminta berubah. Insiden ini sebenarnya sudah pernah dikoreksi saat itu juga (addendum ADR-052 "Koreksi: default dikembalikan ke Fullscreen"), tapi baru sesi ini dijadikan aturan pencegahan permanen supaya tidak terulang di masa depan.

**Key Decision/Insight:** Root cause bukan salah paham fitur, melainkan AI menganggap tugas selesai begitu "fitur baru berfungsi" tanpa memverifikasi efek samping pada state yang sudah disetujui. Solusi: skill baru `claude-design-scope-discipline` (bukan rule umum di `PROJECT_RULES.md`) — sengaja diskop ke `.claude/skills/` + `ctx-design.md` karena hanya Claude Code yang punya akses tool `DesignSync` untuk mengubah Claude Design; `AGENTS.md` tetap dapat satu baris pointer karena posisinya sebagai entry point wajib.

**Impact:** `.claude/skills/claude-design-scope-discipline/SKILL.md` (baru), `context/ctx-design.md` (Aturan operasional #10), `AGENTS.md` (Aturan keras #13), `DECISIONS.md` (addendum ADR-052), `CHANGELOG.md` — semua diperbarui.

---

## 2026-07-31 — Sidebar "Channels" + temuan: subagent tidak bisa akses tool `DesignSync`

**Phase:** Phase 6 / M8 Development

**Summary:** User meminta section baru "Channels" (daftar akun media sosial terhubung) di sidebar, dimulai dari diskusi posisi (dibandingkan opsi icon-strip vs mini-list, user pilih mini-list) lalu spesifikasi interaksi (drag reorder personal per user, tombol quick-compose, scheduled-posts count) sebelum dieksekusi ke Claude Design. Saat dijalankan lewat subagent Neymar (Product Designer), tool `DesignSync` **tidak bisa dimuat sama sekali** di sesi subagent (ToolSearch selalu "no match", dicoba ulang setelah dikonfirmasi tool tersedia di sesi utama — tetap gagal). Main agent kemudian memverifikasi sendiri bahwa `DesignSync` berfungsi normal di sesinya, dan atas persetujuan eksplisit user, mengerjakan seluruh perubahan Claude Design langsung dari sesi utama (menyimpang dari aturan keras `AGENTS.md` yang mewajibkan Neymar untuk pekerjaan ini, karena keterbatasan teknis, bukan pilihan).

Selama eksekusi terjadi 2 putaran revisi dari user: (1) hapus teks nama platform, tampilkan logo saja — ternyata Lucide (permintaan awal) tidak punya logo brand media sosial, diganti `react-icons` (fa6) atas pilihan user, diverifikasi via `bun add react-icons` sementara di scratchpad lalu dihapus (bukan dependency baru); (2) nama akun (`@kopiselasar`) ternyata tidak boleh ikut dihapus (hanya nama platform), dan hover tidak boleh menggeser konten (drag-handle & swap count/tombol harus reserve-space, bukan `display:none`).

**Key Decision/Insight:** Tool berbasis otorisasi login interaktif (`DesignSync`) tampaknya **tidak diteruskan ke sesi subagent** yang di-spawn lewat tool Agent — pola serupa catatan resmi soal MCP server terautentikasi yang absen di sesi headless. Ini kemungkinan berlaku juga untuk tool sejenis lain di masa depan; kalau subagent gagal memuat tool yang seharusnya tersedia, verifikasi dulu dari main agent sebelum menyimpulkan tool benar-benar tidak aktif. "No-shift hover" (ruang UI dicadangkan permanen, bukan `display:none`↔`flex`) dicatat sebagai syarat interaksi eksplisit, bukan preferensi kosmetik.

**Impact:** `DECISIONS.md` (ADR-058 baru), `navigation-patterns.md` (NP-D14 + section "Channels (Sidebar)" + pola "Quick Compose dari Channels Sidebar" + perluasan "Status Indicator → Settings"), `key-screen-patterns.md` (entry point KSP-05 & KSP-08), `PROJECT_STATE.md`, `CHANGELOG.md` — semua diperbarui. Implementasi kode `apps/web` belum berjalan (Next Tasks).

---

## 2026-08-06 — Diskusi "kenapa ngrok wajib di dev" berakhir di ADR-070: tetap self-hosted Better Auth

**Phase:** Phase 6 / M8 Development

**Summary:** User mengeluhkan proses dev jadi merepotkan karena auth "mengharuskan" tunnel ngrok setiap kali autentikasi diuji di dev mode (lupa jalankan tunnel, tunnel mati, memicu error berulang saat Claude Code mencoba login lewat link `localhost`), dan awalnya mengusulkan migrasi ke Supabase Auth sebagai solusi. Diminta eksplisit untuk hanya berdiskusi dulu tanpa eksekusi apapun. Penelusuran silang `auth-strategy.md`/ADR-024, KI-013, `QA_TEST_ACCOUNTS.md`, dan `.claude/launch.json` menemukan baseline resmi mendesain Better Auth sebagai library self-hosted yang seharusnya jalan normal di `localhost` tanpa tunnel — kontradiksi dengan catatan QA yang mewajibkan ngrok memicu pertanyaan balik ke user. User lalu mengungkap detail kunci: dashboard **Better Auth Cloud** (bukan library self-hosted) menolak Base URL non-publik ("localhost, link-local hosts are not allowed") — dan mengonfirmasi tidak ada alasan spesifik memakai Better Auth Cloud selain belum tahu ada constraint tersebut.

**Key Decision/Insight:** Akar masalah bukan keterbatasan Better Auth atau bug tersembunyi, melainkan adopsi Better Auth Cloud yang tidak pernah tercatat di ADR manapun. Migrasi ke Supabase Auth (opsi awal user) dipertimbangkan tapi ditolak setelah dihitung biayanya — akan memaksa redesain dual-context RLS, JWT bridge Realtime (AS-D03), Bearer plugin mobile (ADR-043), dan migrasi data user, untuk masalah yang ternyata terselesaikan hanya dengan berhenti memakai Better Auth Cloud dan kembali ke self-hosted sesuai desain asli. Pola sesi ini — user melapor gejala, AI menelusuri baseline dulu sebelum menyimpulkan itu bug/limitasi produk, ternyata akar masalahnya adopsi tool tambahan yang tidak tercatat — layak diwaspadai di isu serupa lain (mis. KI-005 Astryx Beta, tool eksternal lain).

**Impact:** `DECISIONS.md` (ADR-070 baru), `PROJECT_STATE.md` (Completed Ringkasan + update catatan KI-013 mereferensikan ADR-070), `COMPLETE_TASK.md`. Instalasi self-hosted Better Auth dilakukan mandiri oleh King Rezi di komputer lokal (`localhost:3000` + Supabase Cloud, tanpa Railway) — belum ada eksekusi kode oleh AI. Next: `QA_TEST_ACCOUNTS.md` dan KI-013 perlu ditinjau ulang setelah instalasi terverifikasi jalan normal.

---

## 2026-08-11 — Settings pakai sidebar tunggal pola Buffer (ADR-077), desain dikerjakan King Rezi sendiri

**Phase:** Phase 6 / M8 Development

**Summary:** King Rezi membagikan screenshot halaman Settings Buffer dan bertanya apakah main sidebar bisa diganti sidebar khusus Settings seperti itu, dengan instruksi eksplisit untuk berdiskusi dulu tanpa eksekusi apapun. Sesi menelusuri struktur kode saat ini (main sidebar `WorkspaceSideNav` via `AppShell`, secondary nav `SettingsSideNav` di dalam `LayoutPanel` — dua sidebar berdampingan, warisan T-016.1) sebelum bertanya balik cakupan dan tingkat kepastian keputusan. King Rezi mengonfirmasi cakupan murni halaman Settings dan ingin lanjut eksekusi, tapi memilih mengerjakan desainnya **sendiri** di Claude Design — bukan lewat subagent Neymar — dan minta disiapkan prompt desain plus daftar dokumen yang perlu diubah kalau desain berubah. Setelah desain selesai, King Rezi meminta perubahan dokumen dikerjakan menyusul.

**Key Decision/Insight:** Cross-check ke `readme.md` project Claude Design (via `DesignSync`) menemukan King Rezi sudah lebih dulu mendokumentasikan pola ini di sana (`.settings-sidebar`, "T-039.1-4, Buffer-style single sidebar") sebelum sesi ini menulis ADR — jadi pertanyaan "apakah readme perlu diupdate" terjawab tidak perlu, baseline dokumen di repo yang justru menyusul menyelaraskan diri ke desain yang sudah ada. Perubahan ini murni mekanisme render (sidebar tunggal + back-navigation menggantikan dua-sidebar-berdampingan) — taksonomi grup Organization/Account dari ADR-076 sengaja dipertahankan, tidak ada alasan mengubahnya.

**Impact:** `DECISIONS.md` (ADR-077 baru, mengamandemen mekanisme render ADR-076), `information-architecture.md` (Secondary Navigation, section 6 Settings), `navigation-patterns.md` (section Settings, NP-D07, catatan back-navigation, tabel Ringkasan Pola), `tasks/v01-foundation.md` (subtask baru T-039.5), `COMPLETE_TASK.md`. Kode `apps/web` belum dimigrasikan — menyusul sebagai T-039.5.

