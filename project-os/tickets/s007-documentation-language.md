# S-007 · Documentation language (layer 3)

> Rumah tiket spec S-007 (ADR-164). Antrian yang belum selesai ada di [`../AVAILABLE_TICKETS.md`](../AVAILABLE_TICKETS.md). Spec: [`../specs/S-007.md`](../specs/S-007.md).

Keputusan King Rezi 2026-11-12. ADR-163 Accepted pada 2026-11-12 (T-263.2). Satu berkas utuh per tiket.

### T-263 · Record the decision to translate layer 3 and amend the language rule

`✅ Done (code) (2026-11-12, ADR-163 Accepted)` · **Mode** HITL · **Verifikasi** lokal · **Domain** project-os, agen (tanpa kode produk) · **ADR** ADR-133, ADR-160, ADR-162, ADR-163 · **Spec** S-007 · **Depends** —
**Baca dulu:** `project-os/specs/S-007.md` · `project-os/decisions/ADR-163-dokumen-lapisan-3-ke-bahasa-inggris-kata-kunci-ikut-berubah.md` · `AGENTS.md` aturan 2, 8, dan 14 · `project-os/PROJECT_RULES.md` § Append-Only

Gerbang S-007. Menulis ADR keputusan, mengubah teks aturan bahasa di satu tempat, dan membuat tiket lanjutan. Tiket lanjutan S-007 (skrip dan skill, percobaan `context/`, dokumen hidup, kata kunci di sejarah, penutup) tidak dimulai sebelum gerbang ini selesai. Hanya dokumen; tidak ada kode produk.

- [x] **T-263.1** `(2026-11-12)` Draf ADR-163 ditulis, status Proposed, memuat enam jawaban King Rezi atas pertanyaan S-007 dan pengecualian Append-Only yang sempit (hanya kata kunci di sejarah).
- [x] **T-263.2** `(2026-11-12)` King Rezi menerima ADR-163 di chat. Status menjadi Accepted hanya atas jawabannya.
- [x] **T-263.3** `(2026-11-12)` `AGENTS.md` aturan 8 diubah sesuai ADR-163 (teks aturan bahasa hanya di sana, ADR-133). Kalimat "Documents in `project-os/`, `product-discovery/`, and `context/` stay Bahasa Indonesia" diganti, dengan pengecualian untuk sejarah.
- [x] **T-263.4** `(2026-11-12)` `project-os/PROJECT_RULES.md` § Append-Only mendapat pengecualian eksplisit kedua: hanya kata kunci dokumen di tiket dan ADR lama yang boleh diganti, satu kali lewat tiket sendiri.
- [x] **T-263.5** `(2026-11-12; ctx-project sudah menunjuk aturan 8, tidak diubah)` Penunjuk "lapisan 3 tidak diterjemahkan" di `project-os/specs/S-004.md` dan `context/ctx-project.md` diperbarui menunjuk ADR-163, tanpa menyalin aturan.
- [x] **T-263.6** `(2026-11-12, T-264 sampai T-277)` Tiket lanjutan S-007 dibuat dari bagian Rencana tiket spec (nomor global berikutnya) dan S-007 diperbarui menunjuk tiket itu.
- [x] **T-263.7** `bun run docs:check` bersih.

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** tidak ada

### T-264 · Fix the English equivalents of the document keywords

`✅ Done (code) (2026-11-13, daftar disetujui King Rezi)` · **Mode** HITL · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-263
**Baca dulu:** `project-os/specs/S-007.md` · `scripts/docs/check.ts` · `.claude/skills/project-os-navigator/SKILL.md` · `.claude/skills/wave-plan/SKILL.md` · `.claude/skills/wave-work/SKILL.md` · `.claude/skills/docs-consistency-audit/SKILL.md`

Gerbang kosakata (ADR-163 butir 3 dan 4). Daftar padanan kata kunci hidup di tiket ini, satu tempat (ADR-133). `PROJECT_RULES.md` § Append-Only menunjuk tiket ini untuk daftarnya.

