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

`🟡 Done (code), menunggu Verified (staging) (2026-11-11)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133 · **Spec** S-004 · **Depends** T-234
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/skills/project-os-navigator/SKILL.md`

- [x] **T-235.1** Berkas skill utuh dalam bahasa Inggris. Arti gerbang dan kata kunci status tidak berubah. Sebutan King Rezi tetap. **5 Magic Words** mengikuti ADR T-234.
- [x] **T-235.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [ ] **T-235.3** Satu sesi uji mematuhi gerbang yang sama dengan versi sebelumnya.

**Belum terbukti:** T-235.3, satu sesi uji belum dijalankan. Butir ini sisa verifikasinya.

**Blocked by:** T-234

### T-236 · Translate the proactive-clarification skill

`🟡 Done (code), menunggu Verified (staging) (2026-11-11)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133 · **Spec** S-004 · **Depends** T-234
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/skills/proactive-clarification/SKILL.md`

- [x] **T-236.1** Berkas skill utuh dalam bahasa Inggris. Cara bertanya per ronde tidak berubah. Sebutan King Rezi tetap. **5 Magic Words** mengikuti ADR T-234.
- [x] **T-236.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [ ] **T-236.3** Satu sesi uji mematuhi gerbang yang sama dengan versi sebelumnya.

**Belum terbukti:** T-236.3, satu sesi uji belum dijalankan. Butir ini sisa verifikasinya.

**Blocked by:** T-234

### T-237 · Translate the docs-consistency-audit skill

`🟡 Done (code), menunggu Verified (staging) (2026-11-11)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133 · **Spec** S-004 · **Depends** T-234
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/skills/docs-consistency-audit/SKILL.md`

- [x] **T-237.1** Berkas skill utuh dalam bahasa Inggris. Cakupan audit tidak berubah. Sebutan King Rezi tetap. **5 Magic Words** mengikuti ADR T-234.
- [x] **T-237.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [ ] **T-237.3** Satu sesi uji mematuhi gerbang yang sama dengan versi sebelumnya.

**Belum terbukti:** T-237.3, satu sesi uji belum dijalankan. Butir ini sisa verifikasinya.

**Blocked by:** T-234

### T-238 · Translate the work-report-simple skill

`🟡 Done (code), menunggu Verified (staging) (2026-11-11)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133 · **Spec** S-004 · **Depends** T-234
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/skills/work-report-simple/SKILL.md`

- [x] **T-238.1** Berkas skill utuh dalam bahasa Inggris. Isi laporan (siapa mengerjakan, apa yang selesai, mengapa penting, langkah berikutnya) tidak berubah. Sebutan King Rezi tetap.
- [x] **T-238.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [ ] **T-238.3** Satu sesi uji menyusun laporan dengan bagian yang sama seperti versi sebelumnya.

**Belum terbukti:** T-238.3, satu sesi uji belum dijalankan. Butir ini sisa verifikasinya.

**Blocked by:** T-234

### T-239 · Translate the claude-design-scope-discipline skill

`🟡 Done (code), menunggu Verified (staging) (2026-11-11)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133 · **Spec** S-004 · **Depends** T-234
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/skills/claude-design-scope-discipline/SKILL.md`

- [x] **T-239.1** Berkas skill utuh dalam bahasa Inggris. Larangan mengubah default yang sudah disetujui tidak berubah. Sebutan King Rezi tetap.
- [x] **T-239.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [ ] **T-239.3** Satu sesi uji mematuhi gerbang yang sama dengan versi sebelumnya.

**Belum terbukti:** T-239.3, satu sesi uji belum dijalankan. Butir ini sisa verifikasinya.

**Blocked by:** T-234

### T-240 · Translate the wave-plan skill

`🟡 Done (code), menunggu Verified (staging) (2026-11-11)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133, ADR-153 · **Spec** S-004 · **Depends** T-234, T-225
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/skills/wave-plan/SKILL.md`

Menunggu T-225 karena berkas yang sama. Setelah T-225 selesai, berkas diterjemahkan utuh.

- [x] **T-240.1** Berkas skill utuh dalam bahasa Inggris. Langkah menyiapkan gelombang dan berhenti untuk persetujuan King Rezi tidak berubah.
- [x] **T-240.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [ ] **T-240.3** Satu sesi uji mematuhi gerbang yang sama dengan versi sebelumnya.

**Belum terbukti:** T-240.3, satu sesi uji belum dijalankan. Butir ini sisa verifikasinya.

**Blocked by:** T-234, T-225

### T-241 · Translate the wave-work skill

