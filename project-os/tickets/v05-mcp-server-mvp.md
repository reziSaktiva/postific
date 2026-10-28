# v0.5 — MCP Server MVP

> Bagian dari backlog berjenjang. Antrian: [`../AVAILABLE_TICKETS.md`](../AVAILABLE_TICKETS.md). Tiket selesai tetap di file ini. Deskripsi baru: ADR-131. Nama folder: ADR-132.
>
> **Pivot (2026-10-23, ADR-138):** rilis ini semula "AI Assistant MVP" (T-060–T-065). Postific tidak membangun AI sendiri; AI milik pengguna bekerja di dalam produk lewat MCP. Tiket lama dibatalkan dan digantikan T-148 dan seterusnya.

**Tujuan rilis:** Memungkinkan pengguna bekerja di Postific melalui AI pilihannya sendiri.
**Baseline rilis:** `product-discovery/02-product/release-roadmap.md` → v0.5 · ADR-138 (arah, scope, tool) · ADR-139 (hosting, auth; Accepted 2026-10-26)

**Kedalaman dokumen ini:** task-level saja (rolling wave). Spike T-148 selesai dan ADR-139 Accepted (2026-10-26); subtask dirinci saat tiketnya dikerjakan. Spec rilis ini: [`../specs/S-001.md`](../specs/S-001.md).

**Titik awal:** domain `ai-assistant/` hanya stub kosong dan model `AiRequest`/`AiResult` ada di schema tanpa pemakai. Keduanya dihapus di T-149. `better-auth` 1.6.23 membawa plugin `mcp` yang dibangun di atas `oidc-provider` (deprecated), jadi tidak dipakai. Gantinya `@better-auth/oauth-provider` (butuh `better-auth` `^1.6.33`) dan `@modelcontextprotocol/sdk`, keduanya belum terpasang (ADR-139, hasil spike T-148).

**Aturan UI (`AGENTS.md` aturan 10):** T-151, T-156, dan T-157 menyentuh layar yang terlihat pengguna. Sebelum menulis kode UI, cek artifact desain Postific (ADR-140). Ketiganya sudah punya rancangan yang dikonfirmasi King Rezi 2026-10-26 (lihat gate di tiap tiket); untuk layar baru yang belum ada rancangannya, berhenti dan beri tahu King Rezi.

**Di luar rilis ini (ADR-138):** `publish` (Publish Now) dan `reply` (balas komentar) lewat MCP ditunda. Aksi destruktif dan administratif tidak diekspos. AI bawaan Postific dicabut.

---

### T-148 · Spike: OAuth + scope kustom + binding workspace + transport MCP

`✅ Done (2026-10-26)` · **Domain** mcp-access · **ADR** ADR-138, ADR-139 · **Depends** —

**Baca dulu:** `05-architecture/auth-architecture.md` · `06-engineering/dependency-strategy.md` · ADR-139

Buktikan satu alur lengkap di staging, bukan membangun fitur. Hasilnya menjawab: (1) apakah plugin `mcp` Better Auth masih direkomendasikan dan mendukung scope kustom (`read`, `draft`, `schedule`) serta data `workspaceId` pada grant; (2) apakah klien MCP nyata (Claude.ai atau Claude Code) bisa menyelesaikan OAuth ke staging; (3) apakah transport SDK resmi berjalan di Route Handler Next.js 16 di Railway; (4) apakah satu tool `get_workspace` mengembalikan data dengan validasi member. Selesai dengan ADR-139 diamandemen menjadi Accepted atau direvisi.

**Hasil (2026-10-23):** pertanyaan 1, 3, dan 4 terjawab di harness lokal, dan pertanyaan 2 terbukti sebagian dengan kode OAuth klien bawaan SDK MCP. Detail di `reports/T-148-spike-mcp-oauth.md`; ADR-139 sudah diperbarui (plugin `mcp` ditolak, pakai `@better-auth/oauth-provider`). **Sisa untuk menutup tiket:** uji Claude.ai atau Claude Code sungguhan ke URL HTTPS staging, dan uji interaksi plugin `jwt` dengan `dash` di `auth.ts`. Setelah itu ADR-139 menjadi Accepted atas keputusan King Rezi (**2026-10-26**; tiket ditutup dengan batas bukti di ADR-139 § Amandemen).

