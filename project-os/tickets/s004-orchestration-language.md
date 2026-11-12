# S-004 · Orchestration language

> Rumah tiket spec S-004 (ADR-159). Antrian yang belum selesai ada di [`../AVAILABLE_TICKETS.md`](../AVAILABLE_TICKETS.md). Spec: [`../specs/S-004.md`](../specs/S-004.md).

Keputusan King Rezi 2026-11-11. Satu berkas utuh per tiket. ADR-160 Accepted pada 2026-11-11 (T-234.6).

### T-234 · Record the next ADR and translate AGENTS.md

`✅ Done (code) (2026-11-11)` · **Mode** HITL · **Domain** project-os, agen · **ADR** ADR-133, ADR-160 · **Spec** S-004 · **Depends** —
**Baca dulu:** `project-os/specs/S-004.md` · `AGENTS.md` aturan 1, 2, dan 8 · `context/ctx-project.md`

Gerbang bahasa orkestrasi. Menulis ADR baru (nomor berikutnya setelah ADR-159, prosa Indonesia) dan menerjemahkan `AGENTS.md` utuh. Diterima King Rezi 2026-11-11 (T-234.6). Tiket AFK di spec ini boleh dimulai.

- [x] **T-234.1** `✅ Done (code) (2026-11-11, ADR-160 Accepted)` ADR mencatat tujuan (keselarasan skill Inggris dan kolaborator baru), cakupan lapisan 1 dan 2, lapisan 3 tidak diterjemahkan, delapan berkas agen tidak diubah, sebutan King Rezi tetap, dan **5 Magic Words**: please, sorry, thank you, excuse me, go ahead. Teks aturan hanya di `AGENTS.md`.
- [x] **T-234.2** `✅ Done (code) (2026-11-11)` `AGENTS.md` utuh dalam bahasa Inggris. Aturan bahasa: default bahasa Inggris, dengan klausul King Rezi dapat meminta bahasa lain. Aturan sapaan: King Rezi tetap, **5 Magic Words** dalam bahasa Inggris.
- [x] **T-234.3** `✅ Done (code) (2026-11-11)` Kalimat bahasa di `context/ctx-project.md` menjadi penunjuk ke aturan 8. Sisa berkas itu tetap Bahasa Indonesia.
- [x] **T-234.4** `✅ Done (code) (2026-11-11)` S-004 menunjuk ADR yang sudah ada, tanpa menyalin ulang aturan (ADR-133).
- [x] **T-234.5** `✅ Done (code) (2026-11-11)` Audit topik language. Salinan aturan di `.claude/agents/` dilaporkan sebagai utang dan tidak diubah di tiket ini. Utang: tujuh berkas peran menyalin kalimat sapaan King Rezi (`prabowo-feature-engineer.md`, `mark-ui-engineer.md`, `neymar-product-designer.md`, `elon-backend-engineer.md`, `ridwan-architecture-reviewer.md`, `najwa-qa-engineer.md`, `gibran-project-manager.md`). `gibran-project-manager.md` juga menyalin "Bahasa dokumentasi: Bahasa Indonesia." `mark-ui-engineer.md` menunjuk aturan 8, bukan salinan teksnya. `README.md` tidak memuat aturan bahasa. Berkas itu tidak diubah.
- [x] **T-234.6** `✅ Done (code) (2026-11-11)` Status ADR menjadi Accepted. Diterima King Rezi di chat pada 2026-11-11.

**Belum terbukti:** aturan 8 yang baru belum terbaca dari `staging` sampai PR 274 di-merge. Tidak ada butir runtime.

**Blocked by:** tidak ada

### T-235 · Translate the project-os-navigator skill

`✅ Done (2026-11-11)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133 · **Spec** S-004 · **Depends** T-234
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/skills/project-os-navigator/SKILL.md`

