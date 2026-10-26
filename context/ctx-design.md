# Context — Design (+ UX)

Pointer ke **artifact desain Postific** (artifact di Claude, ADR-140) dan ke
**UX Planning Baseline** (`04-ux/`). Product/roles/persona → `ctx-business.md`.

**Catatan (ADR-045, ADR-057):** folder `design/` (paket handoff untuk tim
designer) sudah **dihapus** dari repo dan **tidak akan dibuat ulang** —
project ini tidak akan merekrut designer eksternal; perannya digantikan
permanen oleh King Rezi sendiri lewat artifact desain. Pointer yang
sebelumnya ada di `design/README.md` dipindah ke bagian "Artifact desain
Postific" di bawah.

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

### Artifact desain Postific (referensi visual, ADR-140)

Menggantikan project Claude Design standalone dan tool `DesignSync` (standalone tutup 2026-12-14).

| Field                  | Value                                                                                                                                                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Artifact Postific      | https://claude.ai/artifact/FdRNU4gnxgAGY3zmBxNfR3 (tipe Design System). Token (`project/tokens.json`, `project/tokens.css`), komponen shadcn asli (`project/components/<Nama>/`), kartu layar (`project/components/Screen<Nama>/preview.html`), template asli (`project/templates/`) |
| Postific Design Review | https://claude.ai/artifact/4BJCWNsCwubLd7SFwRtree — galeri semua layar dengan menu samping; tempat King Rezi meninjau dan mengonfirmasi rancangan                                                                                                                                    |
| Akses                  | claude.ai (login akun yang sama). Dibaca dan ditulis lewat tool `Artifact` (action `read` dan `publish`)                                                                                                                                                                             |
| Sync                   | Manual/on-request, bukan otomatis (ADR-140 poin 8). Tidak ada `DesignSync` untuk menulis                                                                                                                                                                                             |
| Project lama           | Claude Design `84aded99-bb23-49b1-be9f-dd8f21c6873e`: hanya-baca, dilepas sebelum 2026-12-14. Project "Modernist" di akun yang sama **bukan** milik product ini                                                                                                                      |

**Cara membaca:** `Artifact` action `read` dengan `url` artifact dan `path` file (mis. `project/components/ScreenPublishHistory/preview.html`). File yang dibaca tersimpan lokal; jangan mengubah artifact tanpa membaca versi terbaru.

**Cara mengubah:** ikuti aturan tipe artifact (baca dulu, ubah seperlunya, publish ulang dengan `files`, indeks `project/design-system.json` paling akhir). Layar yang berubah dipublish ulang ke Postific Design Review dan kartunya diperbarui di artifact Postific. Rancangan baru wajib dikonfirmasi King Rezi di galeri sebelum kode ditulis.

---

## Aturan operasional

1. `04-ux/` tetap **SoT** untuk alur, IA, dan fungsi layar — artifact desain hanya representasi visual yang diturunkan darinya, bukan pengganti.
2. `design-tokens.md` (`../product-discovery/06-engineering/design-tokens.md`) tetap **SoT design tokens** (ADR-038) — bukan artifact desain, bukan screenshot.
3. Implementasi layar M8 **tidak menunggu** token final: gunakan Stone theme (ADR-087) sebagai acuan nilai dan jangan mengarang custom brand hex. Sejak ADR-055 (diamandemen ADR-097), Light/Dark Mode Toggle adalah fitur resmi (kontrol persisten di sidebar footer) — mekanismenya lewat Tailwind `dark:` + shadcn theme provider, bukan tema/token baru.
4. **shadcn/ui adalah fondasi komponen permanen** (ADR-097, membalik ADR-041). Migrasi dari Astryx ke shadcn/ui selesai (ADR-097); detail status lihat `PROJECT_STATE.md` / `../project-os/tickets/v07-astryx-shadcn-migration.md` § T-102. Tailwind dipakai langsung sebagai styling komponen shadcn; wrapper di `components/ui/` dibuat selektif.
5. Wireframe detail di fase M8: **terbatas** — hanya jika dibutuhkan untuk implementasi layar (lihat `PROJECT_STATE` Active Conversation Mode).
6. Status konten & roles visual harus selaras `roles-permissions.md` (lihat `ctx-business.md`).
7. Persona di UI copy / contoh: Raka, Maya, Sinta, Dimas, Lara.
8. Jangan mengarang IA, flow, atau pola navigasi baru yang bertentangan dengan `04-ux/` tanpa ADR / update baseline.
9. Sinkronisasi antara baseline (`04-ux/`, `design-tokens.md`) dan artifact desain bersifat **manual/on-request** — dijalankan saat diminta eksplisit, bukan checklist wajib di setiap sesi kerja UI (beda dengan workflow shadcn CLI/MCP di `AGENTS.md` yang wajib tiap task). Push saat UX baseline berubah berarti; review sebelum menerima perubahan dari sisi artifact desain (baseline + ADR tetap menang, lihat butir 1).
   9a. **Wajib reminder proaktif (ADR-056, dipertahankan ADR-140):** setiap kali ada perubahan yang
   berhubungan dengan UI/UX — baik di dokumen (`04-ux/`, `design-tokens.md`)
   maupun di artifact desain (via tool `Artifact`) — AI **wajib** secara
   eksplisit memberi tahu King Rezi bahwa kedua sisi berpotensi belum
   sinkron, dan tanya apakah perlu diselaraskan sekarang. Untuk **token
   nilai visual**, `design-tokens.md` dan artifact desain **co-equal**
   (tidak ada yang wajib jadi penulis pertama, amandemen ADR-038). Untuk
   **flow/fungsi layar**, `04-ux/` tetap SoT seperti butir 1 di atas —
   reminder di sini artinya "cek apakah representasi di artifact masih
   sesuai", bukan mengubah siapa yang menang.
10. **Scope discipline (wajib, insiden ADR-052):** sebelum mengubah apapun di
    artifact desain — terutama saat diminta menambah kontrol pembanding
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
memakai wrapper selektif. Token yang sudah di-lock (co-equal dengan artifact
desain, tidak menunggu designer eksternal — ADR-140, ADR-057) dipetakan ke
CSS variable shadcn/ui + Tailwind token bridge.

---

## Related context

- Roles, MVP, persona → `ctx-business.md`
- Pola kode UI entry → `ctx-implementation.md`
- Stack / mirror token ke kode → `ctx-technical-context.md`
- Project mode (wireframe boleh/tidak) → `ctx-project.md` + `PROJECT_STATE.md`
- Keputusan penghapusan `design/` → `../project-os/DECISIONS.md` (ADR-045)
- Scope discipline saat mengubah artifact desain → `../.claude/skills/claude-design-scope-discipline/SKILL.md` (ADR-052)
- Artifact menggantikan Claude Design, sync docs ↔ artifact, dan kewajiban reminder proaktif → `../project-os/DECISIONS.md` (ADR-140, menggantikan ADR-042 dan ADR-056)
- Tidak ada designer eksternal, permanen → `../project-os/DECISIONS.md` (ADR-057)