**Hasil uji klien nyata (2026-10-26, harness lokal di belakang ngrok HTTPS, bukan Railway):** King Rezi menyambungkan Claude Code ke `/api/mcp` dan memberi scope `schedule` di layar persetujuan; `schedule_probe` mengembalikan `{"ok":true,"note":"scope schedule diterima"}`. Itu membuktikan alur OAuth penuh (discovery, pendaftaran klien, login, pilih workspace, persetujuan, token, panggilan tool) dan pemeriksaan member plus grant di DB pada panggilan itu. Terukur AI di sesi yang sama: plugin `bearer`, `jwt`, `oauth-provider`, dan `dash` aktif bersamaan di `auth.ts` asli (`dashEnabled: true`), JWKS 200 dengan satu kunci lewat URL publik, dan klien OAuth tersimpan lewat Prisma. **Putaran kedua (2026-10-26, URL ngrok baru, klien Claude Code):** (a) `get_workspace` mengembalikan `workspaceId`, nama workspace, dan `grantedScopes` dari token; (b) `schedule_probe` dengan token tanpa `mcp:schedule` ditolak ("Scope mcp:schedule tidak diberikan"), dan consent klien itu di DB memang hanya `mcp:read` + `mcp:draft`; (c) setelah baris `identity_oauth_consent` klien itu dihapus, `get_workspace` dengan access token yang masih berlaku ditolak ("Akses klien ini sudah dicabut"), jadi pemeriksaan grant di DB per panggilan terbukti. Hasil (a) menunjukkan `schedule` di `grantedScopes` karena memakai token percobaan pertama, saat King Rezi mencentang `schedule` (cocok dengan consent di DB yang memuat `schedule`); itu bukan kebocoran scope. Catatan: tidak ada refresh token tersimpan (`identity_oauth_refresh_token` kosong untuk semua klien), jadi pencabutan refresh token belum teruji (penyebabnya layar persetujuan harness membuang `offline_access`; diperbaiki di code review PR 199, belum diuji ulang); dan pendaftaran klien dinamis menumpuk satu baris `identity_oauth_client` per sambungan (empat baris dari empat percobaan), sesuai temuan bahwa T-150/T-154 perlu pembersihan dan rate limit. **Belum terbukti:** perilaku di balik proxy Railway, `get_workspace` setelah member dikeluarkan dari workspace, dan alur refresh token. Catatan: migrasi pertama salah (role `app_runtime` tidak bypass RLS, tulis ke `identity_jwks` gagal 42501), dikoreksi migrasi `20261026130000`. T-149 harus memberi policy `app_runtime` pada tabel OAuth final.

### T-149 · Skema dan skeleton domain `mcp-access`

`✅ Done (2026-10-26)` · **Domain** mcp-access · **ADR** ADR-138, ADR-139, ADR-141, ADR-017, ADR-018, ADR-031 · **Depends** T-148

**Catatan penutupan (jujur, 2026-10-26):** migrasi diterapkan ke staging dan strukturnya terverifikasi lewat query; `typecheck`, `lint`, `test` (1085 lulus), `build` hijau; review Ridwan lolos. **Belum terverifikasi di Postgres sungguhan:** (1) uji tulis sebagai role `app_runtime` di staging (upsert `ON CONFLICT` pada indeks unik parsial, purge, penolakan `anon`) ditolak saat dijalankan, jadi SQL mentah repository (`upsertActive`, `deleteOlderThan`, transaksi `revokeAtomically`) hanya diuji dengan Prisma/`$queryRaw` palsu; (2) JOB-08 belum dijalankan di staging (cron atau `?type=mcp-audit-purge`); (3) tidak ada tes sambungan `getMcpAccessService()` dengan `WorkspaceService.getMembership`. Ketiganya dibawa ke T-150 (bagian "Verifikasi lanjutan dari T-149").

**Baca dulu:** `05-architecture/domain-model.md` (BC-04) · `05-architecture/database-strategy.md` (BC-04) · `database-orm.md`

Tabel `mcp_grants` dan `mcp_audit_logs`, repository Prisma, `McpAccessService` (`createGrant`, `revokeGrant`, `listGrants`, `authorizeCall`, `recordAudit`, `purgeAudit`). Hapus stub `domains/ai-assistant/`, model `AiRequest`/`AiResult` beserta migrasinya, dan ID terkait di `packages/shared`. **Cek dulu** apakah ada baris di `ai_requests`/`ai_results` di staging sebelum menulis migrasi drop. **Dicek 2026-10-26** (`count(*)` di project staging `ndcrkzqgqukqfmekgoze`, ADR-081): keduanya **0 baris**, jadi migrasi drop aman dari sisi data. Ulangi cek singkat tepat sebelum migrasi dijalankan. Cron purge audit 90 hari sebagai job baru di registry `background-jobs.md` (JOB-08).

