## Decision ADR-139

### Title

Hosting dan Autentikasi MCP Server: Route Handler Streamable HTTP + OAuth 2.1
Lewat Better Auth, Terikat Satu Workspace

### Status

Accepted (2026-10-26, atas keputusan King Rezi). Terbukti di HTTPS lewat tunnel dengan Claude Code; verifikasi lanjutan di deploy Railway, refresh token, dan klien lain menjadi bagian T-150 sampai T-153 (lihat Amandemen di bawah).

### Date

2026-10-23

### Decision

Semula Proposed sampai spike **T-148** membuktikan alur lengkap. Spike selesai
dan ADR ini **Accepted pada 2026-10-26** (lihat "Amandemen: Proposed → Accepted").

**1. Hosting.** Satu endpoint `apps/web/src/app/api/mcp/route.ts` dengan
transport Streamable HTTP, stateless, di deploy Railway yang sama. Tanpa
service baru. Route Handler hanya mem-parse request, memeriksa token dan
scope, lalu memanggil Application Service (`AGENTS.md` aturan 3). `proxy.ts`
mengecualikan `/api/mcp` dan `/.well-known/*` dengan pola yang sama seperti
`/api/v1` dan webhook; keamanan dipindah ke handler. Validasi header `Origin`
ditambahkan untuk mencegah DNS rebinding. Klien seperti Claude.ai butuh URL
HTTPS publik, jadi pengujian nyata dilakukan di staging.

**2. Library.** SDK resmi `@modelcontextprotocol/sdk`. Alasan: SDK resmi
adalah dasar `mcp-handler` juga, sehingga pembungkus hanya menambah satu
lapisan dependency yang dipelihara pihak lain; auth dan binding workspace
kita sendiri, jadi pembungkus yang menyediakan auth tidak banyak membantu;
kendali penuh atas transport dan tool schema sesuai aturan entry point
tipis. Terbukti di spike T-148: SDK 1.32.1 menyediakan
`WebStandardStreamableHTTPServerTransport` (Web Request/Response) yang
berjalan di Route Handler Next.js 16 (belum diuji di Railway).

**3. Autentikasi.** OAuth 2.1 dengan PKCE dan dynamic client registration lewat **`@better-auth/oauth-provider`** (dengan plugin `jwt`), **bukan** plugin `mcp` bawaan `better-auth`. Hasil spike T-148: plugin `mcp` dibangun di atas `oidc-provider` yang deprecated dan akan dihapus di major berikutnya. `@better-auth/oauth-provider@1.6.33` mensyaratkan `better-auth` `^1.6.33` (naik dari `1.6.23`, patch dalam minor yang sama). Scope kustom di kabel: `mcp:read`, `mcp:draft`, `mcp:schedule` (ditambah `offline_access` untuk refresh); nama logis di ADR-138 tetap `read`, `draft`, `schedule`. Access token berupa JWT yang diverifikasi lewat JWKS (`mcpHandler` dari paket yang sama). Pendaftaran klien dinamis terbuka tanpa login (klien mendaftar sebelum login), sehingga perlu rate limit dan pembersihan klien yang tidak dipakai.

**4. Pengikatan ke workspace.** Alur dua langkah: login, lalu halaman **pilih workspace** (`postLogin`), lalu halaman **consent scope**. Pilihan workspace menjadi `referenceId` pada consent dan diteruskan ke JWT sebagai klaim `workspace_id` lewat `customAccessTokenClaims`. Satu consent berlaku per (klien, pengguna, workspace). Pilihan workspace disimpan di tabel milik kita menurut ID sesi, karena `consentReferenceId` hanya menerima `user`, `session`, dan `scopes`. **Access token JWT stateless**: terbukti tetap diterima sampai kedaluwarsa walau consent dan refresh token sudah dihapus. Karena itu **setiap panggilan** memeriksa di DB: grant (consent untuk klien + pengguna + workspace masih aktif dan tidak dicabut) dan keanggotaan. Pada MVP tidak ada pembatasan scope berdasarkan role: Account Owner, Admin, dan Creator setara untuk read, draft, dan schedule. Pencabutan di aplikasi menghapus atau menandai consent dan refresh token sekaligus. Access token berumur 1 jam dengan refresh token. Apakah `McpGrant` memakai tabel consent plugin atau tabel tipis sendiri diputuskan di T-149.