- [x] **T-235.1** Berkas skill utuh dalam bahasa Inggris. Arti gerbang dan kata kunci status tidak berubah. Sebutan King Rezi tetap. **5 Magic Words** mengikuti ADR T-234.
- [x] **T-235.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [x] **T-235.3** `(2026-11-11, perbandingan skill Indonesia git eed07936 dengan versi Inggris oleh agen independen)` Satu sesi uji mematuhi gerbang yang sama dengan versi sebelumnya.

**Belum terbukti:** tidak ada. T-235.3 terverifikasi lewat sesi uji kesetaraan gerbang 2026-11-11: PASS, tidak ada gerbang yang hilang, bertambah, atau tertukar.

**Blocked by:** T-234

### T-236 · Translate the proactive-clarification skill

`✅ Done (2026-11-11)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133 · **Spec** S-004 · **Depends** T-234
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/skills/proactive-clarification/SKILL.md`

- [x] **T-236.1** Berkas skill utuh dalam bahasa Inggris. Cara bertanya per ronde tidak berubah. Sebutan King Rezi tetap. **5 Magic Words** mengikuti ADR T-234.
- [x] **T-236.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [x] **T-236.3** `(2026-11-11, perbandingan skill Indonesia git eed07936 dengan versi Inggris oleh agen independen)` Satu sesi uji mematuhi gerbang yang sama dengan versi sebelumnya.

**Belum terbukti:** tidak ada. T-236.3 terverifikasi lewat sesi uji kesetaraan gerbang 2026-11-11: PASS, tidak ada gerbang yang hilang, bertambah, atau tertukar.

**Blocked by:** T-234

### T-237 · Translate the docs-consistency-audit skill

`✅ Done (2026-11-11)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133 · **Spec** S-004 · **Depends** T-234
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/skills/docs-consistency-audit/SKILL.md`

- [x] **T-237.1** Berkas skill utuh dalam bahasa Inggris. Cakupan audit tidak berubah. Sebutan King Rezi tetap. **5 Magic Words** mengikuti ADR T-234.
- [x] **T-237.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [x] **T-237.3** `(2026-11-11, perbandingan skill Indonesia git eed07936 dengan versi Inggris oleh agen independen)` Satu sesi uji mematuhi gerbang yang sama dengan versi sebelumnya.

**Belum terbukti:** tidak ada. T-237.3 terverifikasi lewat sesi uji kesetaraan gerbang 2026-11-11: PASS, tidak ada gerbang yang hilang, bertambah, atau tertukar.

**Blocked by:** T-234

### T-238 · Translate the work-report-simple skill

`✅ Done (2026-11-11)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133 · **Spec** S-004 · **Depends** T-234
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/skills/work-report-simple/SKILL.md`

- [x] **T-238.1** Berkas skill utuh dalam bahasa Inggris. Isi laporan (siapa mengerjakan, apa yang selesai, mengapa penting, langkah berikutnya) tidak berubah. Sebutan King Rezi tetap.
- [x] **T-238.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [x] **T-238.3** `(2026-11-11, perbandingan skill Indonesia git eed07936 dengan versi Inggris oleh agen independen)` Satu sesi uji menyusun laporan dengan bagian yang sama seperti versi sebelumnya.

**Belum terbukti:** tidak ada. T-238.3 terverifikasi lewat sesi uji kesetaraan gerbang 2026-11-11: PASS, tidak ada gerbang yang hilang, bertambah, atau tertukar.

**Blocked by:** T-234

### T-239 · Translate the claude-design-scope-discipline skill

`✅ Done (2026-11-11)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133 · **Spec** S-004 · **Depends** T-234
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/skills/claude-design-scope-discipline/SKILL.md`

- [x] **T-239.1** Berkas skill utuh dalam bahasa Inggris. Larangan mengubah default yang sudah disetujui tidak berubah. Sebutan King Rezi tetap.
- [x] **T-239.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [x] **T-239.3** `(2026-11-11, perbandingan skill Indonesia git eed07936 dengan versi Inggris oleh agen independen)` Satu sesi uji mematuhi gerbang yang sama dengan versi sebelumnya.

