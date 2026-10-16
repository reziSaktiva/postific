## Decision ADR-014

### Title

Database Schema Organization — Single Schema dengan Domain Prefix

### Status

Accepted — Amended by ADR-027 (2026-07-15)

### Date

2026-07-15

### Decision

Semua tabel database berada di satu schema `public` PostgreSQL. Domain dipisahkan menggunakan **prefix pada nama tabel** dengan konvensi `{domain_prefix}_{entity_plural}` dalam `snake_case`.

Contoh: `publishing_posts`, `workspace_members`, `engagement_inbox_items`.

### Reason

- Single schema adalah standar dan default di Supabase — tidak ada konfigurasi tambahan yang diperlukan.
- RLS policies lebih straightforward tanpa perlu mengurus `search_path` lintas schema.
- Domain prefix cukup untuk memberikan konteks dan mengelompokkan tabel secara visual di tooling database.
- Lebih sederhana untuk MVP tanpa kehilangan kemampuan track domain boundary.

### Alternatives Considered

- Per-domain PostgreSQL schema (`publishing.posts`, `workspace.members`) — isolasi lebih bersih di level database, tapi butuh konfigurasi `search_path`, RLS lebih kompleks, dan tidak ada kebutuhan nyata untuk level isolasi ini di MVP.

---