- [x] **T-264.1** `(2026-11-13)` Inventaris kata kunci Indonesia yang dicocokkan skrip dan skill (`Berikutnya`, `spec berikutnya`, `Belum terbukti`, `Baca dulu`, `Blocked by`, legenda status, nama kolom, daftar kata henti), ditulis di tiket ini dengan lokasinya. Lihat tabel di bawah.
- [x] **T-264.2** `(2026-11-13)` Usulan padanan Inggris untuk tiap kata kunci, ditulis di tiket ini. Lihat tabel di bawah (status: usulan, belum disetujui).
- [x] **T-264.3** `(2026-11-13)` King Rezi menyetujui daftar padanan di chat. Jawabannya: "Approve as drafted" (semua usulan bagian A sampai D, termasuk pemisahan T-276 dan mempertahankan daftar kata henti `INDONESIAN_WORDS`).

#### Inventory and English equivalents (approved by King Rezi 2026-11-13, "Approve as drafted")

**A. Keywords matched by scripts (these break `docs:check` if changed carelessly; T-265 handles them)**

| Current (Indonesian)                                                                                                                                                                             | Proposed (English)                                                                                                                                       | Where it lives                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Berikutnya: **T-NNN**` (ticket ID counter)                                                                                                                                                      | `Next: **T-NNN**`                                                                                                                                        | `project-os/AVAILABLE_TICKETS.md:28`; regex in `scripts/docs/check.ts:271` (also `:183`, doc comment `:6`); `scripts/docs-check.ts:5` comment        |
| `ID spec berikutnya: **S-NNN**` (spec ID counter)                                                                                                                                                | `Next spec: **S-NNN**` (line 28 becomes "Global ticket ID, never recycled. Next: **T-NNN**. Next spec: **S-NNN**." with the same numbers)                | `AVAILABLE_TICKETS.md:28`; regex in `scripts/docs/check.ts:278` (case-insensitive)                                                                   |
| `INDONESIAN_WORDS` stopword list (`yang`, `dan`, `tidak`, `tiket`, `gelombang`, …)                                                                                                               | **Keep unchanged.** It detects Indonesian words in English-language document titles ("penamaan Inggris"), which stays valid after layer 3 is translated. | `scripts/docs/check.ts:67`                                                                                                                           |
| Script messages (`tidak ada temuan`, `Tidak ditemukan`, `dirujuk tetapi tidak didefinisikan`, `penunjuk ke … tidak ada`, `penghitung ID … tidak ditemukan`, `pola … ada di … tetapi tidak di …`) | English messages with the same meaning                                                                                                                   | `scripts/docs-check.ts:20`, `scripts/docs-where.ts:23`, `scripts/docs/check.ts:195,245,290,356,364`; comments in `check.ts`, `locate.ts`, `parse.ts` |

**B. Keywords searched by humans and agents (skills, ticket and spec shape)**

| Current (Indonesian)                                                                                                             | Proposed (English)                             | Where it lives                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Baca dulu:` (ticket field and section/heading name)                                                                             | `Read first:`                                  | every ticket; `.claude/skills/wave-plan/SKILL.md:27`, `project-os-navigator/SKILL.md:29`; `AGENTS.md` step 2 context; heading `## Baca dulu` in `context/` files (T-266 uses `## Read first` provisionally) |
| `Belum terbukti:` (ticket field)                                                                                                 | `Not yet proven:`                              | every ticket; `project-os-navigator/SKILL.md:132`, `wave-work/SKILL.md:44`; `specs/README.md`                                                                                                               |
| `Blocked by:`                                                                                                                    | unchanged (already English)                    | tickets; `specs/README.md:67`                                                                                                                                                                               |
| `Verifikasi` (field) with values `lokal` / `staging`                                                                             | `Verification` with values `local` / `staging` | tickets; `specs/README.md:56,72`; `project-os-navigator/SKILL.md:126`                                                                                                                                       |
| `Mode`, `Domain`, `Spec`, `Docs`, `Depends`, `AFK`, `HITL`, `Done (code)`, `Verified (staging)`, `Todo`, `Not Started`, `Status` | unchanged (already English)                    | tickets, skills                                                                                                                                                                                             |
| `§ Perilaku` (S-003 section cited by skills)                                                                                     | `§ Behavior`                                   | `wave-plan/SKILL.md:14`, `wave-work/SKILL.md:14`                                                                                                                                                            |

**C. Status legend and table vocabulary in `AVAILABLE_TICKETS.md`**