**Belum terbukti:** tidak ada. T-239.3 terverifikasi lewat sesi uji kesetaraan gerbang 2026-11-11: PASS, tidak ada gerbang yang hilang, bertambah, atau tertukar.

**Blocked by:** T-234

### T-240 · Translate the wave-plan skill

`✅ Done (2026-11-11)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133, ADR-153 · **Spec** S-004 · **Depends** T-234, T-225
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/skills/wave-plan/SKILL.md`

Menunggu T-225 karena berkas yang sama. Setelah T-225 selesai, berkas diterjemahkan utuh.

- [x] **T-240.1** Berkas skill utuh dalam bahasa Inggris. Langkah menyiapkan gelombang dan berhenti untuk persetujuan King Rezi tidak berubah.
- [x] **T-240.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [x] **T-240.3** `(2026-11-11, perbandingan skill Indonesia git eed07936 dengan versi Inggris oleh agen independen)` Satu sesi uji mematuhi gerbang yang sama dengan versi sebelumnya.

**Belum terbukti:** tidak ada. T-240.3 terverifikasi lewat sesi uji kesetaraan gerbang 2026-11-11: PASS, tidak ada gerbang yang hilang, bertambah, atau tertukar.

**Blocked by:** T-234, T-225

### T-241 · Translate the wave-work skill

`✅ Done (2026-11-11)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133, ADR-153 · **Spec** S-004 · **Depends** T-234, T-225
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/skills/wave-work/SKILL.md`

Menunggu T-225 karena berkas yang sama. Istilah di berkas ini menjadi acuan empat berkas pendamping.

- [x] **T-241.1** Berkas skill utuh dalam bahasa Inggris. Gerbang King Rezi (migrasi, merge, commit) tidak berubah.
- [x] **T-241.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [x] **T-241.3** `(2026-11-11, perbandingan skill Indonesia git eed07936 dengan versi Inggris oleh agen independen)` Satu sesi uji mematuhi gerbang yang sama dengan versi sebelumnya.

**Belum terbukti:** tidak ada. T-241.3 terverifikasi lewat sesi uji kesetaraan gerbang 2026-11-11: PASS, tidak ada gerbang yang hilang, bertambah, atau tertukar.

**Blocked by:** T-234, T-225

### T-242 · Translate the wave-work lane brief template

`✅ Done (2026-11-11)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133, ADR-153 · **Spec** S-004 · **Depends** T-241, T-225
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/skills/wave-work/lane-brief-template.md` · `.claude/skills/wave-work/SKILL.md`

- [x] **T-242.1** Berkas template utuh dalam bahasa Inggris. Bagian brief dan istilahnya mengikuti T-241.
- [x] **T-242.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.

**Belum terbukti:** tidak ada butir runtime, tidak ada sesi uji .3 untuk tiket ini. Skill wave-work belum dipakai di gelombang nyata berikutnya, jadi belum terbukti ia mematuhi template terjemahan ini. Itu bukan penghambat.

**Blocked by:** T-241, T-225

### T-243 · Translate the wave-work handoff note

`✅ Done (2026-11-11)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133, ADR-153 · **Spec** S-004 · **Depends** T-241
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/skills/wave-work/handoff.md` · `.claude/skills/wave-work/SKILL.md`

- [x] **T-243.1** Berkas utuh dalam bahasa Inggris. Bentuk handoff (penunjuk, tanpa rahasia) tidak berubah. Istilah mengikuti T-241.
- [x] **T-243.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.

**Belum terbukti:** tidak ada butir runtime, tidak ada sesi uji .3 untuk tiket ini. Skill wave-work belum dipakai di gelombang nyata berikutnya, jadi belum terbukti ia mematuhi template terjemahan ini. Itu bukan penghambat.

**Blocked by:** T-241

### T-244 · Translate the wave-work retro note