**Keputusan King Rezi (2026-10-26): model grant.** Tabel tipis `mcp_grants` menjadi **sumber otorisasi** (`revoked_at`, `last_used_at`). Pencabutan menandai grant **dan** menghapus baris `identity_oauth_consent` serta `identity_oauth_refresh_token` milik (klien, pengguna, workspace) itu dalam **satu transaksi**. Tabel plugin tetap milik plugin dan tidak diubah bentuknya di tiket ini (tanpa FK baru; nama `identity_oauth_*`, bukan prefiks `mcp_`).

**Mulai setelah PR 199 merge ke `staging`.** Cabang kerja dibuat dari `staging` terbaru, bukan ditumpuk di cabang PR 199. Dikerjakan di cabang `feature/t149-mcp-access-skeleton`.

**Subtask** (urutan: .1 dan .2 boleh paralel; .3 menunggu keduanya; .4 dan .5 setelah .3; .6 setelah .5; .7 setelah .5; .8 terakhir)

- [x] **T-149.1** Dokumen dulu (`AGENTS.md` aturan 14). Koreksi `database-strategy.md` BC-04: `user_id` bertipe **text** (cuid `identity_user.id`), bukan `uuid` seperti tertulis; tambah `last_used_at`, `client_name` (salinan nama klien saat persetujuan, supaya layar T-156 tidak membaca tabel plugin), dan indeks unik parsial `(user_id, client_id, workspace_id) WHERE revoked_at IS NULL`; samakan `domain-model.md` BC-04. Tetapkan kebijakan RLS: aplikasi memanggil dari token (tanpa `app.current_user_id`), jadi pola isolasi per-workspace `DB-D05` tidak langsung berlaku; usulan RLS aktif dengan policy untuk `app_runtime` saja (seperti tabel OAuth T-148). Bila menyimpang dari DB-D05, buka ADR baru lewat King Rezi. **Jangan menyalin komentar migrasi `20261026120000`** (klaim bahwa Prisma/koneksi owner melewati RLS salah; `app_runtime` tidak bypass, koreksinya di migrasi `20261026130000`). Juga: scope diperiksa terhadap token **dan** consent/grant di DB per panggilan, bukan hanya token. Pemilik: Elon
  - **Hasil (2026-10-26):** tipe final `workspace_id` uuid, `user_id` text, `client_name`, `last_used_at`, indeks unik parsial `(user_id, client_id, workspace_id) WHERE revoked_at IS NULL`; RLS final lewat ADR-141 (Accepted, keputusan King Rezi 2026-10-26; pengecualian DB-D05: satu policy `app_runtime` per tabel, isolasi di application layer). `database-strategy.md` dan `domain-model.md` BC-04 sudah disamakan.
- [x] **T-149.2** Mini-spike titik kait pembuatan grant. Plugin `oauth-provider` tidak punya hook `onConsent`. Pilihan: (A) plugin Better Auth kecil dengan `hooks.after` pada `/oauth2/consent` (usulan), (B) Server Action dipanggil sebelum consent, (C) lazy saat token terbit. Buktikan lewat harness (flag `MCP_SPIKE_ENABLED`): scope grant sama dengan scope consent, `workspace_id` sama dengan `referenceId`, dan bila grant gagal dibuat panggilan tetap ditolak (fail closed). Catat pilihan di tiket ini. Pemilik: Elon
  - **Pilihan dan bukti (2026-10-26):** dipilih opsi (A): plugin Better Auth kecil dengan `hooks.after` pada `/oauth2/consent`. Plugin `oauth-provider` 1.6.33 tidak punya `onConsent`; hook membaca baris consent yang baru ditulis, `client_id` dari `getOAuthProviderState()`, dan `referenceId` dari `consentReferenceId`. Opsi (B) tidak terikat ke consent yang sebenarnya (`/oauth2/consent` bisa dipanggil langsung dengan subset scope lain); opsi (C) tidak punya `clientId` di `customAccessTokenClaims`, dan callback itu juga jalan pada refresh dan introspeksi.
  - **Terbukti** lewat tes Vitest terhadap Better Auth asli di adapter memori, bukan klien nyata (`apps/web/src/lib/better-auth/mcp-spike-grant-hook.test.ts`, 10 tes): scope grant sama dengan scope consent (hanya `mcp:*`); `workspace_id` grant sama dengan `referenceId` dan klaim JWT; bila grant gagal dibuat, consent mengembalikan error tanpa kode otorisasi, baris consent dikompensasi (dihapus), dan gerbang per panggilan menolak karena grant diperiksa di store, bukan di token.
  - **Syarat untuk T-149.5/.6:** (1) kompensasi wajib: authorize melompati layar consent bila consent sudah ada, jadi kegagalan grant tanpa kompensasi membuat klien macet permanen; (2) `/oauth2/delete-consent` harus mencabut grant lebih dulu; (3) `/oauth2/update-consent` harus ditolak (bisa melebarkan scope tanpa layar persetujuan); (4) `authorizeCall` memakai grant sebagai sumber otorisasi; (5) sediakan operasi "pastikan grant dari consent" yang bisa dipanggil saat pengguna menyambung ulang.
  - **Belum terbukti:** klien nyata, proxy Railway atau multi-instance, refresh token, atomisitas consent+grant, serta konflik pencabutan dan re-consent bersamaan. `/oauth2/delete-client` tidak mencabut grant (masuk pembersihan T-150/T-154).
  - **Catatan harness:** gerbang `authorize()` di harness spike sekarang memeriksa store grant memori, bukan baris `identity_oauth_consent`, jadi menghapus baris consent langsung di DB tidak lagi memutus akses (sesuai model grant, beda dari bukti T-148 putaran kedua).
