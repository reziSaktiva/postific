## Decision ADR-139

### Title

Hosting dan Autentikasi MCP Server: Route Handler Streamable HTTP + OAuth 2.1
Lewat Better Auth, Terikat Satu Workspace

### Status

Proposed

### Date

2026-10-23

### Decision

Status **Proposed** sampai spike **T-148** membuktikan alur lengkap di
staging. Setelah spike, ADR ini diamandemen dan diubah menjadi Accepted
(atau direvisi bila hasil spike menolak asumsi di bawah).

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

**4. Pengikatan ke workspace.** Alur dua langkah: login, lalu halaman **pilih workspace** (`postLogin`), lalu halaman **consent scope**. Pilihan workspace menjadi `referenceId` pada consent dan diteruskan ke JWT sebagai klaim `workspace_id` lewat `customAccessTokenClaims`. Satu consent berlaku per (klien, pengguna, workspace). Pilihan workspace disimpan di tabel milik kita menurut ID sesi, karena `consentReferenceId` hanya menerima `user`, `session`, dan `scopes`. **Access token JWT stateless**: terbukti tetap diterima sampai kedaluwarsa walau consent dan refresh token sudah dihapus. Karena itu **setiap panggilan** memeriksa di DB: grant (consent untuk klien + pengguna + workspace masih aktif dan tidak dicabut), keanggotaan, dan role. Pencabutan di aplikasi menghapus atau menandai consent dan refresh token sekaligus. Access token berumur 1 jam dengan refresh token. Apakah `McpGrant` memakai tabel consent plugin atau tabel tipis sendiri diputuskan di T-149.

**5. Pencabutan.** Halaman Settings menampilkan klien AI yang tersambung
beserta tombol cabut (mengisi `revokedAt`).

**6. Rate limit.** Penghitung berbasis Postgres per workspace karena tidak
ada Redis di stack dan penghitung di memori tidak akurat bila instance lebih
dari satu.

**UI baru (butuh rancangan Claude Design, `AGENTS.md` aturan 10):** layar
persetujuan OAuth, daftar dan pencabutan klien AI di Settings, badge sumber
MCP di History/Draft (ADR-138).

### Hasil Spike T-148 (2026-10-23)

Detail dan bukti di [`../reports/T-148-spike-mcp-oauth.md`](../reports/T-148-spike-mcp-oauth.md). Ringkas: pertanyaan 1 (plugin dan scope/`workspaceId`), 3 (transport di Next.js 16), dan 4 (`get_workspace` dengan validasi member) terjawab di harness lokal, termasuk dengan kode OAuth klien bawaan SDK MCP. Pertanyaan 2 (klien nyata ke staging Railway) belum terbukti, jadi **status tetap Proposed** sampai uji itu lolos. Interaksi plugin `jwt` dengan plugin `dash` di `auth.ts` juga belum diuji.

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
