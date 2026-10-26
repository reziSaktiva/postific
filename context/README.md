# AI Context Layer

Lapisan **indeks + aturan operasional** untuk AI coding agent. Bukan Source of Truth produk.

Jika isi file di sini bentrok dengan baseline atau ADR → **baseline + ADR menang**.

---

## Tujuan

- Memberi pintu masuk ringkas per domain kerja (project, bisnis/produk, domain, arsitektur, teknis, development, implementasi, desain).
- Menunjuk dokumen baseline yang wajib dibaca — bukan menyalin ulang `product-discovery/` atau `project-os/`.
- Menegakkan batas antar file agar agent tidak salah menaruh aturan (mis. coding rules vs pola fitur).

---

## Struktur (opsi A)

```text
context/
├── README.md                  ← dokumen ini
├── ctx-project.md             ← Project OS, state, rules, ADR
├── ctx-business.md            ← Business + Product + User
├── ctx-domain.md              ← Bounded context, shared types, boundary
├── ctx-architecture.md        ← Layer, ACL, jobs, auth arch, realtime
├── ctx-technical-context.md   ← Stack, env, Prisma, Better Auth, deploy/CI
├── ctx-development.md         ← DX, script, lint/test, konvensi coding
├── ctx-implementation.md      ← Pola implementasi di apps/web & domains/
└── ctx-design.md              ← pointer UX (04-ux) + artifact desain Postific (ADR-140)
```

---

## Batas keras antar file

| File                    | Termasuk                                                                            | Tidak termasuk                                          |
| ----------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `ctx-project`           | Cara kerja project, phase/state, governance, ADR index                              | Detail produk/UX/arsitektur                             |
| `ctx-business`          | Vision, market, MVP/scope, roles, persona                                           | BC DDD, stack teknis, pola kode                         |
| `ctx-domain`            | BC, entity, shared types, domain boundary rules                                     | Infra, Prisma schema detail, UI                         |
| `ctx-architecture`      | _Apa & mengapa_ sistem: layer, ACL Outstand, jobs, auth arch, realtime, DB strategy | Config env, script DX, gaya kode                        |
| `ctx-technical-context` | _Stack & infra_: Bun/Next, Prisma, Better Auth config, Railway, env, CI             | Pola folder domain, konvensi naming kode                |
| `ctx-development`       | DX, perintah lokal/CI, lint/format/test, **aturan coding/konvensi**                 | Pola Application Service / di folder mana fitur ditaruh |
| `ctx-implementation`    | _Cara menulis fitur_ di repo: entry → service → domain → repo, import rules         | Keputusan stack atau pricing bisnis                     |
| `ctx-design`            | Pointer ke UX flows/IA (`04-ux/`) dan artifact desain Postific (ADR-140)            | Implementasi komponen React detail                      |

---

## Cara pakai (agent)

1. Baca `../AGENTS.md` dan Snapshot `../project-os/PROJECT_STATE.md` dulu. Kalau akan mengerjakan task: lanjut ke `../project-os/AVAILABLE_TICKETS.md` dan berhenti di situ untuk memilih ID, lalu buka hanya section tiket itu di `tickets/vXX-*.md`.
2. Buka **satu atau dua** file `ctx-*` yang relevan dengan task (lihat tabel mapping di `AGENTS.md`).
3. Ikuti link ke baseline; baca dokumen sumber sebelum mengubah kode atau keputusan material.
4. Jangan menduplikasi status progress (% / ✅ / phase) di file `context/` — itu hanya di `PROJECT_STATE.md`, kecuali status task yang tempatnya di `AVAILABLE_TICKETS.md` + `tickets/` (ADR-062, ADR-131).

---

## Aturan isi file `ctx-*`

- Ringkas: indeks, checklist, dan aturan operasional.
- Pointer wajib pakai path relatif ke repo (contoh: `../product-discovery/05-architecture/domain-model.md`).
- Jangan salin paragraf panjang dari baseline.
- Perubahan material (arsitektur, scope, stack) → ADR di `../project-os/DECISIONS.md`, lalu update pointer di sini bila perlu.

---

## Related

- Pintu masuk agent: `../AGENTS.md`
- Source of Truth produk: `../product-discovery/`
- Project OS: `../project-os/`
- Pointer desain (artifact desain + UX): `ctx-design.md`
