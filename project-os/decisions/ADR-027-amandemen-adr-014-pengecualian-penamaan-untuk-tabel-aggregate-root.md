## Decision ADR-027

### Title

Amandemen ADR-014 — Pengecualian Penamaan untuk Tabel Aggregate Root

### Status

Accepted

### Date

2026-07-15

### Decision

Menambahkan pengecualian pada konvensi penamaan tabel yang ditetapkan di ADR-014.

Konvensi dasar tetap `{domain_prefix}_{entity_plural}` (`snake_case`). **Pengecualian:** tabel utama (aggregate root) sebuah domain yang namanya identik dengan domain prefix boleh menggunakan nama pendek tanpa prefix untuk menghindari redundansi.

Tabel yang menggunakan pengecualian ini:

- `workspace_workspaces` → **`workspaces`**
- `notification_notifications` → **`notifications`**

Tabel lain tetap mengikuti konvensi berprefix (`workspace_members`, `publishing_posts`, `engagement_inbox_items`, dll.).

### Reason

- Nama seperti `workspace_workspaces` dan `notification_notifications` bersifat redundan dan mengurangi keterbacaan tanpa memberi nilai tambah.
- Pengecualian hanya berlaku untuk aggregate root yang namanya sama dengan domain — kasus yang jarang dan tidak menimbulkan ambiguitas.
- Selaras dengan perubahan yang sudah diterapkan pada `database-strategy.md` dan `realtime-strategy.md` (sesi ke-29).

### Alternatives Considered

- Mempertahankan konvensi ketat tanpa pengecualian (semua tabel berprefix) — konsisten secara mekanis, tapi menghasilkan nama redundan yang tidak nyaman dibaca.

---