`🟡 Done (code), menunggu Verified (staging) (2026-11-11)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133, ADR-153 · **Spec** S-004 · **Depends** T-234, T-225
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/skills/wave-work/SKILL.md`

Menunggu T-225 karena berkas yang sama. Istilah di berkas ini menjadi acuan empat berkas pendamping.

- [x] **T-241.1** Berkas skill utuh dalam bahasa Inggris. Gerbang King Rezi (migrasi, merge, commit) tidak berubah.
- [x] **T-241.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [ ] **T-241.3** Satu sesi uji mematuhi gerbang yang sama dengan versi sebelumnya.

**Belum terbukti:** T-241.3, satu sesi uji belum dijalankan. Butir ini sisa verifikasinya.

**Blocked by:** T-234, T-225

### T-242 · Translate the wave-work lane brief template

`⏳ Not Started` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133 · **Spec** S-004 · **Depends** T-241, T-225
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/skills/wave-work/lane-brief-template.md` · `.claude/skills/wave-work/SKILL.md`

- [ ] **T-242.1** Berkas template utuh dalam bahasa Inggris. Bagian brief dan istilahnya mengikuti T-241.
- [ ] **T-242.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.

**Blocked by:** T-241, T-225

### T-243 · Translate the wave-work handoff note

`⏳ Not Started` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133 · **Spec** S-004 · **Depends** T-241
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/skills/wave-work/handoff.md` · `.claude/skills/wave-work/SKILL.md`

- [ ] **T-243.1** Berkas utuh dalam bahasa Inggris. Bentuk handoff (penunjuk, tanpa rahasia) tidak berubah. Istilah mengikuti T-241.
- [ ] **T-243.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.

**Blocked by:** T-241

### T-244 · Translate the wave-work retro note

`⏳ Not Started` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133 · **Spec** S-004 · **Depends** T-241
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/skills/wave-work/retro.md` · `.claude/skills/wave-work/SKILL.md`

- [ ] **T-244.1** Berkas utuh dalam bahasa Inggris. Kategori saran retro tidak berubah. Istilah mengikuti T-241.
- [ ] **T-244.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.

**Blocked by:** T-241

### T-245 · Translate the wave-work integration pull request template

`⏳ Not Started` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133 · **Spec** S-004 · **Depends** T-241
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/skills/wave-work/integration-pr-template.md` · `.claude/skills/wave-work/SKILL.md`

- [ ] **T-245.1** Berkas template utuh dalam bahasa Inggris. Bagian Summary, Evidence, dan Merge Danger tetap ada. Istilah mengikuti T-241.
- [ ] **T-245.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.

**Blocked by:** T-241

### T-246 · Fix navigator heading pointers after translation

`🟡 Done (code), menunggu Verified (staging) (2026-11-11)` · **Mode** AFK · **Domain** project-os, agen · **ADR** ADR-133, ADR-160 · **Spec** S-004 · **Depends** T-235
**Baca dulu:** `project-os/specs/S-004.md` · `.claude/skills/project-os-navigator/SKILL.md`

Terjemahan T-235 mengubah judul section navigator ("Pekerjaan Baru" menjadi "New Work / Document Creation", "Bug / Inkonsistensi Dokumen" menjadi "Bug / Document Inconsistency"). Penunjuk ke judul lama diperbarui di `AGENTS.md`, `.claude/agents/README.md`, `project-os/PROJECT_RULES.md`, `project-os/specs/README.md`, `project-os/specs/S-003.md`, `project-os/tickets/v01-foundation.md` (baca-dulu T-176.1 dan T-182), dan skill `docs-consistency-audit`. Disetujui King Rezi 2026-11-11.

- [x] **T-246.1** Penunjuk ke judul section navigator memakai judul bahasa Inggris yang baru.
- [x] **T-246.2** `bun run docs:check` bersih.

**Utang yang dicatat (tidak diperbaiki, keputusan King Rezi):** (a) `.claude/agents/ridwan-architecture-reviewer.md` baris 33 dan `najwa-qa-engineer.md` baris 68 masih menulis "Dikerjakan oleh", sedangkan `work-report-simple` kini "Done by". Masuk utang berkas agen T-234.5. (b) ADR-153 baris 46 masih menunjuk "§ Pekerjaan Baru". ADR adalah lapisan 3 historis dan tidak diedit.

**Belum terbukti:** tidak ada butir runtime. Kata kunci status "Belum terbukti" dan "menunggu Verified (staging)" dipertahankan apa adanya sesuai S-004.

**Blocked by:** T-235
