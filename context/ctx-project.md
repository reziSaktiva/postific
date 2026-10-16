# Context — Project

Indeks operasional untuk **cara kerja project** (Project OS). Bukan salinan `project-manager/`.

---

## Baca dulu

| Dokumen                                                                            | Kapan                                                                                                                                             |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`../project-manager/PROJECT_STATE.md`](../project-manager/PROJECT_STATE.md)       | Setiap sesi — phase, mode, Known Issues, blockers                                                                                                 |
| [`../project-manager/AVAILABLE_TASKS.md`](../project-manager/AVAILABLE_TASKS.md)   | Sebelum mengerjakan task — antrian yang belum selesai. Tiket, termasuk yang selesai, di `tasks/vXX-*.md` (buka hanya section yang ID-nya dipilih) |
| [`../project-manager/PROJECT_RULES.md`](../project-manager/PROJECT_RULES.md)       | Governance, klasifikasi dokumen, AI collaboration                                                                                                 |
| [`../project-manager/DECISIONS.md`](../project-manager/DECISIONS.md)               | Sebelum mengubah keputusan material                                                                                                               |
| [`../project-manager/PROJECT_OVERVIEW.md`](../project-manager/PROJECT_OVERVIEW.md) | Orientasi singkat produk + preferensi kerja                                                                                                       |
| [`../AGENTS.md`](../AGENTS.md)                                                     | Pintu masuk agent + hard rules                                                                                                                    |

Skill wajib: [`.claude/skills/project-os-navigator/SKILL.md`](../.claude/skills/project-os-navigator/SKILL.md).

Sebelum mengeksekusi task implementasi kode, **wajib** evaluasi delegasi
subagent lewat pemetaan Domain → Subagent di
[`.claude/agents/README.md`](../.claude/agents/README.md) (ADR-063).

---

## Aturan operasional

1. Status, progress (%), milestone aktif → **hanya** di `PROJECT_STATE.md`. **Pengecualian (ADR-062, ADR-131):** status task terbuka di `AVAILABLE_TASKS.md`; semua tiket di `tasks/vXX-*.md`.
2. Keputusan material (scope, arsitektur, stack, BC) → ADR di `DECISIONS.md` sebelum mengubah baseline.
3. Task implementasi kode → **evaluasi delegasi subagent dulu** (`../AGENTS.md` poin 3, ADR-063) — lihat pemetaan Domain → Subagent di `.claude/agents/README.md`.
4. Insight diskusi penting → `CONVERSATIONS.md`; ide spekulatif → `BRAINSTORM.md`.
5. Setelah pekerjaan selesai → ubah status tiket di `tasks/vXX-*.md` dan keluarkan barisnya dari `AVAILABLE_TASKS.md` kalau sudah ✅. Update `PROJECT_STATE.md` hanya bila phase/milestone/Known Issues berubah. Jangan menyalin detail task ke `PROJECT_STATE.md`. Jejak sesi adalah commit git (ADR-131).
6. Bahasa dokumentasi & komunikasi project: **Bahasa Indonesia** (kecuali diminta lain).
7. Jangan commit/push kecuali user meminta eksplisit. Jangan commit secret (`.env.local`, kredensial).
8. Untuk implementasi Outstand M8, ADR-040 mengamendemen kontrak lama. Baca
   `DECISIONS.md` + `ctx-architecture.md`; jangan menyimpulkan handler/job
   runtime sudah ada hanya karena alignment dokumentasi dan schema selesai.

---

## Living vs static

| Tipe             | File                                                                          | Boleh memuat status/progress?                         |
| ---------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| Living           | `PROJECT_STATE.md`, `AVAILABLE_TASKS.md`, `tasks/vXX-*.md` (ADR-062, ADR-131) | Ya (STATE: phase/milestone/%; task: status tiket)     |
| Append-Only      | `DECISIONS.md` + `decisions/`, `CONVERSATIONS.md`, `BRAINSTORM.md`            | Hanya entri baru ditambahkan, entri lama tidak diedit |
| Static reference | README, overview, baseline `product-discovery/`, `SKILL.md`                   | Tidak — jangan taruh ✅/⏳/%/phase aktif              |

---

## Orientasi arsitektur ringkas

Blueprint high-level (bukan detail BC): [`../project-manager/ARCHITECTURE_OVERVIEW.md`](../project-manager/ARCHITECTURE_OVERVIEW.md).

Detail sistem → `ctx-architecture.md`. Stack/infra → `ctx-technical-context.md`.

---

## Related context

- Produk / persona / MVP → `ctx-business.md`
- Domain DDD → `ctx-domain.md`