- [x] **T-149.3** Skema Prisma dan migrasi additive: `McpGrant`, `McpAuditLog` (`mcp_grants`, `mcp_audit_logs`; indeks `(workspace_id, created_at)` untuk audit dan purge; lihat catatan indeks purge global di bawah), RLS dengan policy `app_runtime` (dijaga `IF EXISTS` seperti migrasi T-148), serta migrasi **drop** `ai_requests`/`ai_results` (hapus policy `ai_requests_workspace_isolation` dan FK; ulangi `count(*)` tepat sebelum). Hapus model `AiRequest`/`AiResult` dari `schema.prisma`. SQL ditunjukkan ke King Rezi **sebelum** `db:deploy` ke staging. Policy `app_runtime` wajib satu migrasi dengan `ENABLE ROW LEVEL SECURITY` (ADR-141). Pemilik: Elon
  - **Keputusan:** purge JOB-08 menghapus per `created_at` lintas workspace, sedangkan `(workspace_id, created_at)` tidak melayani query global itu, jadi ditambah indeks `mcp_audit_logs_created_at_idx` pada `(created_at)` (usulan Elon, disetujui King Rezi).
  - **Hasil (2026-10-26):** migrasi `20261026140000_t149_mcp_access_tables_drop_ai_tables`: create `mcp_grants` dan `mcp_audit_logs` beserta indeks (termasuk unik parsial `mcp_grants_active_user_client_workspace_key WHERE revoked_at IS NULL`), RLS aktif dengan policy `app_runtime` (ADR-141), lalu drop `ai_results` dan `ai_requests` dengan guard `count(*)` (gagal bila tabel berisi). Sebelum deploy `ai_requests` 0 baris dan `ai_results` 0 baris (dicek 2026-10-26 di staging `ndcrkzqgqukqfmekgoze`). King Rezi menyetujui SQL dan meminta `db:deploy`; sukses, tercatat selesai di `_prisma_migrations` (2026-10-26 09:06 UTC). Verifikasi struktur lewat query: RLS aktif di kedua tabel, satu policy `app_runtime ALL true/true` per tabel, indeks parsial dan `(created_at)` ada, `to_regclass('ai_requests')` dan `to_regclass('ai_results')` keduanya NULL. **Tidak terverifikasi:** uji tulis sebagai `app_runtime` (ditolak saat dijalankan); catatan tindak lanjut: `DROP POLICY` di migrasi tanpa `IF EXISTS` (aman sepanjang urutan migrasi dipatuhi). Kolom `scopes` dibuat `TEXT[]` tanpa NOT NULL (keterbatasan Prisma pada list); NOT NULL ditegakkan repository.
- [x] **T-149.4** Skeleton domain `apps/web/src/domains/mcp-access/`: entity `McpGrant`, `McpAuditEntry`, value object `McpScope` (`read | draft | schedule`), error domain, antarmuka repository, dan port keanggotaan workspace (diisi lewat API publik `WorkspaceService`, bukan impor lintas folder). Di `packages/shared`: tambah ID `McpGrantId` dan `McpAuditLogId`, hapus `AIRequestId` dan `AIResultId` (`ids.ts`, tidak ada pemakai lain). Hapus `domains/ai-assistant/` (3 berkas + 4 `.gitkeep`, tidak ada yang mengimpor). Pemilik: Prabowo
  - **Hasil (2026-10-26):** `domains/mcp-access/` berisi entity `McpGrant` dan `McpAuditEntry`, value object `McpScope` dan `audit-summary` (penyamaran), error domain, serta antarmuka `IMcpGrantRepository`, `IMcpAuditRepository`, dan `IMcpGrantRevocationPort`. `packages/shared`: `McpGrantId` dan `McpAuditLogId` ditambah, `AIRequestId` dan `AIResultId` dihapus. `domains/ai-assistant/` dihapus.
