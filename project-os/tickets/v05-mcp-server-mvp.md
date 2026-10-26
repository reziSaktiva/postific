# v0.5 — MCP Server MVP

> Bagian dari backlog berjenjang. Antrian: [`../AVAILABLE_TICKETS.md`](../AVAILABLE_TICKETS.md). Tiket selesai tetap di file ini. Deskripsi baru: ADR-131. Nama folder: ADR-132.
>
> **Pivot (2026-10-23, ADR-138):** rilis ini semula "AI Assistant MVP" (T-060–T-065). Postific tidak membangun AI sendiri; AI milik pengguna bekerja di dalam produk lewat MCP. Tiket lama dibatalkan dan digantikan T-148 dan seterusnya.

**Tujuan rilis:** Memungkinkan pengguna bekerja di Postific melalui AI pilihannya sendiri.
**Baseline rilis:** `product-discovery/02-product/release-roadmap.md` → v0.5 · ADR-138 (arah, scope, tool) · ADR-139 (hosting, auth; Proposed sampai T-148 selesai)

**Kedalaman dokumen ini:** task-level saja (rolling wave). Subtask dirinci setelah spike T-148 selesai dan ADR-139 menjadi Accepted. Spec rilis ini: [`../specs/S-001.md`](../specs/S-001.md).

**Titik awal:** domain `ai-assistant/` hanya stub kosong dan model `AiRequest`/`AiResult` ada di schema tanpa pemakai. Keduanya dihapus di T-149. `better-auth` 1.6.23 membawa plugin `mcp` yang dibangun di atas `oidc-provider` (deprecated), jadi tidak dipakai. Gantinya `@better-auth/oauth-provider` (butuh `better-auth` `^1.6.33`) dan `@modelcontextprotocol/sdk`, keduanya belum terpasang (ADR-139, hasil spike T-148).

**Aturan UI (`AGENTS.md` aturan 10):** T-151, T-156, dan T-157 menyentuh layar yang terlihat pengguna. Sebelum menulis kode UI, cek artifact desain Postific (ADR-140). Ketiganya sudah punya rancangan yang dikonfirmasi King Rezi 2026-10-26 (lihat gate di tiap tiket); untuk layar baru yang belum ada rancangannya, berhenti dan beri tahu King Rezi.

**Di luar rilis ini (ADR-138):** `publish` (Publish Now) dan `reply` (balas komentar) lewat MCP ditunda. Aksi destruktif dan administratif tidak diekspos. AI bawaan Postific dicabut.

---

### T-148 · Spike: OAuth + scope kustom + binding workspace + transport MCP

`🟡 In Progress` · **Domain** mcp-access · **ADR** ADR-138, ADR-139 · **Depends** —

**Baca dulu:** `05-architecture/auth-architecture.md` · `06-engineering/dependency-strategy.md` · ADR-139

Buktikan satu alur lengkap di staging, bukan membangun fitur. Hasilnya menjawab: (1) apakah plugin `mcp` Better Auth masih direkomendasikan dan mendukung scope kustom (`read`, `draft`, `schedule`) serta data `workspaceId` pada grant; (2) apakah klien MCP nyata (Claude.ai atau Claude Code) bisa menyelesaikan OAuth ke staging; (3) apakah transport SDK resmi berjalan di Route Handler Next.js 16 di Railway; (4) apakah satu tool `get_workspace` mengembalikan data dengan validasi member. Selesai dengan ADR-139 diamandemen menjadi Accepted atau direvisi.

**Hasil (2026-10-23):** pertanyaan 1, 3, dan 4 terjawab di harness lokal, dan pertanyaan 2 terbukti sebagian dengan kode OAuth klien bawaan SDK MCP. Detail di `reports/T-148-spike-mcp-oauth.md`; ADR-139 sudah diperbarui (plugin `mcp` ditolak, pakai `@better-auth/oauth-provider`). **Sisa untuk menutup tiket:** uji Claude.ai atau Claude Code sungguhan ke URL HTTPS staging, dan uji interaksi plugin `jwt` dengan `dash` di `auth.ts`. Setelah itu ADR-139 menjadi Accepted atas keputusan King Rezi.