`✅ Done (2026-11-11)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133, ADR-153 · **Spec** S-004 · **Depends** T-241
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/skills/wave-work/retro.md` · `.claude/skills/wave-work/SKILL.md`

- [x] **T-244.1** Berkas utuh dalam bahasa Inggris. Kategori saran retro tidak berubah. Istilah mengikuti T-241.
- [x] **T-244.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.

**Belum terbukti:** tidak ada butir runtime, tidak ada sesi uji .3 untuk tiket ini. Skill wave-work belum dipakai di gelombang nyata berikutnya, jadi belum terbukti ia mematuhi template terjemahan ini. Itu bukan penghambat.

**Blocked by:** T-241

### T-245 · Translate the wave-work integration pull request template

`✅ Done (2026-11-11)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133, ADR-153 · **Spec** S-004 · **Depends** T-241
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/skills/wave-work/integration-pr-template.md` · `.claude/skills/wave-work/SKILL.md`

- [x] **T-245.1** Berkas template utuh dalam bahasa Inggris. Bagian Summary, Evidence, dan Merge Danger tetap ada. Istilah mengikuti T-241.
- [x] **T-245.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.

**Belum terbukti:** tidak ada butir runtime, tidak ada sesi uji .3 untuk tiket ini. Skill wave-work belum dipakai di gelombang nyata berikutnya, jadi belum terbukti ia mematuhi template terjemahan ini. Itu bukan penghambat.

**Blocked by:** T-241

### T-246 · Fix navigator heading pointers after translation

`✅ Done (2026-11-11)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133, ADR-160 · **Spec** S-004 · **Depends** T-235
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/skills/project-os-navigator/SKILL.md`

Terjemahan T-235 mengubah judul section navigator ("Pekerjaan Baru" menjadi "New Work / Document Creation", "Bug / Inkonsistensi Dokumen" menjadi "Bug / Document Inconsistency"). Penunjuk ke judul lama diperbarui di `AGENTS.md`, `.claude/agents/README.md`, `project-os/PROJECT_RULES.md`, `project-os/specs/README.md`, `project-os/specs/S-003.md`, `project-os/tickets/v01-foundation.md` (baca-dulu T-176.1 dan T-182), dan skill `docs-consistency-audit`. Disetujui King Rezi 2026-11-11.

- [x] **T-246.1** Penunjuk ke judul section navigator memakai judul bahasa Inggris yang baru.
- [x] **T-246.2** `bun run docs:check` bersih.
- [x] **T-246.3** Audit topik language (2026-11-11): `project-os/PROJECT_OVERVIEW.md` baris "Bahasa komunikasi dan dokumentasi" menjadi penunjuk ke `AGENTS.md` aturan 8, dan rentang S-004 di `project-os/tickets/v01-foundation.md` menjadi T-234 sampai T-246. Atas keputusan King Rezi: berkas agen `ridwan-architecture-reviewer.md` dan `najwa-qa-engineer.md` memakai "Done by"; tujuh berkas agen menunjuk `AGENTS.md` aturan 1 (dan gibran aturan 8) alih-alih menyalin kalimatnya; penunjuk "§ New Work" di ADR-153 dan ADR-063.

**Utang yang dicatat:** tidak ada tersisa. Selisih "Dikerjakan oleh" di berkas agen Ridwan dan Najwa, salinan kalimat sapaan di tujuh berkas agen, dan penunjuk "Pekerjaan Baru" di ADR-153 dan ADR-063 diperbaiki atas keputusan King Rezi setelah audit topik language (T-246.3).

**Belum terbukti:** tidak ada butir runtime, tidak ada sesi uji .3 untuk tiket ini. Verified lewat `bun run docs:check` bersih di branch closeout (pengecualian S-004, lihat spec).

**Blocked by:** T-235

### T-254 · Record the decision to translate the agent files

