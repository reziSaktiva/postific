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

**Hasil uji klien nyata (2026-10-26, harness lokal di belakang ngrok HTTPS, bukan Railway):** King Rezi menyambungkan Claude Code ke `/api/mcp` dan memberi scope `schedule` di layar persetujuan; `schedule_probe` mengembalikan `{"ok":true,"note":"scope schedule diterima"}`. Itu membuktikan alur OAuth penuh (discovery, pendaftaran klien, login, pilih workspace, persetujuan, token, panggilan tool) dan pemeriksaan member plus grant di DB pada panggilan itu. Terukur AI di sesi yang sama: plugin `bearer`, `jwt`, `oauth-provider`, dan `dash` aktif bersamaan di `auth.ts` asli (`dashEnabled: true`), JWKS 200 dengan satu kunci lewat URL publik, dan klien OAuth tersimpan lewat Prisma. **Putaran kedua (2026-10-26, URL ngrok baru, klien Claude Code):** (a) `get_workspace` mengembalikan `workspaceId`, nama workspace, dan `grantedScopes` dari token; (b) `schedule_probe` dengan token tanpa `mcp:schedule` ditolak ("Scope mcp:schedule tidak diberikan"), dan consent klien itu di DB memang hanya `mcp:read` + `mcp:draft`; (c) setelah baris `identity_oauth_consent` klien itu dihapus, `get_workspace` dengan access token yang masih berlaku ditolak ("Akses klien ini sudah dicabut"), jadi pemeriksaan grant di DB per panggilan terbukti. Hasil (a) menunjukkan `schedule` di `grantedScopes` karena memakai token percobaan pertama, saat King Rezi mencentang `schedule` (cocok dengan consent di DB yang memuat `schedule`); itu bukan kebocoran scope. Catatan: tidak ada refresh token tersimpan (`identity_oauth_refresh_token` kosong untuk semua klien), jadi pencabutan refresh token belum teruji; dan pendaftaran klien dinamis menumpuk satu baris `identity_oauth_client` per sambungan (empat baris dari empat percobaan), sesuai temuan bahwa T-150/T-154 perlu pembersihan dan rate limit. **Belum terbukti:** perilaku di balik proxy Railway, `get_workspace` setelah member dikeluarkan dari workspace, dan alur refresh token. Catatan: migrasi pertama salah (role `app_runtime` tidak bypass RLS, tulis ke `identity_jwks` gagal 42501), dikoreksi migrasi `20261026130000`. T-149 harus memberi policy `app_runtime` pada tabel OAuth final.

### T-149 · Skema dan skeleton domain `mcp-access`

`⏳ Not Started` · **Domain** mcp-access · **ADR** ADR-138, ADR-139, ADR-017, ADR-018, ADR-031 · **Depends** T-148

**Baca dulu:** `05-architecture/domain-model.md` (BC-04) · `05-architecture/database-strategy.md` (BC-04) · `database-orm.md`

Tabel `mcp_grants` dan `mcp_audit_logs`, repository Prisma, `McpAccessService` (`createGrant`, `revokeGrant`, `listGrants`, `authorizeCall`, `recordAudit`, `purgeAudit`). Hapus stub `domains/ai-assistant/`, model `AiRequest`/`AiResult` beserta migrasinya, dan ID terkait di `packages/shared`. **Cek dulu** apakah ada baris di `ai_requests`/`ai_results` di staging sebelum menulis migrasi drop. **Dicek 2026-10-26** (`count(*)` di project staging `ndcrkzqgqukqfmekgoze`, ADR-081): keduanya **0 baris**, jadi migrasi drop aman dari sisi data. Ulangi cek singkat tepat sebelum migrasi dijalankan. Cron purge audit 90 hari sebagai job baru di registry `background-jobs.md` (JOB-08).

### T-150 · Endpoint MCP dan tool baca

`⏳ Not Started` · **Domain** mcp-access · **ADR** ADR-138, ADR-139 · **Depends** T-148, T-149

**Baca dulu:** `05-architecture/application-layer.md` (McpAccessService, pemetaan tool) · `05-architecture/integration-layer.md`

`apps/web/src/app/api/mcp/route.ts` (Streamable HTTP), bypass `proxy.ts` untuk `/api/mcp` dan `/.well-known/*`, validasi `Origin`, `mcpHandler` dari `@better-auth/oauth-provider`, validasi ulang member per panggilan. **Verifikasi lanjutan dari T-148 (ADR-139):** uji OAuth penuh + `get_workspace` + penolakan scope + pencabutan consent di **deploy Railway staging** (proxy Railway belum teruji), alur refresh token dan pencabutannya, member yang dikeluarkan dari workspace, dan klien selain Claude Code (Claude.ai, Cursor). Pembersihan klien dinamis yang tidak dipakai dan rate limit pendaftaran tanpa login (satu baris `identity_oauth_client` per sambungan). Delapan tool `read`: `get_workspace`, `list_accounts`, `list_media`, `list_drafts`, `list_scheduled_posts`, `list_published_posts`, `get_analytics`, `list_comments` (20 item per halaman, cursor). Isi komentar ditandai sebagai data tidak tepercaya. Route Handler tanpa business logic.

### T-151 · Layar persetujuan OAuth (pilih workspace dan scope)

`⏳ Not Started` · **Domain** mcp-access · UI · **ADR** ADR-139, ADR-097 · **Depends** T-148, T-149

**Baca dulu:** `apps/web/.claude/CLAUDE.md` · `.claude/skills/claude-design-scope-discipline/SKILL.md` · ADR-139

Layar tempat pengguna memilih satu workspace dan scope. Default `read` + `draft`; `schedule` harus dicentang sengaja.

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
