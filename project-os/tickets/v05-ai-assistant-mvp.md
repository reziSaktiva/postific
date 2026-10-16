# v0.5 — AI Assistant MVP

> Bagian dari backlog berjenjang. Antrian: [`../AVAILABLE_TICKETS.md`](../AVAILABLE_TICKETS.md). Tiket selesai tetap di file ini. Deskripsi baru: ADR-131. Nama folder: ADR-132.

**Tujuan rilis:** Meningkatkan produktivitas melalui AI.
**Baseline rilis:** `product-discovery/02-product/release-roadmap.md` → v0.5

**Kedalaman dokumen ini:** task-level saja (rolling wave). **Subtask sengaja belum diisi** — akan dirinci saat rilis ini mendekat. ID task sudah dikunci sejak sekarang agar bisa dirujuk.

**Titik awal:** domain `ai-assistant/` masih stub kosong. Model `AiRequest` + `AiResult` **sudah ada** di schema.

> ⚠️ **Keputusan terbuka yang memblokir seluruh rilis ini:** provider dan model AI belum pernah ditetapkan di ADR manapun. Seluruh baseline (`product-discovery/`) hanya menyebut kemampuan ("Caption Generation", "Caption Improvement"), tidak menyebut penyedia. Ini harus diputuskan King Rezi lebih dulu — lihat T-060.

---

### T-060 · Tetapkan provider + model AI (butuh ADR baru)

`⏳ Not Started` · **Domain** ai-assistant · **ADR** belum ada — **task ini menghasilkan ADR** · **Depends** —
**Baca dulu:** `06-engineering/environment-management.md` · `06-engineering/dependency-strategy.md`

Keputusan yang harus diambil: provider, model, di mana pemanggilan berjalan (Server Action vs Route Handler vs job), penanganan biaya/rate limit, dan apakah ada kuota per workspace. Tanpa ini, T-061–T-065 tidak bisa dimulai.

Yang perlu dipertimbangkan saat memutuskan: kualitas hasil untuk Bahasa Indonesia, biaya per request, latensi (pengguna menunggu di dalam Draft Editor), dan apakah butuh streaming.

### T-061 · AI Assistant domain skeleton

`⏳ Not Started` · **Domain** ai-assistant · **ADR** ADR-017, ADR-018, ADR-019, ADR-031 · **Depends** T-060
**Baca dulu:** `05-architecture/domain-model.md` · `05-architecture/integration-layer.md`

Service + repository + adapter provider AI. Pemanggilan API eksternal wajib lewat **adapter terpisah** (pola Anti-Corruption Layer yang sama seperti `OutstandAdapter`) — domain logic tidak boleh memegang HTTP client. Persist ke `AiRequest`/`AiResult` untuk jejak audit + kontrol biaya.

### T-062 · Caption generation

`⏳ Not Started` · **Domain** ai-assistant · **ADR** — · **Depends** T-061
**Baca dulu:** `02-product/mvp-definition.md` · `03-user/user-scenarios.md`

**Must Have.** Hasilkan draft caption dari input singkat pengguna. Tentukan apakah output menghormati konteks per platform (batas karakter, gaya) atau generik.

### T-063 · Caption improvement

`⏳ Not Started` · **Domain** ai-assistant · **ADR** — · **Depends** T-061
**Baca dulu:** `02-product/mvp-definition.md`

**Must Have.** Perbaiki caption yang sudah ditulis pengguna, bukan membuat dari nol.

### T-064 · Tone rewrite / variasi gaya penulisan

`⏳ Not Started` · **Domain** ai-assistant · **ADR** — · **Depends** T-062, T-063
**Baca dulu:** `02-product/feature-priority.md`

Berstatus **Should Have** di `feature-priority.md` — boleh ditunda tanpa memblokir rilis.

### T-065 · Integrasi AI ke Draft Editor

`⏳ Not Started` · **Domain** ai-assistant · UI · **ADR** ADR-052 · **Depends** T-062, T-063
**Baca dulu:** `04-ux/key-screen-patterns.md` (KSP-05) · `.claude/skills/claude-design-scope-discipline/SKILL.md`

Masukkan kontrol AI ke Draft Editor modal (T-020) tanpa merusak alur yang sudah disetujui. Butuh sesi desain Claude Design lebih dulu.

> ⚠️ Draft Editor modal sudah 675 baris dan menampung banyak state (caption, target akun, format per akun, schedule, confirm step). Pertimbangkan memecah komponennya **sebelum** menambah fitur AI ke dalamnya.

---

## Catatan Rilis

- T-066–T-069 sengaja dikosongkan sebagai ruang penambahan task v0.5.
- **Definition of Done rilis ini:** AI menjadi bagian dari workflow pembuatan konten.
- **Yang sengaja di luar rilis ini (`feature-priority.md`):** AI Content Calendar, AI Performance Suggestions (Could Have), Autonomous AI Agent (Won't Have).