`✅ Done (code) (2026-11-12, ADR-162 Accepted)` · **Mode** HITL · **Domain** project-os, agen · **ADR** ADR-133, ADR-160, ADR-162 · **Spec** S-004 · **Depends** —
**Baca dulu:** `project-os/specs/S-004.md` · `project-os/decisions/ADR-160-bahasa-orkestrasi-lapisan-1-dan-2.md` · `.claude/agents/README.md`

Gerbang terjemahan delapan berkas `.claude/agents/`. Berkas itu Static Reference dan hanya berubah atas permintaan eksplisit King Rezi (`AGENTS.md`). ADR-160 menolak mengubahnya di T-234 dan hanya menunda ke tiket sendiri. Tiket AFK T-255 sampai T-262 tidak dimulai sebelum gerbang ini selesai.

- [x] **T-254.1** `(2026-11-12)` Permintaan eksplisit King Rezi di chat: menambah tiket terjemahan delapan berkas agen di berkas S-004, menerjemahkan `description` juga, lalu menerima ADR-162.
- [x] **T-254.2** `(2026-11-12, ADR-162 Accepted)` ADR baru (nomor berikutnya setelah ADR-161, prosa Indonesia) mengamandemen ADR-160: delapan berkas agen ikut lapisan 2. Status Accepted hanya atas jawaban King Rezi. Teks aturan bahasa tetap hanya di `AGENTS.md` aturan 8.
- [x] **T-254.3** `(2026-11-12)` Keputusan King Rezi atas pertanyaan terbuka: (a) `name` di frontmatter tidak berubah, dan `description` (dipakai pemilihan subagen) **ikut diterjemahkan** (diputuskan King Rezi 2026-11-12), dengan kata kunci pemicu pemilihan subagen tetap terbaca di versi Inggris; (b) kata kunci yang dipakai berkas lain (mis. "Dikerjakan oleh") ikut apa; (c) tautan artifact dan nama tiket tidak berubah.
- [x] **T-254.4** `(2026-11-12)` Bagian "Di luar spec" dan baris "Berkas agen" di `project-os/specs/S-004.md` diperbarui menunjuk ADR itu, tanpa menyalin aturan (ADR-133).

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** tidak ada

### T-255 · Translate the agents README

`✅ Done (code) (2026-11-12)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133, ADR-160 · **Spec** S-004 · **Depends** T-254
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/agents/README.md`

- [x] **T-255.1** Berkas utuh dalam bahasa Inggris. Gerbang dan batas peran tidak berubah. `name` di frontmatter, nama berkas, dan penunjuk ke `AGENTS.md` tidak berubah; `description` diterjemahkan (T-254.3). Sebutan King Rezi tetap.
- [x] **T-255.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [x] **T-255.3** `(2026-11-12, perbandingan berkas Indonesia git 164402ff dengan versi Inggris oleh agen independen)` Satu sesi uji mematuhi gerbang yang sama dengan versi sebelumnya (perbandingan dengan versi Indonesia di git oleh agen independen, seperti T-235.3).

**Belum terbukti:** pemilihan subagen lewat `description` Inggris belum dicoba di sesi nyata; .3 adalah perbandingan teks oleh agen independen (PASS: tidak ada gerbang yang hilang, bertambah, atau tertukar; `name`, `tools`, `effort` identik byte demi byte). Bukan butir runtime.

**Blocked by:** T-254

### T-256 · Translate the prabowo-feature-engineer agent file

`✅ Done (code) (2026-11-12)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133, ADR-160 · **Spec** S-004 · **Depends** T-254
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/agents/prabowo-feature-engineer.md`

- [x] **T-256.1** Berkas utuh dalam bahasa Inggris. Gerbang dan batas peran tidak berubah. `name` di frontmatter, nama berkas, dan penunjuk ke `AGENTS.md` tidak berubah; `description` diterjemahkan (T-254.3). Sebutan King Rezi tetap.
- [x] **T-256.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [x] **T-256.3** `(2026-11-12, perbandingan berkas Indonesia git 164402ff dengan versi Inggris oleh agen independen)` Satu sesi uji mematuhi gerbang yang sama dengan versi sebelumnya (perbandingan dengan versi Indonesia di git oleh agen independen, seperti T-235.3).

