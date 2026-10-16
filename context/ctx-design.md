# Context — Design (+ UX)

Pointer ke **Claude Design** (tool eksternal, live) dan ke **UX Planning
Baseline** (`04-ux/`). Product/roles/persona → `ctx-business.md`.

**Catatan (ADR-045, ADR-057):** folder `design/` (paket handoff untuk tim
designer) sudah **dihapus** dari repo dan **tidak akan dibuat ulang** —
project ini tidak akan merekrut designer eksternal; perannya digantikan
permanen oleh King Rezi sendiri lewat project Claude Design. Pointer project
Claude Design yang sebelumnya ada di `design/README.md` dipindah ke bagian
"Claude Design" di bawah.

---

## Baca dulu

### UX Planning Baseline — `04-ux/` (SoT alur & struktur layar)

| Dokumen                                                                                 | Topik                             |
| --------------------------------------------------------------------------------------- | --------------------------------- |
| [`../product-discovery/04-ux/README.md`](../product-discovery/04-ux/README.md)          | Indeks UX Baseline v1.0 (ADR-013) |
| [`information-architecture.md`](../product-discovery/04-ux/information-architecture.md) | IA / struktur informasi           |
| [`user-flows.md`](../product-discovery/04-ux/user-flows.md)                             | Alur solusi                       |
| [`navigation-patterns.md`](../product-discovery/04-ux/navigation-patterns.md)           | Navigasi                          |
| [`key-screen-patterns.md`](../product-discovery/04-ux/key-screen-patterns.md)           | Pola layar kritis                 |
| [`ux-principles.md`](../product-discovery/04-ux/ux-principles.md)                       | Prinsip UX                        |

### Claude Design (tool eksternal, referensi visual)

| Field       | Value                                                                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project     | `Social Media Management`                                                                                                                                              |
| Project ID  | `84aded99-bb23-49b1-be9f-dd8f21c6873e`                                                                                                                                 |
| Akses       | claude.ai/design (login akun yang sama dengan Claude Code)                                                                                                             |
| Sync        | Tool `DesignSync` bawaan Claude Code (native, bukan MCP) — manual/on-request, bukan otomatis (ADR-042)                                                                 |
| Isi project | Foundations (color/type/layout), Components (buttons, status-chips, forms, cards, navigation, table, dialog), Templates 8 layar KSP-01–08 + 5 layar Auth Flow suplemen |

Project lama bernama **"Modernist"** di akun yang sama **bukan** milik product ini — jangan dipakai sebagai referensi.

---

## Aturan operasional

1. `04-ux/` tetap **SoT** untuk alur, IA, dan fungsi layar — Claude Design hanya representasi visual yang diturunkan darinya, bukan pengganti.
2. `design-tokens.md` (`../product-discovery/06-engineering/design-tokens.md`) tetap **SoT design tokens** (ADR-038) — bukan project Claude Design, bukan screenshot.
3. Implementasi layar M8 **tidak menunggu** token final: gunakan Stone theme (ADR-087) sebagai acuan nilai dan jangan mengarang custom brand hex. Sejak ADR-055 (diamandemen ADR-097), Light/Dark Mode Toggle adalah fitur resmi (kontrol persisten di sidebar footer) — mekanismenya lewat Tailwind `dark:` + shadcn theme provider, bukan tema/token baru.
4. **shadcn/ui adalah fondasi komponen permanen** (ADR-097, membalik ADR-041). Migrasi dari Astryx ke shadcn/ui selesai (ADR-097); detail status lihat `PROJECT_STATE.md` / `../project-os/tickets/v07-astryx-shadcn-migration.md` § T-102. Tailwind dipakai langsung sebagai styling komponen shadcn; wrapper di `components/ui/` dibuat selektif.
5. Wireframe detail di fase M8: **terbatas** — hanya jika dibutuhkan untuk implementasi layar (lihat `PROJECT_STATE` Active Conversation Mode).
6. Status konten & roles visual harus selaras `roles-permissions.md` (lihat `ctx-business.md`).
7. Persona di UI copy / contoh: Raka, Maya, Sinta, Dimas, Lara.
8. Jangan mengarang IA, flow, atau pola navigasi baru yang bertentangan dengan `04-ux/` tanpa ADR / update baseline.
9. Sinkronisasi antara baseline (`04-ux/`, `design-tokens.md`) dan project Claude Design bersifat **manual/on-request** — dijalankan saat diminta eksplisit, bukan checklist wajib di setiap sesi kerja UI (beda dengan workflow shadcn CLI/MCP di `AGENTS.md` yang wajib tiap task). Push saat UX baseline berubah berarti; review sebelum menerima perubahan dari sisi Claude Design (baseline + ADR tetap menang, lihat butir 1).
   9a. **Wajib reminder proaktif (ADR-056):** setiap kali ada perubahan yang
   berhubungan dengan UI/UX — baik di dokumen (`04-ux/`, `design-tokens.md`)
   maupun di project Claude Design (via `DesignSync`) — AI **wajib** secara
   eksplisit memberi tahu King Rezi bahwa kedua sisi berpotensi belum
   sinkron, dan tanya apakah perlu diselaraskan sekarang. Untuk **token
   nilai visual**, `design-tokens.md` dan Claude Design sekarang **co-equal**
   (tidak ada yang wajib jadi penulis pertama, amandemen ADR-038). Untuk
   **flow/fungsi layar**, `04-ux/` tetap SoT seperti butir 1 di atas —
   reminder di sini artinya "cek apakah representasi Claude Design masih
   sesuai", bukan mengubah siapa yang menang.