| Current (Indonesian)                                                                | Proposed (English)                                            |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Legend column names `Simbol` / `Arti`                                               | `Symbol` / `Meaning`                                          |
| ⏳ `Belum dimulai`                                                                  | ⏳ `Not started`                                              |
| 🟡 `Sedang dikerjakan`                                                              | 🟡 `In progress`                                              |
| 🚫 `Terhenti, menunggu King Rezi atau dependency luar`                              | 🚫 `Blocked, waiting for King Rezi or an external dependency` |
| Main table column `Judul` (columns `ID`, `Status`, `File` unchanged)                | `Title`                                                       |
| Heading `Cara pakai`                                                                | `How to use`                                                  |
| Heading `Sekarang`                                                                  | `Now`                                                         |
| Heading `Belum masuk antrian dekat` + column `Rilis`                                | `Not in the near queue` + `Release`                           |
| Heading `Keputusan yang masih menunggu` + columns `Tiket` / `Yang belum diputuskan` | `Pending decisions` + `Ticket` / `Still undecided`            |
| Heading `Di mana tiket selesai` + column `Rilis`                                    | `Where finished tickets live` + `Release`                     |

**D. Spec section keywords (`specs/S-NNN.md` shape, `specs/README.md`)**

| Current (Indonesian)         | Proposed (English) |
| ---------------------------- | ------------------ |
| `Status spec`                | `Spec status`      |
| `Tiket:` (spec header field) | `Tickets:`         |
| `## Latar`                   | `## Background`    |
| `## Perilaku`                | `## Behavior`      |
| `## Keputusan`               | `## Decisions`     |
| `## Tiket`                   | `## Tickets`       |
| `## Jahitan tes`             | `## Test seams`    |
| `## Di luar spec`            | `## Out of scope`  |

**Resolved points (approved as drafted):** (1) T-276 replaces only the keywords in sections A and B in ~170 history files. Sections C and D are headings and table words in living documents (translated with their file in T-274/T-275), so the replacement script does not touch them in history files; confirm this split. (2) Confirm keeping the `INDONESIAN_WORDS` stopword list.

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** T-263

### T-265 · Make docs:check, docs:where, and four skills use the English keywords

`✅ Done (code) (2026-11-13)` · **Mode** AFK · **Verifikasi** lokal · **Domain** platform, DX, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-264
**Baca dulu:** `project-os/specs/S-007.md` · tiket T-264 (daftar padanan) · `scripts/docs/check.ts` · `scripts/docs-where.ts` · empat skill: `project-os-navigator`, `wave-plan`, `wave-work`, `docs-consistency-audit`

Selama dokumen sejarah belum diganti (T-276), skrip mengenali kata kunci Indonesia dan Inggris sekaligus. Dukungan kata kunci lama dicabut di T-276. Kata kunci lama dan baru tidak boleh bercampur di dokumen hidup setelah tiket ini di-merge.

- [x] **T-265.1** `(2026-11-13)` `scripts/docs/check.ts` dan `scripts/docs-where.ts` mengenali padanan Inggris (penghitung `Next:`-setara, kata henti, pesan) dan tetap mengenali kata kunci Indonesia selama masa peralihan.
- [x] **T-265.2** `(2026-11-13)` Tes skrip (bila ada) diperbarui dan `bun run docs:check` bersih pada dokumen yang belum diganti dan pada satu dokumen uji berkata kunci Inggris.
- [x] **T-265.3** `(2026-11-13)` Empat skill memakai kata kunci Inggris, dengan arti gerbang tidak berubah. Perbandingan penuh oleh agen independen (dokumen berbentuk aturan, keputusan 6 S-007).
- [x] **T-265.4** `(2026-11-13)` Audit topik language tidak menemukan aturan yang bertentangan antara skill, skrip, dan `AGENTS.md` aturan 8.

**Review (2026-11-13, independent, two axes):** no hard violations. Considerations, not fixed here: (1) code comments in `scripts/docs/` are only partly English (code comments are out of S-007 scope); (2) the exemption regex for `Next:` in `check.ts` matches that phrase in any document (it needs a bold ID right after the colon, so it stays narrow); (3) no test mixes an English ticket counter with an Indonesian spec counter; (4) the skills cite "S-003 § Behavior" while the S-003 heading is still `## Perilaku`, and no ticket translates the spec headings (section D of the T-264 table), so T-276 or T-277 should settle that pointer; (5) the sentence above that old and new keywords must not mix in living documents cannot hold literally until T-274 to T-276, because the skills are English while the queue, `specs/README.md` and the tickets stay Indonesian until then.

