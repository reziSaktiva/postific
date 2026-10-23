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
tipis. Belum diverifikasi apakah SDK terbaru menyediakan transport berbasis
Web Request/Response yang cocok dengan Next.js 16 (dicek di T-148).

**3. Autentikasi.** OAuth 2.1 dengan PKCE dan dynamic client registration
lewat plugin `mcp` Better Auth (tersedia di `better-auth` 1.6.23, menyediakan
`withMcpAuth` dan endpoint discovery metadata). Belum diverifikasi apakah
plugin ini masih direkomendasikan dibanding `@better-auth/oauth-provider`,
dan apakah mendukung scope kustom (`read`, `draft`, `schedule`) serta data
`workspaceId` pada grant. Keduanya dicek di T-148.

**4. Pengikatan ke workspace.** Token Better Auth bersifat per pengguna
sedangkan workspace dipilih lewat cookie, sehingga token MCP tidak punya
konteks workspace. Dibutuhkan tabel `McpGrant` (`userId`, `clientId`,
`workspaceId`, `scopes`, `revokedAt`) yang dibuat di layar persetujuan:
pengguna memilih **satu workspace** dan scope yang diizinkan. Setiap panggilan
memvalidasi ulang bahwa pengguna masih member workspace itu dan role-nya
mencukupi. Access token berumur pendek (sekitar 1 jam) dengan refresh token.

**5. Pencabutan.** Halaman Settings menampilkan klien AI yang tersambung
beserta tombol cabut (mengisi `revokedAt`).

**6. Rate limit.** Penghitung berbasis Postgres per workspace karena tidak
ada Redis di stack dan penghitung di memori tidak akurat bila instance lebih
dari satu.

**UI baru (butuh rancangan Claude Design, `AGENTS.md` aturan 10):** layar
persetujuan OAuth, daftar dan pencabutan klien AI di Settings, badge sumber
MCP di History/Draft (ADR-138).

### Reason

- Better Auth sudah menjadi identity provider (ADR sebelumnya) dan sudah
  membawa plugin MCP, sehingga tidak perlu auth server terpisah.
- Route Handler di `apps/web` memakai Application Service yang sama dengan
  Server Action, menjaga satu jalur logic.
- Spike lebih dulu karena asumsi terbesar (scope kustom dan `workspaceId`
  di grant) belum terbukti dan menentukan bentuk tiket lain.

### Alternatives Considered

- **`mcp-handler` (Vercel).** Ditunda ke spike untuk dibandingkan; saat ini
  tidak dipilih karena alasan di poin 2.
- **API token pribadi.** Lebih sederhana tetapi kurang mulus bagi klien
  seperti Claude.ai, dan King Rezi memilih OAuth.
- **MCP lokal (stdio).** Hanya cocok untuk developer, bukan pengguna umum.
- **Satu koneksi untuk semua workspace.** Ditolak: cakupan izin terlalu lebar.
- **Penghitung rate limit di memori atau Redis.** Memori tidak akurat
  multi-instance; Redis menambah infrastruktur baru.

### Related

- Lanjutan ADR-138. Bergantung pada ADR-043 (auth Bearer `/api/v1`) dan
  `product-discovery/05-architecture/auth-architecture.md`.
- Tiket spike: T-148 (`tickets/v05-mcp-server-mvp.md`).