10. **Scope discipline (wajib, insiden ADR-052):** sebelum mengubah apapun di
    project Claude Design — terutama saat diminta menambah kontrol pembanding
    (toggle/switch antar variant) — baca dan ikuti
    `.claude/skills/claude-design-scope-discipline/SKILL.md`. Intinya: jangan
    pernah mengubah default/state yang sudah disetujui user sebagai efek
    samping fitur baru; kalau scope ambigu, tanya dulu; verifikasi selesai
    mencakup "tidak ada side-effect tak diminta", bukan cuma "fitur baru
    berfungsi".

---

## Mapping task UI → baca

| Task                                     | Baca                                                   |
| ---------------------------------------- | ------------------------------------------------------ |
| Susun halaman / route sesuai menu        | `information-architecture.md`                          |
| Alur publish / approve / connect account | `user-flows.md`                                        |
| Sidebar, navigasi, entry point Settings  | `navigation-patterns.md`                               |
| Pola layar editor, inbox, analytics      | `key-screen-patterns.md`                               |
| Content Format (Post/Reel/Story/Pin)     | `key-screen-patterns.md` (KSP-05-F11) + ADR-039        |
| Font, warna, neutral, status (SoT)       | `../product-discovery/06-engineering/design-tokens.md` |
| Komponen UI / styling                    | `monorepo-setup.md` + ADR-097 + shadcn CLI/MCP lokal   |

Implementasi React mengikuti `ctx-implementation.md`. Gunakan token neutral
Stone theme selama M8 (Light/Dark Mode Toggle ADR-055, diamandemen ADR-097,
tetap berlaku lintas seluruh section — lihat `IconButton`/toggle di sidebar
footer); komponen sederhana boleh diimpor langsung dan komponen kritis/luas
memakai wrapper selektif. Token yang sudah di-lock (co-equal dengan Claude
Design, tidak menunggu designer eksternal — ADR-056, ADR-057) dipetakan ke
CSS variable shadcn/ui + Tailwind token bridge.

---

## Related context

- Roles, MVP, persona → `ctx-business.md`
- Pola kode UI entry → `ctx-implementation.md`
- Stack / mirror token ke kode → `ctx-technical-context.md`
- Project mode (wireframe boleh/tidak) → `ctx-project.md` + `PROJECT_STATE.md`
- Keputusan penghapusan `design/` → `../project-os/DECISIONS.md` (ADR-045)
- Scope discipline saat mengubah Claude Design → `../.claude/skills/claude-design-scope-discipline/SKILL.md` (ADR-052)
- Sync docs ↔ Claude Design + kewajiban reminder proaktif → `../project-os/DECISIONS.md` (ADR-056)
- Tidak ada designer eksternal, permanen → `../project-os/DECISIONS.md` (ADR-057)
