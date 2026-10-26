# Subagent — Social Media Management

Panduan penggunaan 7 subagent kerja untuk project ini.

File peran (semua `*.md` di folder ini **kecuali dokumen ini sendiri**)
diklasifikasikan **Static Reference** (`project-os/PROJECT_RULES.md`) —
read-only (chmod 444) dan **hanya boleh diubah atas permintaan eksplisit
user**, bukan inisiatif AI, karena scope dan batasannya sudah disepakati
langsung dengan user. Perubahan struktural dicatat sebagai ADR atau di tiket
yang terkait (ADR-131).

---

## Daftar subagent

| File                              | Nama                         | Peran                                                                                   | Tools dibatasi?                                    |
| --------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `prabowo-feature-engineer.md`     | Prabowo Feature Engineer     | Implementasi fitur (entry → service → domain → repo)                                    | Tidak (semua tools)                                |
| `mark-ui-engineer.md`             | Mark UI Engineer             | UI/komponen `apps/web` — komponen shadcn/ui (ADR-097)                  | Tidak                                              |
| `neymar-product-designer.md`      | Neymar Product Designer      | Artifact desain Postific via tool `Artifact` (ADR-140)                                  | Tidak                                              |
| `elon-backend-engineer.md`        | Elon Backend Engineer        | Outstand ACL, webhook, background jobs, schema Prisma                                   | Tidak                                              |
| `ridwan-architecture-reviewer.md` | Ridwan Architecture Reviewer | Review kepatuhan boundary DDD, read-only                                                | Ya — `Read, Bash, Grep, Glob, ReportFindings`      |
| `najwa-qa-engineer.md`            | Najwa QA Engineer            | Vitest + verifikasi browser end-to-end                                                  | Ya — `Read, Bash, Grep, Glob, mcp__Claude_Browser, Artifact` |
| `gibran-project-manager.md`       | Gibran Project Manager       | Update `PROJECT_STATE.md` / `AVAILABLE_TICKETS.md` / `tickets/` / `DECISIONS.md` | Ya — `Read, Edit, Write, Bash, Grep, Glob`         |

