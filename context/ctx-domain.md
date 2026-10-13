# Context — Domain

Indeks **Bounded Context, shared types, dan domain boundary rules**.  
Sumber utama: Architecture Baseline — domain model.

---

## Baca dulu

| Dokumen                                                                                                        | Kapan                                         |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| [`../product-discovery/05-architecture/domain-model.md`](../product-discovery/05-architecture/domain-model.md) | Wajib sebelum kerja di domain / shared types  |
| [`../product-discovery/05-architecture/README.md`](../product-discovery/05-architecture/README.md)             | Indeks Architecture Baseline v1.0 (ADR-025)   |
| [`../packages/shared/`](../packages/shared/)                                                                   | Implementasi ID, enum, value object lintas BC |

---

## Bounded Context (ingat cepat)

| ID    | Context      | MVP      |
| ----- | ------------ | -------- |
| BC-01 | Identity     | Ya       |
| BC-02 | Workspace    | Ya       |
| BC-03 | Publishing   | Ya       |
| BC-04 | AI Assistant | Ya       |
| BC-05 | Engagement   | Ya       |
| BC-06 | Analytics    | Ya       |
| BC-07 | Start Page   | Ya       |
| BC-08 | Media        | Ya       |
| BC-09 | Notification | Ya       |
| BC-10 | Billing      | Post-MVP |

Modul kode: `apps/web/src/domains/<nama-domain>/` (lihat `ctx-implementation.md`).

---

## Aturan operasional (domain)

1. Hard rules shared types / cross-domain / domain-tanpa-Prisma — lihat
   **`../AGENTS.md` rules 6, 7, 8**, tidak diulang di sini.
2. Hanya pass **ID** antar domain bila memungkinkan; jangan share aggregate penuh lintas BC.
3. Penamaan entity/tabel mengikuti `domain-model.md` + amandemen ADR (mis. ADR-027 untuk pengecualian naming tabel).
4. Jangan menambah BC baru atau mengubah boundary tanpa ADR.
5. Publishing format: enum `ContentFormat` di `packages/shared`; nilai hidup di `PostTarget` (+ `platformOptions` JSON). Matriks platform & default bisnis → `domain-model.md` / **ADR-039**. Override Outstand hanya di ACL.
6. Engagement MVP (**ADR-040**) hanya komentar dan reply. Direct Message,
   mention, serta webhook engagement bukan kontrak domain MVP; data baru berasal
   dari sync internal 30 menit atau manual refresh.
7. Nama event Outstand bukan enum/status domain. ACL memetakan
   `post.published`, `post.error`, dan `account.token_expired` ke bahasa domain.

Boundary rules lengkap (BR-01 dst.) → `domain-model.md`.

---

## Related context

- Layer & komunikasi service → `ctx-architecture.md`
- Pola folder & kode → `ctx-implementation.md`
- Produk / roles → `ctx-business.md`