- [x] **T-149.5** `McpAccessService`: `createGrant`, `revokeGrant` (transaksi lewat port yang menghapus consent dan refresh token), `listGrants` (hanya milik sendiri), `authorizeCall` (grant aktif, scope token mencakup scope tool dan scope grant, member aktif; `last_used_at` diperbarui paling cepat sekali per menit; titik sambung kosong untuk rate limit T-154, **tidak** diimplementasikan di sini), `recordAudit` (ringkasan disamarkan; caption penuh dan URL berparameter rahasia tidak dicatat), `purgeAudit` (90 hari, konstanta). Tidak memanggil BC-03/05/06/08. Tes unit dengan repository palsu di file tes: grant dicabut, scope kurang, member non-aktif, isolasi workspace, audit tanpa caption penuh. Dari temuan T-149.2: sediakan operasi "pastikan grant dari consent" (idempoten, dipanggil saat pengguna menyambung ulang); penolakan `/oauth2/update-consent` dan pencabutan grant di `/oauth2/delete-consent` ditangani di plugin hook permanen (di T-149.6 atau tiket yang menggantikan harness), bukan di service. Pemilik: Prabowo
  - **Hasil (2026-10-26):** `McpAccessService` dengan `createGrant`, `ensureGrantFromConsent`, `revokeGrant`, `revokeGrantForConnection`, `listGrants`, `authorizeCall`, `recordAudit`, `purgeAudit`; tes unit dengan repository palsu di file tes. Setelah review Ridwan, `recordAudit` memvalidasi `scope` dan `status`, dan pola kunci sensitif penyamaran audit diperluas (URL berskema apa pun disamarkan).
- [x] **T-149.6** Repository Prisma (`lib/repositories/mcp-access/`) dan adapter pencabutan (transaksi Prisma ke `identity_oauth_consent` dan `identity_oauth_refresh_token`), tanpa domain mengimpor Prisma. Verifikasi migrasi di staging lewat query setelah `db:deploy`. Plugin hook permanen (grant dari consent, kompensasi, penolakan `update-consent`, pencabutan di `delete-consent`; syarat T-149.2) masuk di sini atau di tiket yang menggantikan harness. Pemilik: Elon
  - **Hasil (2026-10-26):** repository Prisma di `lib/repositories/mcp-access/`, adapter pencabutan atomik (transaksi), dan factory `getMcpAccessService()` di `lib/mcp-access/get-mcp-access-service.ts`. Filter kolom kunci ditambahkan di `findById(id, userId)`, `touchLastUsed(id, key, usedAt)`, dan `revokeAtomically` setelah review. Plugin hook **permanen tidak dibuat** di T-149: harness `MCP_SPIKE_ENABLED` dan `lib/mcp-spike` masih memakai store grant memori (hook spike `mcp-spike-grant-hook.ts` tetap); hook permanen dan penghapusan harness dibawa ke T-150/T-151. Verifikasi SQL mentah di Postgres: lihat catatan penutupan.
- [x] **T-149.7** JOB-08 `mcp.audit.purge`: handler memanggil `purgeAudit()`, didaftarkan di `api/jobs/run/route.ts`, fan-out harian dengan pola `executeIfDue` dan `?type=` untuk memaksa (seperti analytics dan import), lewat port enqueue di `lib/jobs/`. Tes idempotensi (run kedua tanpa baris kedaluwarsa tidak menghapus). Pemilik: Elon
  - **Hasil (2026-10-26):** handler JOB-08 `mcp.audit.purge`, `EnqueueMcpAuditPurgeUseCase` (`execute` dan `executeIfDue`), port `lib/jobs/mcp-audit-purge-enqueue-port.ts`, `background-job-store.hasJobOfType`, terdaftar di `api/jobs/run/route.ts` dan bisa dipaksa lewat `?type=mcp-audit-purge`. Tes dengan double lokal. **Belum dijalankan di staging** (cron atau `?type=`).