**Belum terbukti:** belum ada dokumen berkata kunci Inggris di sejarah (T-276); peralihan dua bahasa diuji hanya lewat dokumen uji.

**Blocked by:** T-264

### T-266 · Translate context/ (pilot)

`✅ Done (code) (2026-11-13)` · **Mode** AFK · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-263
**Baca dulu:** `project-os/specs/S-007.md` · `context/README.md` · `context/ctx-*.md`

Percobaan cakupan C (keputusan 2 S-007): sembilan berkas, 948 baris. Dokumen berbentuk aturan, jadi perbandingan penuh oleh agen independen (keputusan 6). Menunjuk dokumen lain tidak menyalin isinya (ADR-133).

- [x] **T-266.1** `(2026-11-13)` `context/README.md` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh teks UI produk (copy Bahasa Indonesia) tidak berubah.
- [x] **T-266.2** `(2026-11-13)` `context/ctx-architecture.md` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh teks UI produk (copy Bahasa Indonesia) tidak berubah.
- [x] **T-266.3** `(2026-11-13)` `context/ctx-business.md` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh teks UI produk (copy Bahasa Indonesia) tidak berubah.
- [x] **T-266.4** `(2026-11-13)` `context/ctx-design.md` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh teks UI produk (copy Bahasa Indonesia) tidak berubah.
- [x] **T-266.5** `(2026-11-13)` `context/ctx-development.md` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh teks UI produk (copy Bahasa Indonesia) tidak berubah.
- [x] **T-266.6** `(2026-11-13)` `context/ctx-domain.md` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh teks UI produk (copy Bahasa Indonesia) tidak berubah.
- [x] **T-266.7** `(2026-11-13)` `context/ctx-implementation.md` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh teks UI produk (copy Bahasa Indonesia) tidak berubah.
- [x] **T-266.8** `(2026-11-13)` `context/ctx-project.md` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh teks UI produk (copy Bahasa Indonesia) tidak berubah.
- [x] **T-266.9** `(2026-11-13)` `context/ctx-technical-context.md` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh teks UI produk (copy Bahasa Indonesia) tidak berubah.
- [x] **T-266.10** `(2026-11-13; stale rule-number pointers inherited from the originals, pointer-fix ticket proposed)` Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [x] **T-266.11** `(2026-11-13)` Perbandingan penuh dengan versi Indonesia di git oleh agen independen: tidak ada gerbang atau penunjuk yang hilang, bertambah, atau tertukar.
- [x] **T-266.12** `(2026-11-13)` `bun run docs:check` bersih.

**Open at hand-off (2026-11-13):** T-266.10 closed after the decision on item 1. The independent comparison (T-266.11) found the translation faithful (no gate, pointer, ID, number or table row lost or changed; `docs:check` clean) and the language audit found:

1. Rule 21b in `ctx-development.md` keeps the AskUserQuestion options "Ya, rapi" and "Ada yang janggal" in Indonesian. King Rezi decided on 2026-11-13: translate. Now "Looks good" and "Something looks off".
2. Inherited from the Indonesian originals, not fixed here (pointers must not change in a translation ticket): stale `AGENTS.md` rule numbers in `ctx-architecture.md:38-40`, `ctx-domain.md:39-40`, `ctx-implementation.md:97-98` and `:104`. Needs its own pointer-fix ticket.
3. Heading renames leave prose pointers dangling in history files: `tickets/v07-astryx-shadcn-migration.md:42`, `tickets/v02-publishing-mvp.md:1234`, `CONVERSATIONS.md:643`, `decisions/ADR-052-*.md:284`. Handle in T-276.
4. Heading `## Read first` is now final: T-264.3 approved it on 2026-11-13.

**Belum terbukti:** pemilihan konteks AI per domain dengan versi Inggris belum dicoba di sesi nyata.

**Blocked by:** T-263

### T-278 · Fix stale AGENTS.md rule-number pointers in context/

`✅ Done (code) (2026-11-13)` · **Mode** AFK · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-266
**Baca dulu:** `AGENTS.md` (Hard rules 3 to 9) · `context/ctx-architecture.md` · `context/ctx-domain.md` · `context/ctx-implementation.md`

