# Context — Project

Indeks operasional untuk **cara kerja project** (Project OS). Bukan salinan `project-os/`.

---

## Baca dulu

| Dokumen                                                                    | Kapan                                                                                                                                               |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`../project-os/PROJECT_STATE.md`](../project-os/PROJECT_STATE.md)         | Setiap sesi — phase, mode, Known Issues, blockers                                                                                                   |
| [`../project-os/AVAILABLE_TICKETS.md`](../project-os/AVAILABLE_TICKETS.md) | Sebelum mengerjakan task — antrian yang belum selesai. Tiket, termasuk yang selesai, di `tickets/vXX-*.md` (buka hanya section yang ID-nya dipilih) |
| [`../project-os/PROJECT_RULES.md`](../project-os/PROJECT_RULES.md)         | Governance, klasifikasi dokumen, AI collaboration                                                                                                   |
| [`../project-os/DECISIONS.md`](../project-os/DECISIONS.md)                 | Sebelum mengubah keputusan material                                                                                                                 |
| [`../project-os/PROJECT_OVERVIEW.md`](../project-os/PROJECT_OVERVIEW.md)   | Orientasi singkat produk + preferensi kerja                                                                                                         |
| [`../AGENTS.md`](../AGENTS.md)                                             | Pintu masuk agent + hard rules                                                                                                                      |

Skill wajib: [`.claude/skills/project-os-navigator/SKILL.md`](../.claude/skills/project-os-navigator/SKILL.md).

Sebelum mengeksekusi task implementasi kode, **wajib** evaluasi delegasi
subagent lewat pemetaan Domain → Subagent di
[`.claude/agents/README.md`](../.claude/agents/README.md) (ADR-063).

---

## Aturan operasional

1. Status, progress (%), milestone aktif → **hanya** di `PROJECT_STATE.md`. **Pengecualian (ADR-062, ADR-131):** status task terbuka di `AVAILABLE_TICKETS.md`; semua tiket di `tickets/vXX-*.md`.
2. Keputusan material (scope, arsitektur, stack, BC) → ADR di `DECISIONS.md` sebelum mengubah baseline.
3. Task implementasi kode → **evaluasi delegasi subagent dulu** (`../AGENTS.md` poin 3, ADR-063) — lihat pemetaan Domain → Subagent di `.claude/agents/README.md`.
4. Insight diskusi penting → `CONVERSATIONS.md`; ide spekulatif → `BRAINSTORM.md`.
5. Setelah pekerjaan selesai → ubah status tiket di `tickets/vXX-*.md` dan keluarkan barisnya dari `AVAILABLE_TICKETS.md` kalau sudah ✅. Update `PROJECT_STATE.md` hanya bila phase/milestone/Known Issues berubah. Jangan menyalin detail task ke `PROJECT_STATE.md`. Jejak sesi adalah commit git (ADR-131). Perubahan kode wajib punya tiket. KI terbuka punya tiket. Urutan tulis kebenaran produk: `product-discovery/` → `context/` (hanya penunjuk) → `project-os/` (ADR-132).
6. Bahasa dokumentasi & komunikasi project: **Bahasa Indonesia** (kecuali diminta lain).
7. Jangan commit/push kecuali user meminta eksplisit. Jangan commit secret (`.env.local`, kredensial).
8. Untuk implementasi Outstand M8, ADR-040 mengamendemen kontrak lama. Baca
   `DECISIONS.md` + `ctx-architecture.md`; jangan menyimpulkan handler/job
   runtime sudah ada hanya karena alignment dokumentasi dan schema selesai.

---

## Living vs static

| Tipe             | File                                                                              | Boleh memuat status/progress?                         |
| ---------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Living           | `PROJECT_STATE.md`, `AVAILABLE_TICKETS.md`, `tickets/vXX-*.md` (ADR-062, ADR-131) | Ya (STATE: phase/milestone/%; task: status tiket)     |
| Append-Only      | `DECISIONS.md` + `decisions/`, `CONVERSATIONS.md`, `BRAINSTORM.md`                | Hanya entri baru ditambahkan, entri lama tidak diedit |
| Static reference | README, overview, baseline `product-discovery/`, `SKILL.md`                       | Tidak — jangan taruh ✅/⏳/%/phase aktif              |

---

## Orientasi arsitektur ringkas

Blueprint high-level (bukan detail BC): [`../project-os/ARCHITECTURE_OVERVIEW.md`](../project-os/ARCHITECTURE_OVERVIEW.md).

Detail sistem → `ctx-architecture.md`. Stack/infra → `ctx-technical-context.md`.

---

## Related context

- Produk / persona / MVP → `ctx-business.md`
- Domain DDD → `ctx-domain.md`