- [x] **T-149.8** Review dan penutup: Ridwan (aturan 3 sampai 5, McpAccessService tidak memanggil BC-03/05/06/08), Najwa (`typecheck`, `lint`, `test`, `build`, migrasi terverifikasi), lalu Gibran memperbarui status tiket, antrian, dan `PROJECT_STATE.md`. Selesai bila stub `ai-assistant` dan tabel AI sudah hilang dan seluruh pemeriksaan hijau.
  - **Hasil (2026-10-26):** Ridwan: lolos, tidak ada pelanggaran aturan 3 sampai 6; 5 temuan LOW: 1 sampai 3 (kode) diperbaiki Prabowo (filter kolom kunci, pola penyamaran audit, validasi `recordAudit`), 4 dan 5 (drift dokumen `database-strategy.md`, `ctx-implementation.md`) diperbaiki Gibran. Najwa: **PASS**, `typecheck` 0 error, `lint` bersih, `bun run test` 100 file lulus/2 skip/0 gagal (1085 tes lulus/7 skip/0 gagal), `next build` sukses, Prettier bersih, `prisma validate` valid; sisa nama AI lama bersih di `apps/` dan `packages/`. Celah tes rendah (dicatat di T-150, tidak diputuskan): `hasJobOfType` tanpa tes langsung; tidak ada tes sambungan `getMcpAccessService()` dengan `WorkspaceService.getMembership`; `DROP POLICY` tanpa `IF EXISTS`.

**Di luar T-149:** endpoint dan tool (T-150), tabel pilihan workspace per sesi yang menggantikan `Map` di memori harness (masuk T-151), penghapusan harness `MCP_SPIKE_ENABLED` dan `lib/mcp-spike` (T-150 dan T-151), rate limit (T-154), pembersihan klien OAuth dari `/oauth2/delete-client` (T-150/T-154), dan perubahan bentuk tabel plugin.

### T-150 · Endpoint MCP dan tool baca

`⏳ Not Started` · **Domain** mcp-access · **ADR** ADR-138, ADR-139 · **Depends** T-148, T-149

**Baca dulu:** `05-architecture/application-layer.md` (McpAccessService, pemetaan tool) · `05-architecture/integration-layer.md`

`apps/web/src/app/api/mcp/route.ts` (Streamable HTTP), bypass `proxy.ts` untuk `/api/mcp` dan `/.well-known/*`, validasi `Origin`, `mcpHandler` dari `@better-auth/oauth-provider`, validasi ulang member per panggilan. **Verifikasi lanjutan dari T-148 (ADR-139):** uji OAuth penuh + `get_workspace` + penolakan scope + pencabutan consent di **deploy Railway staging** (proxy Railway belum teruji), alur refresh token dan pencabutannya, member yang dikeluarkan dari workspace, dan klien selain Claude Code (Claude.ai, Cursor). Pembersihan klien dinamis yang tidak dipakai dan rate limit pendaftaran tanpa login (satu baris `identity_oauth_client` per sambungan). Delapan tool `read`: `get_workspace`, `list_accounts`, `list_media`, `list_drafts`, `list_scheduled_posts`, `list_published_posts`, `get_analytics`, `list_comments` (20 item per halaman, cursor). Isi komentar ditandai sebagai data tidak tepercaya. Route Handler tanpa business logic.

**Verifikasi lanjutan dari T-149 (2026-10-26, belum terverifikasi atau ditunda dari T-149):**

- Uji tulis di Postgres staging sebagai role `app_runtime` (ditolak saat T-149): upsert `ON CONFLICT` pada indeks unik parsial `upsertActive`, `deleteOlderThan` (purge), transaksi `revokeAtomically`, dan penolakan `anon`; SQL mentah repository baru diuji dengan Prisma/`$queryRaw` palsu. Jalankan JOB-08 di staging (cron atau `?type=mcp-audit-purge`).
- Hook plugin permanen pengganti `lib/better-auth/mcp-spike-grant-hook.ts`: panggil `ensureGrantFromConsent` setelah consent dengan kompensasi, `revokeGrantForConnection` sebelum `/oauth2/delete-consent`, tolak `/oauth2/update-consent`; ambil service lewat `getMcpAccessService()` (`lib/mcp-access/get-mcp-access-service.ts`). Harness `MCP_SPIKE_ENABLED` dan `lib/mcp-spike` masih memakai store grant memori; penghapusannya tetap di T-150/T-151.
- Kontrak handler untuk `recordAudit`: tangkap error FK/DB supaya penolakan tidak menjadi HTTP 500; kegagalan audit tidak boleh mengubah keputusan otorisasi.
- `authorizeCall` memakai scope logis lewat `parseMcpWireScopes`; tanda tangan `findById(id, userId)` dan `touchLastUsed(id, key, usedAt)` berubah setelah review T-149.
- Pembersihan klien OAuth: `/oauth2/delete-client` tidak mencabut grant.
- Catatan tindak lanjut dari QA T-149 (tidak diputuskan di sini): `hasJobOfType` belum punya tes langsung; belum ada tes sambungan `getMcpAccessService()` dengan `WorkspaceService.getMembership`; `DROP POLICY` di migrasi `20261026140000` tanpa `IF EXISTS` (aman sepanjang urutan migrasi dipatuhi).