**5. Pencabutan.** Halaman Settings menampilkan klien AI yang tersambung
beserta tombol cabut (mengisi `revokedAt`).

**6. Rate limit.** Penghitung berbasis Postgres per workspace karena tidak
ada Redis di stack dan penghitung di memori tidak akurat bila instance lebih
dari satu.

**UI baru: rancangan sudah ada di artifact Postific (ADR-140) dan dikonfirmasi King Rezi 2026-10-26 (T-151, T-156, T-157).** Layar
persetujuan OAuth, daftar dan pencabutan klien AI di Settings, badge sumber
MCP di History, Drafts, dan Queue (ADR-138).

### Hasil Spike T-148 (2026-10-23)

Detail dan bukti di [`../reports/T-148-spike-mcp-oauth.md`](../reports/T-148-spike-mcp-oauth.md). Ringkas: pertanyaan 1 (plugin dan scope/`workspaceId`), 3 (transport di Next.js 16), dan 4 (`get_workspace` dengan validasi member) terjawab di harness lokal, termasuk dengan kode OAuth klien bawaan SDK MCP. Pertanyaan 2 (klien nyata ke staging Railway) belum terbukti, jadi status saat itu tetap Proposed. Interaksi plugin `jwt` dengan plugin `dash` di `auth.ts` juga belum diuji. **Diperbarui 2026-10-26:** keduanya sudah diuji (klien nyata lewat tunnel HTTPS; `jwt` dan `dash` aktif bersamaan); lihat Amandemen di bawah.

### Amandemen: Proposed → Accepted (2026-10-26, DITERIMA King Rezi)

> Draf ini diterima King Rezi pada 2026-10-26 dan sudah diterapkan ke `DECISIONS.md`,
> tiket T-148/T-150, `AVAILABLE_TICKETS.md`, dan `PROJECT_STATE.md`.

**Yang terbukti (uji klien nyata, 2026-10-26).** Harness T-148 (commit `e17f2db`,
di balik `MCP_SPIKE_ENABLED`) dijalankan lokal dengan `next start` di belakang
tunnel ngrok HTTPS, database staging, dan Claude Code sungguhan:

- Alur OAuth 2.1 penuh dengan klien nyata: discovery, pendaftaran klien dinamis,
  login, pilih workspace, persetujuan scope, token, panggilan tool.
- Scope kustom `mcp:read`/`mcp:draft`/`mcp:schedule`: token tanpa `mcp:schedule`
  ditolak oleh `schedule_probe`; dengan `mcp:schedule` diterima.
- Binding workspace: `workspace_id` ada di JWT dan `get_workspace` mengembalikan
  workspace yang dipilih.
- Pemeriksaan grant di DB per panggilan: setelah baris `identity_oauth_consent`
  dihapus, access token yang masih berlaku ditolak ("Akses klien ini sudah dicabut").
- Plugin `jwt` dan `dash` aktif bersamaan di `auth.ts` asli (`bearer`, `jwt`,
  `oauth-provider`, `dash`; `dashEnabled: true`), JWKS menjawab 200 lewat URL publik.
- Penyimpanan lewat Prisma ke tabel `identity_jwks`, `identity_oauth_client`,
  `identity_oauth_refresh_token`, `identity_oauth_access_token`, `identity_oauth_consent`.

**Yang belum terbukti (jangan dibaca sebagai terbukti).**

- Perilaku di balik proxy Railway. Uji ini lewat ngrok, bukan deploy staging.
  ADR menyebut "pengujian nyata dilakukan di staging"; poin itu hanya
  terpenuhi sebagian.
- Alur refresh token. Tidak ada refresh token tersimpan di semua percobaan, jadi
  pencabutan refresh token dan perpanjangan akses belum teruji.