**Override model/effort per subagent:** frontmatter tiap file peran boleh
menambah `effort: <low|medium|high|xhigh|max>` (dipakai `ridwan-architecture-reviewer.md`
dan `najwa-qa-engineer.md` sebagai quality gate — butuh ketelitian ekstra,
bukan cuma golden path) dan/atau `model: <sonnet|opus|haiku|fable>` (belum
dipakai subagent manapun saat ini) untuk menimpa default sesi utama.
Perubahan ini termasuk "perubahan struktural" (README ini § "Mengubah
subagent ini") — chmod dance tetap wajib, lalu catat di ADR atau tiket.
Pertimbangkan risiko sebelum menurunkan `model` pada subagent yang tugasnya
butuh ketelitian arithmetic/cross-file (mis. Gibran menghitung ulang jumlah
subtask) — model lebih lemah yang salah hitung berarti sesi tambahan untuk
memperbaikinya, kadang lebih mahal daripada penghematannya.

---

## Cara AI memerintahkan subagent

AI (Claude Code) mendelegasikan lewat `Agent` tool dengan `subagent_type` =
nama file tanpa `.md` (mis. `subagent_type: "elon-backend-engineer"`). User
tidak perlu memanggil subagent secara langsung — cukup beri task, AI yang
memilih subagent yang cocok berdasarkan `description` di frontmatter
masing-masing file. User juga bisa memaksa subagent tertentu secara eksplisit
("pakai Ridwan Architecture Reviewer untuk cek ini").

**Penentuan subagent adalah tugas AI, bukan pertanyaan ke user.** Jangan
pakai `AskUserQuestion` untuk menanyakan "task ini dikerjakan siapa" —
pemetaan Domain → Subagent di bawah sudah cukup untuk memutuskan sendiri.
Reservasi `AskUserQuestion` untuk keputusan scope/produk (apa yang dibangun),
bukan keputusan delegasi (siapa yang membangun).

## Keterbatasan teknis: tool desain di sesi subagent

**`DesignSync` tidak dipakai lagi (ADR-140).** Sebelum itu, `DesignSync` tercatat
gagal dimuat di sesi subagent sebanyak sembilan kali (Neymar Product Designer
delapan kali, Najwa QA Engineer sekali; 2026-07-31 sampai 2026-09-28), padahal
berhasil di sesi utama. Catatan itu tidak berlaku lagi karena alatnya diganti.

Alat desain sekarang adalah tool `Artifact` (ADR-140). **Terbukti termuat di
sesi subagent (2026-10-26).** Neymar Product Designer dan Najwa QA Engineer
sama-sama memiliki `Artifact` langsung di daftar tool (tanpa `ToolSearch`) dan
berhasil memanggil `read` pada artifact Postific Design Review; Neymar juga
berhasil `list`. Delegasikan ke `neymar-product-designer` seperti biasa, tanpa
cara cadangan.

Kalau suatu saat `Artifact` gagal dimuat di sesi subagent (cek lewat
`ToolSearch`), jangan mengasumsikan itu normal: catat kejadiannya di sini,
minta izin eksplisit King Rezi untuk mengerjakannya langsung di sesi utama,
verifikasi `Artifact` termuat di sana, lalu lanjut.

---

## Aturan orkestrasi (paralel vs sekuensial)

- **Boleh paralel** (beda file/domain, tidak saling menyentuh): Prabowo, Mark,
  Neymar, Elon — bisa dijalankan bersamaan dalam satu giliran `Agent` tool
  selama task-nya independen (mis. Elon kerjakan `OutstandAdapter` bersamaan
  Mark kerjakan tombol Publish Now).
- **Wajib sekuensial, setelah implementasi selesai:**
  1. **Ridwan** (review arsitektur) — jalan setelah agent implementasi
     selesai, sebelum QA.
  2. **Najwa** (QA/testing) — jalan setelah Ridwan (atau langsung setelah
     implementasi kalau review tidak diminta).
  3. **Gibran** (governance/docs) — **selalu paling akhir, sendirian**.
     Jangan dijalankan bersamaan dengan agent lain yang berpotensi menyentuh
     `PROJECT_STATE.md` / `AVAILABLE_TICKETS.md` / `tickets/` / `DECISIONS.md`,
     untuk mencegah konflik/duplikasi status.
- Kalau beberapa agent implementasi mengubah file yang berpotensi tumpang
  tindih, gunakan opsi `isolation: "worktree"` per agent supaya tidak saling
  menimpa.

---

## Kapan WAJIB dievaluasi (bukan opsional)

Ini bukan sekadar referensi pasif — `AGENTS.md` ("Wajib di awal sesi") dan
`.claude/skills/project-os-navigator/SKILL.md` (behavior "Pekerjaan Baru")
mewajibkan AI berhenti di titik ini **sebelum** mulai implementasi kode:

1. Task punya field **Domain** (di file tiketnya) yang scope-nya
   implementasi kode (bukan diskusi/dokumentasi murni)? → cek tabel
   pemetaan di bawah.
2. Ada **lebih dari satu task/subtask independen** (domain atau file
   berbeda, tidak saling menyentuh) yang bisa dikerjakan bersamaan? → jalankan
   subagent yang relevan secara paralel (lihat "Aturan orkestrasi" di atas)
   alih-alih mengerjakannya sendiri satu per satu secara sekuensial.
3. Kalau task match salah satu subagent dan tidak ada alasan kuat untuk
   dikerjakan sendiri (mis. scope sangat kecil, 1-2 baris, atau murni
   dokumentasi) → delegasikan lewat `Agent`/`Task` tool.

## Pemetaan Domain → Subagent

Field **Domain** tiap task di file tiketnya (`tickets/vXX-*.md` atau `tickets/known-issues.md`) bisa langsung dipetakan ke
subagent implementasi berikut sebagai titik awal (bukan aturan kaku — cek
juga `description` di frontmatter masing-masing file peran untuk keputusan
akhir):

| Domain (field task)                    | Subagent utama              | Catatan                                                                         |
| -------------------------------------- | --------------------------- | ------------------------------------------------------------------------------- |
| `identity`                             | Prabowo Feature Engineer    | Auth flows, session, konfigurasi Better Auth                                    |
| `workspace`                            | Prabowo Feature Engineer    | Workspace, member, roles                                                        |
| `publishing`                           | Prabowo Feature Engineer    | Draft, Schedule, Queue, Publish Now                                             |
| `analytics`                            | Prabowo Feature Engineer    | Dashboard/metrics — logic; UI-nya lihat baris `UI`                              |
| `integration`, `media`, `notification` | Elon Backend Engineer       | Outstand ACL, webhook, background jobs                                          |
| `UI`                                   | Mark UI Engineer            | Komponen shadcn/ui, styling, layout (ADR-097)      |
| `platform`, `DX`                       | — (biasanya tanpa subagent) | Tooling/config internal (CI, monorepo) — sering lebih cepat dikerjakan langsung |

Domain gabungan (mis. `workspace · UI`) berarti **dua subagent bisa paralel**
dalam satu giliran — satu untuk logic domain (Prabowo/Elon), satu untuk UI
(Mark) — selama file yang disentuh tidak tumpang tindih (lihat "Aturan
orkestrasi" di atas untuk kapan perlu `isolation: "worktree"`).

---

## Gate pola ambigu shadcn (T-103.2, AGENTS.md rule 10)

Sebelum subagent implementasi (terutama **Mark UI Engineer**) menulis kode
untuk list/komposisi yang punya **lebih dari satu pola shadcn valid** secara
teknis (mis. `Item`/`ItemGroup` vs `Table`, variant dialog, baris
klik-penuh atau tidak): cek dulu apakah artifact desain Postific sudah mengunci
pola konkret-nya (komentar "SYNCED"/"LOCKED PATTERN" di kartu
`project/components/Screen<Nama>/preview.html` atau komponen terkait, dan
komponen shadcn di artifact menampilkan pola itu, bukan sekadar "shadcn X"). Kalau
**belum dikunci** — subagent wajib **STOP dan tanya King Rezi** lewat
`AskUserQuestion` (bukan menebak salah satu opsi), sertakan opsi konkret
yang sedang dipertimbangkan. Ini mencegah pengulangan drift KI-054/KI-055
(AI menebak pola "masuk akal" yang ternyata bukan yang King Rezi mau) — detail
lengkap di `AGENTS.md` rule 10 dan `tickets/v07-astryx-shadcn-migration.md`
§ T-103.

## Gate verifikasi struktur setelah implementasi (T-103.3)

Melengkapi gate di atas (yang berlaku **sebelum** implementasi): setelah
task UI selesai ditulis, **Mark UI Engineer** dan **Najwa QA Engineer**
wajib `Artifact` action `read` pada kartu layar atau komponen di artifact
desain Postific yang relevan dan membandingkan eksplisit strukturnya dengan kode yang baru
ditulis (wrapper, header/caption, klik-penuh atau tidak, posisi
tombol/action, dst.) — bukan cuma golden path fungsional. Kalau ditemukan
perbedaan struktural yang tidak disengaja, perbaiki/laporkan sebelum task
ditandai selesai. Najwa QA Engineer diberi akses tool `Artifact` khusus
untuk gate ini (hanya `read`) (lihat kolom "Tools dibatasi?" di tabel atas). Detail:
`.claude/agents/mark-ui-engineer.md` § Verifikasi,
`.claude/agents/najwa-qa-engineer.md` § Langkah kerja poin 5, dan
`tickets/v07-astryx-shadcn-migration.md` § T-103.

---

## Mengubah subagent ini

File peran (`*.md` selain dokumen ini) di-chmod read-only (444) sebagai
pengaman teknis. Untuk mengubah (menambah peran baru, memperbaiki scope yang
keliru, dst.):

1. Konfirmasi eksplisit dari user dulu — jangan inisiatif sendiri.
2. `chmod 644 <file>.md`, edit, lalu `chmod 444 <file>.md` lagi.
3. Catat perubahan sebagai ADR atau di tiket yang terkait (ADR-131).

---

## Related

- Entry point agent: `../../AGENTS.md`
- Governance dokumen: `../../project-os/PROJECT_RULES.md` (klasifikasi
  Static Reference)