### T-151 · Layar persetujuan OAuth (pilih workspace dan scope)

`⏳ Not Started` · **Domain** mcp-access · UI · **ADR** ADR-139, ADR-097 · **Depends** T-148, T-149

**Baca dulu:** `apps/web/.claude/CLAUDE.md` · `.claude/skills/claude-design-scope-discipline/SKILL.md` · ADR-139

Layar tempat pengguna memilih satu workspace dan scope. Default `read` + `draft`; `schedule` harus dicentang sengaja. Termasuk tabel pilihan workspace per sesi (menggantikan `Map` di memori harness spike T-148) dan migrasinya.

**Gate Claude Design:** rancangan **sudah ada** di artifact Postific (https://claude.ai/artifact/FdRNU4gnxgAGY3zmBxNfR3), `components/ScreenOauthConsent/preview.html`; **dikonfirmasi King Rezi 2026-10-26** setelah ditinjau lewat galeri review (https://claude.ai/artifact/4BJCWNsCwubLd7SFwRtree). Pola di `product-discovery/04-ux/key-screen-patterns.md` § KSP-09. Keputusan yang sudah dikunci: (1) **dua langkah berurutan**, pilih workspace (`/select-workspace`) lalu persetujuan scope (`/consent`), sesuai hasil spike T-148; (2) pada MVP **tidak ada pembatasan scope berdasarkan role** (Account Owner, Admin, dan Creator setara untuk read, draft, dan schedule), jadi semua scope tampil aktif; (3) nama dan host klien selalu tampil karena semua klien mendaftar sendiri; (4) state: normal, tanpa workspace, klien tanpa nama atau host tidak lazim, error, loading. `publish` dan `reply` tidak ditampilkan. **Pola komponen dikunci King Rezi 2026-10-26:** pemilih workspace memakai `RadioGroup` dengan tiap baris `Item` variant `outline` yang berisi `RadioGroupItem`, nama workspace, role, dan jumlah akun; daftar scope memakai `Checkbox` di `ItemMedia`, mengikuti pola `FacebookPagesPickerDialog`. Bukan `Select`, bukan choice card `FieldLabel`.

### T-152 · Tool draft dan penanda sumber MCP

`⏳ Not Started` · **Domain** mcp-access · publishing · **ADR** ADR-138, ADR-039 · **Depends** T-150

**Baca dulu:** `05-architecture/application-layer.md` · `05-architecture/database-strategy.md`

`create_draft` dan `update_draft` (hanya draft, tidak menyentuh post yang sudah dijadwalkan). Kolom penanda sumber di `publishing_posts` (`created_via`, `created_via_client_id`), diputuskan final di tiket ini.

### T-153 · Tool `schedule_posts` (batch)

`⏳ Not Started` · **Domain** mcp-access · publishing · **ADR** ADR-138, ADR-039, ADR-049 · **Depends** T-152, T-154

**Baca dulu:** `05-architecture/application-layer.md` (`schedulePosts`) · `02-product/mvp-definition.md`

Satu panggilan memuat maksimum 10 konten (konstanta konfigurasi). Target per konten maksimum sejumlah akun terhubung. Waktu diterima sebagai WIB (T-146). Validasi matriks `ContentFormat` dan Safety Check di server. Hasil dilaporkan per item (sebagian berhasil boleh).

### T-154 · Rate limit per workspace (Postgres)

`⏳ Not Started` · **Domain** mcp-access · **ADR** ADR-138 · **Depends** T-150

**Baca dulu:** `05-architecture/background-jobs.md` · `05-architecture/database-strategy.md`

60 panggilan per menit, 30 aksi tulis per jam, 50 konten terjadwal per hari (dihitung per konten, bukan per akun target atau per panggilan; dikonfirmasi King Rezi 2026-10-26). Konfigurasi, bukan angka di kode. Error berisi kapan boleh mencoba lagi.

### T-155 · Tool `upload_media` dari URL (proteksi SSRF)

`⏳ Not Started` · **Domain** mcp-access · media · **ADR** ADR-138 · **Depends** T-152

**Baca dulu:** `05-architecture/integration-layer.md` · `05-architecture/application-layer.md` (`uploadMedia`)

Tiket sendiri karena butuh review keamanan terfokus. Hanya `https`, periksa IP setelah DNS resolve (tolak privat/loopback/link-local), periksa ulang tiap redirect, batas ukuran dan waktu, validasi tipe dari isi file. Simpan lewat alur `uploadMedia` yang ada.

### T-156 · Settings: daftar dan cabut klien AI

`⏳ Not Started` · **Domain** mcp-access · UI · **ADR** ADR-139, ADR-097 · **Depends** T-149, T-151

**Baca dulu:** `04-ux/information-architecture.md` · `apps/web/.claude/CLAUDE.md`

Daftar klien AI yang tersambung dan tombol cabut.

**Gate Claude Design:** rancangan **sudah ada** di artifact Postific (https://claude.ai/artifact/FdRNU4gnxgAGY3zmBxNfR3), kartu `components/ScreenSettingsAiClients/preview.html`; **dikonfirmasi King Rezi 2026-10-26** setelah ditinjau lewat galeri review (https://claude.ai/artifact/4BJCWNsCwubLd7SFwRtree). Lokasi menu **sudah ditetapkan**: Settings → Account → Klien AI (IA-D08, KSP-10). Keputusan yang sudah dikunci: hanya koneksi milik sendiri tanpa kolom pemilik, Owner/Admin tidak melihat koneksi anggota lain (IA-D09); pola baris KSP-08 tanpa header kolom; Cabut membuka dialog Tier 2 (`AlertDialog`, ADR-049); empty state berisi langkah menyambungkan dan URL MCP dengan tombol Salin. Kolom "Terakhir dipakai" bergantung pada keputusan `lastUsedAt` di T-149.

### T-157 · Badge "dibuat lewat MCP" di History, Drafts, dan Queue

`⏳ Not Started` · **Domain** mcp-access · UI · **ADR** ADR-138, ADR-097 · **Depends** T-152

**Baca dulu:** `04-ux/key-screen-patterns.md` · `.claude/skills/claude-design-scope-discipline/SKILL.md`

Badge dan filter berdasarkan `created_via`.

**Gate Claude Design:** rancangan **sudah ada** di artifact Postific (https://claude.ai/artifact/FdRNU4gnxgAGY3zmBxNfR3), `components/McpSourceBadge/preview.html`; **dikonfirmasi King Rezi 2026-10-26** setelah ditinjau lewat galeri review (https://claude.ai/artifact/4BJCWNsCwubLd7SFwRtree). Pola di `product-discovery/04-ux/key-screen-patterns.md` § Pola: Badge dan Filter Sumber MCP. Keputusan yang sudah dikunci: cakupan **History, Drafts, dan Queue**, Calendar tidak diberi badge (IA-D11); badge outline berisi ikon dan nama klien di baris meta; filter sumber Semua / Dibuat manual / Lewat MCP dengan **bawaan Semua**; tampilan default setiap layar tidak berubah selain badge pada item MCP. Filter di Drafts adalah kontrol baru karena Drafts belum punya filter.

---

## Tiket lama yang dibatalkan (ADR-138)

Status `⛔ Dibatalkan` berarti tidak akan dikerjakan dan bukan bagian antrian.

| ID    | Judul lama                            | Pengganti                                        |
| ----- | ------------------------------------- | ------------------------------------------------ |
| T-060 | Tetapkan provider + model AI          | ADR-138, ADR-139 (tanpa provider AI)             |
| T-061 | AI Assistant domain skeleton          | T-149                                            |
| T-062 | Caption generation                    | Dikerjakan AI klien lewat `create_draft` (T-152) |
| T-063 | Caption improvement                   | Dikerjakan AI klien lewat `update_draft` (T-152) |
| T-064 | Tone rewrite / variasi gaya penulisan | Dikerjakan AI klien                              |
| T-065 | Integrasi AI ke Draft Editor          | Tidak diperlukan                                 |

---

## Catatan Rilis

- `publish` dan `reply` lewat MCP menjadi tiket baru (ID berikutnya dari antrian global) bila King Rezi mengaktifkannya.
- **Definition of Done rilis ini:** AI pengguna dapat membaca, menyusun draft, dan menjadwalkan konten di Postific lewat MCP, dengan scope, audit, rate limit, dan pencabutan koneksi.
