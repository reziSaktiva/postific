## Decision ADR-156

### Title

Pemilih Pratinjau per Akun di Draft Editor Berupa shadcn `Select`, Bukan `Tabs` (Amandemen Detail KSP-05-F14 dan KSP-D02)

### Status

**Accepted** (keputusan King Rezi, 2026-11-04, dicatat 2026-11-05). Mengamandemen detail pola di ADR-155 (rancangan awal memakai `Tabs`), tanpa mengubah keputusan ADR-155 lainnya.

### Date

2026-11-05

### Context

Rancangan terkonfirmasi ADR-155 dan kode T-203.1 memakai `Tabs` (`TabsList variant="line"`, `flex-wrap`) untuk memilih akun yang dipratinjau. Saat review integrasi PR 256, King Rezi menemukan tab turun baris dan menimpa kartu Pratinjau (T-211). Tiga opsi dibandingkan di T-211.2: `ToggleGroup`, `Select`, dan `Tabs` satu baris. King Rezi memilih `Select` (2026-11-04); artifact Postific diperbarui Neymar dan dikonfirmasi di galeri (T-211.3); kode mengikuti di T-211.4. Baseline `product-discovery/04-ux/` belum menyebut pola ini secara eksplisit, dan perubahan baseline butuh ADR (`AGENTS.md` aturan 2).

### Decision

Pemilih Pratinjau per akun terpilih adalah dropdown shadcn `Select` dengan ikon platform dan handle di tiap opsi. Bukan `Tabs`. Judul panel tetap menampilkan platform dan format akun aktif. Baseline diselaraskan di KSP-05-F14 dan KSP-D02 (`key-screen-patterns.md`); NP-D11 tidak berubah karena hanya mengatur variant modal.

### Reason

Handle selalu terbaca untuk beberapa akun satu platform, dan tidak ada baris yang membungkus atau menimpa kartu Pratinjau. Perbandingan opsi lengkap ada di T-211.2 (`tickets/v02-publishing-mvp.md`), tidak disalin ke sini.

### Alternatives Considered

- `ToggleGroup` dengan ikon: rekomendasi agen, tidak dipilih.
- `Tabs` satu baris `overflow-x-auto`: tidak dipilih (menggulir horizontal di panel sempit).

### Consequences

- KSP-05-F14 dan KSP-D02 menyebut `Select`; ADR-155 diberi tag amandemen.
- Tidak ada perubahan kode di sesi ini; kode sudah `Select` (T-211.4).