**Belum terbukti:** pemilihan subagen lewat `description` Inggris belum dicoba di sesi nyata; .3 adalah perbandingan teks oleh agen independen (PASS: tidak ada gerbang yang hilang, bertambah, atau tertukar; `name`, `tools`, `effort` identik byte demi byte). Bukan butir runtime.

**Blocked by:** T-254

### T-257 · Translate the mark-ui-engineer agent file

`✅ Done (code) (2026-11-12)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133, ADR-160 · **Spec** S-004 · **Depends** T-254
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/agents/mark-ui-engineer.md`

- [x] **T-257.1** Berkas utuh dalam bahasa Inggris. Gerbang dan batas peran tidak berubah. `name` di frontmatter, nama berkas, dan penunjuk ke `AGENTS.md` tidak berubah; `description` diterjemahkan (T-254.3). Sebutan King Rezi tetap.
- [x] **T-257.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [x] **T-257.3** `(2026-11-12, perbandingan berkas Indonesia git 164402ff dengan versi Inggris oleh agen independen)` Satu sesi uji mematuhi gerbang yang sama dengan versi sebelumnya (perbandingan dengan versi Indonesia di git oleh agen independen, seperti T-235.3).

**Belum terbukti:** pemilihan subagen lewat `description` Inggris belum dicoba di sesi nyata; .3 adalah perbandingan teks oleh agen independen (PASS: tidak ada gerbang yang hilang, bertambah, atau tertukar; `name`, `tools`, `effort` identik byte demi byte). Bukan butir runtime.

**Blocked by:** T-254

### T-258 · Translate the neymar-product-designer agent file

`✅ Done (code) (2026-11-12)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133, ADR-160 · **Spec** S-004 · **Depends** T-254
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/agents/neymar-product-designer.md`

- [x] **T-258.1** Berkas utuh dalam bahasa Inggris. Gerbang dan batas peran tidak berubah. `name` di frontmatter, nama berkas, dan penunjuk ke `AGENTS.md` tidak berubah; `description` diterjemahkan (T-254.3). Sebutan King Rezi tetap.
- [x] **T-258.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [x] **T-258.3** `(2026-11-12, perbandingan berkas Indonesia git 164402ff dengan versi Inggris oleh agen independen)` Satu sesi uji mematuhi gerbang yang sama dengan versi sebelumnya (perbandingan dengan versi Indonesia di git oleh agen independen, seperti T-235.3).

**Belum terbukti:** pemilihan subagen lewat `description` Inggris belum dicoba di sesi nyata; .3 adalah perbandingan teks oleh agen independen (PASS: tidak ada gerbang yang hilang, bertambah, atau tertukar; `name`, `tools`, `effort` identik byte demi byte). Bukan butir runtime.

**Blocked by:** T-254

### T-259 · Translate the elon-backend-engineer agent file

`✅ Done (code) (2026-11-12)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133, ADR-160 · **Spec** S-004 · **Depends** T-254
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/agents/elon-backend-engineer.md`

- [x] **T-259.1** Berkas utuh dalam bahasa Inggris. Gerbang dan batas peran tidak berubah. `name` di frontmatter, nama berkas, dan penunjuk ke `AGENTS.md` tidak berubah; `description` diterjemahkan (T-254.3). Sebutan King Rezi tetap.
- [x] **T-259.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [x] **T-259.3** `(2026-11-12, perbandingan berkas Indonesia git 164402ff dengan versi Inggris oleh agen independen)` Satu sesi uji mematuhi gerbang yang sama dengan versi sebelumnya (perbandingan dengan versi Indonesia di git oleh agen independen, seperti T-235.3).