Born from the T-266 language audit (T-266.10). The Indonesian originals already carried these stale rule numbers, so the translation kept them (a translation ticket must not change pointers). Fix the pointers only; no other text changes.

- [x] **T-278.1** `(2026-11-13)` `context/ctx-architecture.md` (about lines 38 to 40): the pointer "AGENTS.md rules 5, 9" for entry points and Supabase points to the real rules 3 and 6.
- [x] **T-278.2** `(2026-11-13)` `context/ctx-domain.md` (about lines 39 to 40): the pointer "rules 6, 7, 8" for shared types, cross-domain access, and domain without Prisma points to the real rules 4 and 5 (check the exact mapping against `AGENTS.md`).
- [x] **T-278.3** `(2026-11-13)` `context/ctx-implementation.md` (about lines 97 to 98): "rules 5-8" points to the real rules 3 to 5, and (about line 104) "hard rule 6" for the domain-must-not-import-Prisma rule points to rule 4.
- [x] **T-278.4** `(2026-11-13)` `bun run docs:check` is clean and a grep of `context/` for "AGENTS.md rule" finds no other stale number.

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** T-266

### T-279 · Fix stale pointers found while translating layer 3

`✅ Done (code) (2026-11-13)` · **Mode** AFK · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-274
**Baca dulu:** `project-os/specs/S-007.md` · the T-268 to T-274 reviews recorded above · `AGENTS.md` (Hard rules)

Born from the T-268 to T-274 reviews. Each pointer below was already wrong in the Indonesian originals; the translation tickets kept them (a translation must not change pointers). Fix the pointers only.

