## Decision ADR-141

### Title

RLS Tabel BC-04 MCP Access: Pengecualian DB-D05 (Policy `app_runtime` Tanpa Isolasi Per-Workspace/Pengguna di Level DB)

### Status

Accepted

### Date

2026-10-26

### Decision

Keputusan **King Rezi, dikonfirmasi lewat `AskUserQuestion` pada 2026-10-26** (subtask T-149.1, `tickets/v05-mcp-server-mvp.md`).

Tabel BC-04 `mcp_grants` dan `mcp_audit_logs` memakai RLS aktif dengan satu policy per tabel, **tanpa** isolasi per-workspace atau per-pengguna di level database:

1. `ENABLE ROW LEVEL SECURITY` pada kedua tabel.
2. Satu policy per tabel `FOR ALL TO "app_runtime" USING (true) WITH CHECK (true)`, dijaga `IF EXISTS` pada `pg_roles` (shadow DB tidak punya role itu), dengan bentuk sama seperti migrasi `20261026130000_t148_oauth_tables_app_runtime_policy`.
3. Role lain (`anon`, `authenticated`: jalur PostgREST dan Realtime) tidak punya policy, jadi tertolak (default-deny).
4. Role `app_runtime` **tidak** melewati RLS (tidak punya `BYPASSRLS`): tabel dengan RLS aktif tanpa policy untuk role itu menolak semua tulis (kesalahan `42501`, terbukti pada migrasi T-148 pertama). Karena itu policy `app_runtime` **wajib satu migrasi** dengan `ENABLE ROW LEVEL SECURITY`.
5. Isolasi antar workspace dan antar pengguna sepenuhnya di **application layer**: `McpAccessService.authorizeCall` (grant aktif, scope, member aktif) dan filter `workspace_id`/`user_id` di setiap query repository `IMcpAccessRepository`; `listGrants` hanya mengembalikan milik pengguna yang sedang login.

**Mengapa pola DB-D05 tidak langsung berlaku.** DB-D05 (ADR-015) memakai `app.current_user_id` yang di-set `withCurrentUser` dari sesi Better Auth sebagai safety net. Jalur BC-04 tidak punya konteks itu: pemanggil tool memakai token OAuth (JWT bearer, bukan sesi), pembuatan grant berjalan di hook consent plugin OAuth, dan purge audit (JOB-08) berjalan tanpa pengguna.

### Reason

- Pemanggil memakai token OAuth tanpa `app.current_user_id`, dan jalur sistem (purge JOB-08, hook consent) tidak punya pengguna, sehingga policy per `user_id` tidak punya variabel untuk dibandingkan.
- Tabel ini hanya dibaca dan ditulis lewat service; tidak ada jalur akses langsung dari klien.
- Preseden yang sama sudah berlaku: tabel plugin OAuth T-148 (migrasi `20261026130000`) dan tabel infrastruktur server-only `background_jobs` dan `outstand_webhook_events` (tanpa RLS sama sekali).
- RLS tetap aktif menutup akses dari role selain `app_runtime`, sehingga tabel tidak terbaca lewat anon key.

### Alternatives Considered

- **Policy per `user_id` lewat `withCurrentUser(sub)` dari klaim token.** Mempertahankan safety net per-pengguna, tetapi purge dan hook consent butuh fungsi `SECURITY DEFINER` (pola ADR-099), setiap pemanggil harus men-set variabel itu, dan ada kerja serta risiko tambahan. Safety net per-pengguna tidak sebanding untuk tabel yang hanya dibaca lewat service. **Ditolak.**
- **Tanpa RLS sama sekali** (seperti `background_jobs`). Ditolak: tabel `mcp_*` berisi data per-pengguna (grant, audit), jadi default-deny untuk `anon`/`authenticated` tetap diinginkan.

### Consequences

- Safety net DB-D05 **tidak berlaku** untuk `mcp_grants` dan `mcp_audit_logs`. Bug di filter repository bisa membocorkan data lintas workspace atau pengguna tanpa lapisan kedua; karena itu tes unit isolasi workspace dan pengguna di T-149.5 wajib.
- Migrasi T-149.3 harus memuat `ENABLE ROW LEVEL SECURITY` dan policy `app_runtime` dalam satu berkas, dan SQL ditunjukkan ke King Rezi sebelum `db:deploy` ke staging.
- Komentar migrasi `20261026120000` (klaim bahwa koneksi owner melewati RLS) salah dan tidak boleh disalin.

### Related

- Pengecualian atas DB-D05 (ADR-015, `product-discovery/05-architecture/database-strategy.md`). ADR-015 tidak diubah.
- Lanjutan ADR-138 (pivot MCP) dan ADR-139 (hosting dan auth MCP; poin 4, model grant `mcp_grants` sebagai sumber otorisasi). ADR-138 dan ADR-139 tidak diamandemen.
- Preseden: migrasi `20261026130000` (T-148); ADR-099 (`SECURITY DEFINER`, alternatif yang ditolak).
- Tiket: T-149 (T-149.1, T-149.3, T-149.5, T-149.6).