### T-149 · Skema dan skeleton domain `mcp-access`

`⏳ Not Started` · **Domain** mcp-access · **ADR** ADR-138, ADR-139, ADR-017, ADR-018, ADR-031 · **Depends** T-148

**Baca dulu:** `05-architecture/domain-model.md` (BC-04) · `05-architecture/database-strategy.md` (BC-04) · `database-orm.md`

Tabel `mcp_grants` dan `mcp_audit_logs`, repository Prisma, `McpAccessService` (`createGrant`, `revokeGrant`, `listGrants`, `authorizeCall`, `recordAudit`, `purgeAudit`). Hapus stub `domains/ai-assistant/`, model `AiRequest`/`AiResult` beserta migrasinya, dan ID terkait di `packages/shared`. **Cek dulu** apakah ada baris di `ai_requests`/`ai_results` di staging sebelum menulis migrasi drop. Cron purge audit 90 hari.

### T-150 · Endpoint MCP dan tool baca

`⏳ Not Started` · **Domain** mcp-access · **ADR** ADR-138, ADR-139 · **Depends** T-148, T-149

**Baca dulu:** `05-architecture/application-layer.md` (McpAccessService, pemetaan tool) · `05-architecture/integration-layer.md`

`apps/web/src/app/api/mcp/route.ts` (Streamable HTTP), bypass `proxy.ts` untuk `/api/mcp` dan `/.well-known/*`, validasi `Origin`, `mcpHandler` dari `@better-auth/oauth-provider`, validasi ulang member dan role per panggilan. Delapan tool `read`: `get_workspace`, `list_accounts`, `list_media`, `list_drafts`, `list_scheduled_posts`, `list_published_posts`, `get_analytics`, `list_comments` (20 item per halaman, cursor). Isi komentar ditandai sebagai data tidak tepercaya. Route Handler tanpa business logic.

### T-151 · Layar persetujuan OAuth (pilih workspace dan scope)

`⏳ Not Started` · **Domain** mcp-access · UI · **ADR** ADR-139, ADR-097 · **Depends** T-148, T-149

**Baca dulu:** `apps/web/.claude/CLAUDE.md` · `.claude/skills/claude-design-scope-discipline/SKILL.md` · ADR-139

Layar tempat pengguna memilih satu workspace dan scope. Default `read` + `draft`; `schedule` harus dicentang sengaja.

**Gate Claude Design:** rancangan **sudah ada** di artifact Postific (https://claude.ai/artifact/FdRNU4gnxgAGY3zmBxNfR3), `components/ScreenOauthConsent/preview.html`; **dikonfirmasi King Rezi 2026-10-26** setelah ditinjau lewat galeri review (https://claude.ai/artifact/4BJCWNsCwubLd7SFwRtree). Pola di `product-discovery/04-ux/key-screen-patterns.md` § KSP-09. Keputusan yang sudah dikunci: (1) **dua langkah berurutan**, pilih workspace (`/select-workspace`) lalu persetujuan scope (`/consent`), sesuai hasil spike T-148; (2) scope yang tidak diizinkan role di workspace terpilih **tampil nonaktif beserta alasan**; (3) nama dan host klien selalu tampil karena semua klien mendaftar sendiri; (4) state: normal, tanpa workspace, scope dibatasi role, klien tanpa nama atau host tidak lazim, error, loading. `publish` dan `reply` tidak ditampilkan. Pemilih workspace memakai daftar radio (`RadioGroup`) dan scope memakai checkbox; belum dikunci King Rezi, tanyakan bila ragu sebelum menulis kode (`AGENTS.md` aturan 10).

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