- [x] **T-279.1** `(2026-11-13)` `product-discovery/01-business/success-metrics.md` (Notes on Applying the Metrics): "rule 10, AGENTS.md" for where project status lives should name rule 7.
- [x] **T-279.2** `(2026-11-13)` `project-os/ARCHITECTURE_OVERVIEW.md` (about line 228): "rules 5-9" for the layer rules should name rules 3 to 6.
- [x] **T-279.3** `(2026-11-13)` `project-os/DECISIONS.md` (rows ADR-149, ADR-150, ADR-151): complete the two-cell rows (status, date, summary, file link) per the index shape in `PROJECT_RULES.md`.
- [x] **T-279.4** `(2026-11-13)` `product-discovery/05-architecture/application-layer.md` (about line 536): the quoted `conflict` message is a stale paraphrase of the real message in `compose-draft.use-case.ts`; quote it correctly or mark it as a paraphrase.
- [x] **T-279.5** `(2026-11-13)` `project-os/PROJECT_RULES.md` (about line 128) quotes the `PROJECT_STATE.md` headings "Completed (Ringkasan)" and "Recent Decisions (Ringkasan)"; update together with T-275 (also `.claude/agents/gibran-project-manager.md:33`, which needs King Rezi's request). Done in PROJECT_RULES.md and in `.claude/skills/project-os-navigator/SKILL.md` (line 211); `gibran-project-manager.md:33` is left for King Rezi's request.

Not in this ticket (need a decision or a different home): the Approval Workflow placement conflict in `02-product` (Decision Rule 4 versus `mvp-definition.md`, an original inconsistency; King Rezi decides); the citation of the renamed heading in `.claude/agents/najwa-qa-engineer.md` (agent files change only on King Rezi's request); stale heading citations in `apps/web` code comments and migration SQL (code is out of S-007 scope, AGENTS.md rule 13 needs a ticket); stale heading citations in history ADRs, tickets and `S-001.md` (history; T-276 replaces keywords only).

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** T-274

### T-267 · Review the context/ pilot and decide the remaining scope questions

`✅ Done (code) (2026-11-13, keputusan King Rezi)` · **Mode** HITL · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-266
**Baca dulu:** `project-os/specs/S-007.md` · hasil T-266

Gerbang sebelum cakupan B berlanjut. Hasil percobaan dilaporkan ke King Rezi, lalu pertanyaan cakupan yang belum dijawab diputuskan.

- [x] **T-267.1** `(2026-11-13)` Laporan hasil T-266 untuk King Rezi: biaya token, temuan perbandingan, hal yang diubah selama percobaan.
- [x] **T-267.2** `(2026-11-13, "Continue as planned")` King Rezi memutuskan apakah cakupan B dilanjutkan, dan dengan penyesuaian apa.
- [x] **T-267.3** `(2026-11-13, semua empat berkas diterjemahkan: DECISIONS.md, BRAINSTORM.md, QA_TEST_ACCOUNTS.md, S-005 dan S-006)` King Rezi memutuskan berkas yang belum disebut keputusan 2 S-007: indeks ADR `DECISIONS.md` (ringkasan memuat isi keputusan), `BRAINSTORM.md`, `QA_TEST_ACCOUNTS.md`, dan spec yang belum selesai (S-005, S-006).
- [x] **T-267.4** `(2026-11-13)` Keputusan itu dicatat di S-007 dan tiket T-268 sampai T-277 disesuaikan.

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** T-266

### T-268 · Translate product-discovery/01-business

`✅ Done (code) (2026-11-13)` · **Mode** AFK · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-267
**Baca dulu:** `project-os/specs/S-007.md` · `product-discovery/01-business/` · hasil percobaan T-266

Folder `product-discovery/01-business/` (8 berkas, 1.190 baris). Satu berkas utuh, tidak setengah jadi setelah tiket selesai. Contoh teks UI produk (copy Bahasa Indonesia) bagian produk dan tidak berubah. Perbandingan: sampel. Berkas yang disentuh tidak dipakai tiket lain bersamaan (keputusan 5 S-007).

- [x] **T-268.1** `(2026-11-13)` Setiap berkas di `product-discovery/01-business/` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh copy produk tidak berubah.
- [x] **T-268.2** `(2026-11-13)` Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [x] **T-268.3** `(2026-11-13)` Perbandingan sampel dengan versi Indonesia di git oleh agen independen, hasilnya dicatat di sini.
- [x] **T-268.4** `(2026-11-13)` `bun run docs:check` bersih.

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** T-267

### T-269 · Translate product-discovery/02-product

`✅ Done (code) (2026-11-13)` · **Mode** AFK · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-267
**Baca dulu:** `project-os/specs/S-007.md` · `product-discovery/02-product/` · hasil percobaan T-266

Folder `product-discovery/02-product/` (8 berkas, 1.648 baris). Satu berkas utuh, tidak setengah jadi setelah tiket selesai. Contoh teks UI produk (copy Bahasa Indonesia) bagian produk dan tidak berubah. Perbandingan: sampel. Berkas yang disentuh tidak dipakai tiket lain bersamaan (keputusan 5 S-007).

- [x] **T-269.1** `(2026-11-13)` Setiap berkas di `product-discovery/02-product/` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh copy produk tidak berubah.
- [x] **T-269.2** `(2026-11-13)` Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [x] **T-269.3** `(2026-11-13)` Perbandingan sampel dengan versi Indonesia di git oleh agen independen, hasilnya dicatat di sini.
- [x] **T-269.4** `(2026-11-13)` `bun run docs:check` bersih.

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** T-267

### T-270 · Translate product-discovery/03-user

`✅ Done (code) (2026-11-13)` · **Mode** AFK · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-267
**Baca dulu:** `project-os/specs/S-007.md` · `product-discovery/03-user/` · hasil percobaan T-266

Folder `product-discovery/03-user/` (10 berkas, 3.169 baris). Satu berkas utuh, tidak setengah jadi setelah tiket selesai. Contoh teks UI produk (copy Bahasa Indonesia) bagian produk dan tidak berubah. Perbandingan: sampel. Berkas yang disentuh tidak dipakai tiket lain bersamaan (keputusan 5 S-007).

- [x] **T-270.1** `(2026-11-13)` Setiap berkas di `product-discovery/03-user/` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh copy produk tidak berubah.
- [x] **T-270.2** `(2026-11-13)` Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [x] **T-270.3** `(2026-11-13)` Perbandingan sampel dengan versi Indonesia di git oleh agen independen, hasilnya dicatat di sini.
- [x] **T-270.4** `(2026-11-13)` `bun run docs:check` bersih.

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** T-267

### T-271 · Translate product-discovery/04-ux

`✅ Done (code) (2026-11-13)` · **Mode** AFK · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-267
**Baca dulu:** `project-os/specs/S-007.md` · `product-discovery/04-ux/` · hasil percobaan T-266

Folder `product-discovery/04-ux/` (6 berkas, 2.819 baris). Satu berkas utuh, tidak setengah jadi setelah tiket selesai. Contoh teks UI produk (copy Bahasa Indonesia) bagian produk dan tidak berubah. Perbandingan: penuh (pola layar dan aturan UX). Berkas yang disentuh tidak dipakai tiket lain bersamaan (keputusan 5 S-007).

- [x] **T-271.1** `(2026-11-13)` Setiap berkas di `product-discovery/04-ux/` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh copy produk tidak berubah.
- [x] **T-271.2** `(2026-11-13)` Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [x] **T-271.3** `(2026-11-13)` Perbandingan penuh (pola layar dan aturan UX) dengan versi Indonesia di git oleh agen independen, hasilnya dicatat di sini.
- [x] **T-271.4** `(2026-11-13)` `bun run docs:check` bersih.

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** T-267

### T-272 · Translate product-discovery/05-architecture

`✅ Done (code) (2026-11-13)` · **Mode** AFK · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-267
**Baca dulu:** `project-os/specs/S-007.md` · `product-discovery/05-architecture/` · hasil percobaan T-266

Folder `product-discovery/05-architecture/` (8 berkas, 4.323 baris). Satu berkas utuh, tidak setengah jadi setelah tiket selesai. Contoh teks UI produk (copy Bahasa Indonesia) bagian produk dan tidak berubah. Perbandingan: penuh (aturan arsitektur). Berkas yang disentuh tidak dipakai tiket lain bersamaan (keputusan 5 S-007).

- [x] **T-272.1** `(2026-11-13)` Setiap berkas di `product-discovery/05-architecture/` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh copy produk tidak berubah.
- [x] **T-272.2** `(2026-11-13)` Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [x] **T-272.3** `(2026-11-13)` Perbandingan penuh (aturan arsitektur) dengan versi Indonesia di git oleh agen independen, hasilnya dicatat di sini.
- [x] **T-272.4** `(2026-11-13)` `bun run docs:check` bersih.

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** T-267

### T-273 · Translate product-discovery/06-engineering

`✅ Done (code) (2026-11-13)` · **Mode** AFK · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-267
**Baca dulu:** `project-os/specs/S-007.md` · `product-discovery/06-engineering/` · hasil percobaan T-266

Folder `product-discovery/06-engineering/` (12 berkas, 3.581 baris). Satu berkas utuh, tidak setengah jadi setelah tiket selesai. Contoh teks UI produk (copy Bahasa Indonesia) bagian produk dan tidak berubah. Perbandingan: penuh (aturan engineering). Berkas yang disentuh tidak dipakai tiket lain bersamaan (keputusan 5 S-007).

- [x] **T-273.1** `(2026-11-13)` Setiap berkas di `product-discovery/06-engineering/` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh copy produk tidak berubah.
- [x] **T-273.2** `(2026-11-13)` Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [x] **T-273.3** `(2026-11-13)` Perbandingan penuh (aturan engineering) dengan versi Indonesia di git oleh agen independen, hasilnya dicatat di sini.
- [x] **T-273.4** `(2026-11-13)` `bun run docs:check` bersih.

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** T-267

### T-274 · Translate the project-os rules and overviews

`✅ Done (code) (2026-11-13)` · **Mode** AFK · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-267, T-265
**Baca dulu:** `project-os/specs/S-007.md` · `project-os/PROJECT_RULES.md` · `project-os/ARCHITECTURE_OVERVIEW.md` · `project-os/PROJECT_OVERVIEW.md` · `project-os/DEVELOPER_WORKFLOW.md` · `project-os/README.md`

Aturan dan ringkasan di `project-os/` tingkat atas yang jarang diedit gelombang. Berkas yang diputuskan di T-267 (`DECISIONS.md`, `BRAINSTORM.md`, `QA_TEST_ACCOUNTS.md`, spec S-005 dan S-006) ikut tiket ini; jawaban King Rezi 2026-11-13: ya untuk semuanya. `PROJECT_STATE.md` dan `AVAILABLE_TICKETS.md` ada di T-275, bukan di sini.

- [x] **T-274.1** `(2026-11-13)` Lima berkas di atas utuh dalam bahasa Inggris dan memakai kata kunci Inggris (T-264, T-265). Pengecualian Append-Only di `PROJECT_RULES.md` dipertahankan maknanya dan menunjuk T-264.
- [x] **T-274.2** `(2026-11-13)` Berkas tambahan dari keputusan T-267 (2026-11-13: ya untuk semuanya) diterjemahkan utuh: `project-os/DECISIONS.md`, `project-os/BRAINSTORM.md`, `project-os/QA_TEST_ACCOUNTS.md`, `project-os/specs/S-005.md`, `project-os/specs/S-006.md`. S-005 dan S-006 belum selesai: kerjakan hanya setelah memeriksa cabang gelombang yang masih menyunting keduanya (lihat `wave-plan` langkah konflik berkas).
- [x] **T-274.3** `(2026-11-13)` Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [x] **T-274.4** `(2026-11-13)` Perbandingan penuh oleh agen independen (dokumen berbentuk aturan).
- [x] **T-274.5** `(2026-11-13)` `bun run docs:check` bersih.

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** T-267, T-265

### T-275 · Translate AVAILABLE_TICKETS.md and PROJECT_STATE.md

`✅ Done (code) (2026-11-13)` · **Mode** AFK · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-265, T-274
**Baca dulu:** `project-os/specs/S-007.md` · `project-os/AVAILABLE_TICKETS.md` · `project-os/PROJECT_STATE.md`

Dua berkas yang diedit hampir tiap gelombang. Satu tiket pendek, rebase tepat sebelum merge, di-merge segera, dan tidak ada tiket gelombang lain menyentuh dua berkas ini bersamaan (keputusan 5 S-007). Kata kunci memakai padanan T-264.

- [x] **T-275.1** `(2026-11-13)` `AVAILABLE_TICKETS.md` utuh dalam bahasa Inggris, termasuk legenda status dan penghitung, dan `docs:check` mengenali penghitungnya.
- [x] **T-275.2** `(2026-11-13)` `PROJECT_STATE.md` utuh dalam bahasa Inggris.
- [x] **T-275.3** `(2026-11-13)` Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [x] **T-275.4** `(2026-11-13)` `bun run docs:check` bersih.

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** T-265, T-274

### T-276 · Replace the document keywords in the history files

`⏳ Todo` · **Mode** AFK · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-265, T-275
**Baca dulu:** `project-os/specs/S-007.md` · tiket T-264 (daftar padanan) · `project-os/PROJECT_RULES.md` § Append-Only (pengecualian kedua, ADR-163)

Penggantian kata kunci satu kali di tiket, ADR, spec, dan dokumen sejarah lain (keputusan 4 S-007; sekitar 170 berkas). Hanya kata kunci dokumen yang berubah. Isi keputusan, angka, ID, tautan, dan prosa tidak boleh berubah. Dukungan kata kunci Indonesia di skrip dicabut di akhir tiket ini.

- [ ] **T-276.1** Skrip sekali jalan mengganti hanya kata kunci dari daftar T-264 di `project-os/tickets/`, `project-os/decisions/`, `project-os/specs/`, dan berkas sejarah lain yang disebut T-267.
- [ ] **T-276.2** Diff diperiksa: hanya baris kata kunci yang berubah (pembanding otomatis terhadap git: nol perubahan di luar daftar).
- [ ] **T-276.3** Dukungan kata kunci Indonesia dicabut dari `scripts/docs/check.ts`, `scripts/docs-where.ts`, dan empat skill (T-265).
- [ ] **T-276.4** `bun run docs:check` bersih dan audit topik language tidak menemukan sisa kata kunci Indonesia di dokumen hidup.

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** T-265, T-275

### T-277 · Close S-007: language audit across layer 3

`⏳ Todo` · **Mode** AFK · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-268, T-269, T-270, T-271, T-272, T-273, T-274, T-275, T-276
**Baca dulu:** `project-os/specs/S-007.md` · `.claude/skills/docs-consistency-audit/SKILL.md`

Penutup S-007. Audit seluruh dokumen untuk bahasa, kata kunci, dan penunjuk yang rusak.

- [ ] **T-277.1** `docs-consistency-audit` dengan topik language tidak menemukan aturan yang bertentangan antar bahasa atau antar berkas.
- [ ] **T-277.2** Tidak ada dokumen hidup yang setengah diterjemahkan dan tidak ada kata kunci Indonesia tersisa di dokumen hidup.
- [ ] **T-277.3** `bun run docs:check` bersih; S-007 dan `PROJECT_STATE.md` memuat status akhir.

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** T-268 sampai T-276