- Panggilan setelah member dikeluarkan dari workspace (pemeriksaan member ada di
  kode tetapi jalur penolakannya belum dijalankan oleh klien nyata).
- Klien selain Claude Code (Claude.ai, Cursor). Hanya Claude Code yang diuji.
- Beban, rate limit, dan pembersihan klien dinamis: setiap sambungan menambah satu
  baris `identity_oauth_client` (empat baris dari empat percobaan).

**Koreksi yang ditemukan spike dan harus masuk T-149.**

- Role aplikasi `app_runtime` **tidak** melewati RLS. Tabel OAuth wajib punya
  policy untuk `app_runtime`; tanpanya Better Auth gagal menulis (42501). Migrasi
  `20261026130000_t148_oauth_tables_app_runtime_policy` adalah koreksi spike;
  bentuk final ditentukan T-149.
- Versi: `better-auth` dipatok `~1.6.33` (bukan `^1.6.33`, yang menarik 1.7.x) dan
  `@better-auth/oauth-provider` `1.6.33`, `@modelcontextprotocol/sdk` `1.32.1`.
- Pilihan workspace per sesi di harness disimpan di memori proses; T-149 memindahkannya
  ke tabel.

**Teks status yang berlaku.** Lihat `### Status` di atas.

**Langkah yang diterapkan.**

1. Ubah `### Status` di berkas ini dan baris ADR-139 di `DECISIONS.md`.
2. Tutup T-148 (✅) di `tickets/v05-mcp-server-mvp.md`, hapus dari `AVAILABLE_TICKETS.md`
   (tabel "Sekarang" dan "Keputusan yang masih menunggu"), perbarui Snapshot
   `PROJECT_STATE.md`.
3. T-149 boleh dimulai. Spike (commit `e17f2db`, `3df3fc5`) dibuang atau diganti
   oleh T-149/T-150/T-151.
4. Tambah verifikasi lanjutan ke T-150 (uji di Railway staging) agar tidak hilang.

**Alternatif yang tidak dipilih.** Tetap Proposed sampai harness di-deploy
ke Railway staging dan satu putaran uji ulang lolos. Biayanya push branch, deploy,
dan env staging (butuh persetujuan terpisah), dengan manfaat menutup butir proxy Railway.

### Reason

- Better Auth sudah menjadi identity provider (ADR sebelumnya) dan
  `@better-auth/oauth-provider` menjadikannya authorization server OAuth 2.1
  untuk klien MCP, sehingga tidak perlu auth server terpisah.
- Route Handler di `apps/web` memakai Application Service yang sama dengan
  Server Action, menjaga satu jalur logic.
- Spike lebih dulu karena asumsi terbesar (scope kustom dan `workspaceId`
  di grant) belum terbukti dan menentukan bentuk tiket lain.

### Alternatives Considered

- **`mcp-handler` (Vercel).** Tidak dipilih karena alasan di poin 2; SDK
  resmi terbukti cukup dengan transport web-standard.
- **Plugin `mcp` bawaan `better-auth`.** Ditolak: dibangun di atas
  `oidc-provider` yang deprecated.
- **API token pribadi.** Lebih sederhana tetapi kurang mulus bagi klien
  seperti Claude.ai, dan King Rezi memilih OAuth.
- **MCP lokal (stdio).** Hanya cocok untuk developer, bukan pengguna umum.
- **Satu koneksi untuk semua workspace.** Ditolak: cakupan izin terlalu lebar.
- **Penghitung rate limit di memori atau Redis.** Memori tidak akurat
  multi-instance; Redis menambah infrastruktur baru.

### Related

- Lanjutan ADR-138. Bergantung pada ADR-043 (auth Bearer `/api/v1`) dan
  `product-discovery/05-architecture/auth-architecture.md`.
- Tiket spike: T-148 (`tickets/v05-mcp-server-mvp.md`), hasil di `reports/T-148-spike-mcp-oauth.md`.