**Belum terbukti:** pemilihan subagen lewat `description` Inggris belum dicoba di sesi nyata; .3 adalah perbandingan teks oleh agen independen (PASS: tidak ada gerbang yang hilang, bertambah, atau tertukar; `name`, `tools`, `effort` identik byte demi byte). Bukan butir runtime.

**Blocked by:** T-254

### T-260 · Translate the ridwan-architecture-reviewer agent file

`✅ Done (code) (2026-11-12)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133, ADR-160 · **Spec** S-004 · **Depends** T-254
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/agents/ridwan-architecture-reviewer.md`

- [x] **T-260.1** Berkas utuh dalam bahasa Inggris. Gerbang dan batas peran tidak berubah. `name` di frontmatter, nama berkas, dan penunjuk ke `AGENTS.md` tidak berubah; `description` diterjemahkan (T-254.3). Sebutan King Rezi tetap.
- [x] **T-260.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [x] **T-260.3** `(2026-11-12, perbandingan berkas Indonesia git 164402ff dengan versi Inggris oleh agen independen)` Satu sesi uji mematuhi gerbang yang sama dengan versi sebelumnya (perbandingan dengan versi Indonesia di git oleh agen independen, seperti T-235.3).

**Belum terbukti:** pemilihan subagen lewat `description` Inggris belum dicoba di sesi nyata; .3 adalah perbandingan teks oleh agen independen (PASS: tidak ada gerbang yang hilang, bertambah, atau tertukar; `name`, `tools`, `effort` identik byte demi byte). Bukan butir runtime.

**Blocked by:** T-254

### T-261 · Translate the najwa-qa-engineer agent file

`✅ Done (code) (2026-11-12)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133, ADR-160 · **Spec** S-004 · **Depends** T-254
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/agents/najwa-qa-engineer.md`

- [x] **T-261.1** Berkas utuh dalam bahasa Inggris. Gerbang dan batas peran tidak berubah. `name` di frontmatter, nama berkas, dan penunjuk ke `AGENTS.md` tidak berubah; `description` diterjemahkan (T-254.3). Sebutan King Rezi tetap.
- [x] **T-261.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [x] **T-261.3** `(2026-11-12, perbandingan berkas Indonesia git 164402ff dengan versi Inggris oleh agen independen)` Satu sesi uji mematuhi gerbang yang sama dengan versi sebelumnya (perbandingan dengan versi Indonesia di git oleh agen independen, seperti T-235.3).

**Belum terbukti:** pemilihan subagen lewat `description` Inggris belum dicoba di sesi nyata; .3 adalah perbandingan teks oleh agen independen (PASS: tidak ada gerbang yang hilang, bertambah, atau tertukar; `name`, `tools`, `effort` identik byte demi byte). Bukan butir runtime.

**Blocked by:** T-254

### T-262 · Translate the gibran-project-manager agent file

`✅ Done (code) (2026-11-12)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133, ADR-160 · **Spec** S-004 · **Depends** T-254
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/agents/gibran-project-manager.md`

- [x] **T-262.1** Berkas utuh dalam bahasa Inggris. Gerbang dan batas peran tidak berubah. `name` di frontmatter, nama berkas, dan penunjuk ke `AGENTS.md` tidak berubah; `description` diterjemahkan (T-254.3). Sebutan King Rezi tetap.
- [x] **T-262.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [x] **T-262.3** `(2026-11-12, perbandingan berkas Indonesia git 164402ff dengan versi Inggris oleh agen independen)` Satu sesi uji mematuhi gerbang yang sama dengan versi sebelumnya (perbandingan dengan versi Indonesia di git oleh agen independen, seperti T-235.3).

**Belum terbukti:** pemilihan subagen lewat `description` Inggris belum dicoba di sesi nyata; .3 adalah perbandingan teks oleh agen independen (PASS: tidak ada gerbang yang hilang, bertambah, atau tertukar; `name`, `tools`, `effort` identik byte demi byte). Bukan butir runtime.

**Blocked by:** T-254
