# Context — Business (+ Product + User)

Indeks untuk **mengapa produk ada**, **apa yang dibangun di MVP**, dan **siapa penggunanya**.  
Opsi A: Product + User digabung di file ini (bukan file `ctx-*` terpisah).

---

## Baca dulu

### Business — `01-business/`

| Dokumen                                                                                    | Isi singkat                                         |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| [`../product-discovery/01-business/README.md`](../product-discovery/01-business/README.md) | Indeks Business Baseline v1.0 (ADR-007)             |
| [`product-vision.md`](../product-discovery/01-business/product-vision.md)                  | Visi produk                                         |
| [`problem-statement.md`](../product-discovery/01-business/problem-statement.md)            | Masalah yang diselesaikan                           |
| [`target-market.md`](../product-discovery/01-business/target-market.md)                    | Marketing Team (utama); Startup & Agency (sekunder) |

### Product — `02-product/`

| Dokumen                                                                                  | Isi singkat                                                                  |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [`../product-discovery/02-product/README.md`](../product-discovery/02-product/README.md) | Indeks Product Baseline v1.0 (ADR-008)                                       |
| [`mvp-definition.md`](../product-discovery/02-product/mvp-definition.md)                 | Batas MVP                                                                    |
| [`product-scope.md`](../product-discovery/02-product/product-scope.md)                   | Scope / non-scope                                                            |
| [`feature-modules.md`](../product-discovery/02-product/feature-modules.md)               | Modul fitur                                                                  |
| [`feature-priority.md`](../product-discovery/02-product/feature-priority.md)             | Prioritas                                                                    |
| [`roles-permissions.md`](../product-discovery/02-product/roles-permissions.md)           | Account Owner / Admin / Creator + status konten kanonikal (ADR-012, ADR-074) |

### User — `03-user/`

| Dokumen                                                                            | Isi singkat                                   |
| ---------------------------------------------------------------------------------- | --------------------------------------------- |
| [`../product-discovery/03-user/README.md`](../product-discovery/03-user/README.md) | Indeks User Discovery Baseline v1.0 (ADR-009) |
| [`user-personas.md`](../product-discovery/03-user/user-personas.md)                | Persona kanonikal                             |
| [`jobs-to-be-done.md`](../product-discovery/03-user/jobs-to-be-done.md)            | JTBD                                          |
| [`user-scenarios.md`](../product-discovery/03-user/user-scenarios.md)              | Skenario utama                                |

---

## Aturan operasional

1. **Persona kanonikal** (jangan diganti nama): Raka, Maya, Sinta, Dimas, Lara.
2. Roles kanonikal (ADR-074): Account Owner, Admin, Creator — detail & transisi status konten hanya dari `roles-permissions.md`.
3. Jangan menambah fitur di luar MVP/scope tanpa ADR + update Product Baseline.
4. Status konten kanonikal (Draft → … → Published/Failed) harus konsisten dengan `roles-permissions.md` dan UX.
5. Diskusi pricing / competitor / metrics bisnis → baca `01-business/`; jangan mengarang angka atau positioning baru di kode.
6. Scope Engagement MVP mengikuti ADR-040: komentar + reply melalui sync 30
   menit dan manual refresh. Direct Message, mention, dan engagement webhook
   bukan MVP.

---

## MVP (ingat cepat)

Modul inti: Workspace, Publishing, Analytics, Engagement, MCP Access (ADR-138), Start Page (+ Identity, Media, Notification sebagai pendukung).

Billing (BC-10) = **Post-MVP**.

Detail modul/BC → `ctx-domain.md`. Flow layar → `ctx-design.md` (UX).

---

## Related context

- Domain / BC → `ctx-domain.md`
- UX & visual → `ctx-design.md`
- Project governance → `ctx-project.md`
