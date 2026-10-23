# T-148 · Hasil spike: OAuth + scope kustom + binding workspace + transport MCP

**Tanggal:** 2026-10-23 · **Tiket:** T-148 · **Docs:** ADR-138, ADR-139 · **Spec:** S-001

Spike dijalankan di harness terisolasi (Postgres 16 lokal, tanpa menyentuh DB bersama, tanpa perubahan di `apps/` dan `packages/`). Kode harness tidak disimpan di repo. Konfigurasi yang terbukti ada di bagian "Konfigurasi yang terbukti".

## Jawaban empat pertanyaan

| #   | Pertanyaan                                                                                  | Hasil                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Plugin `mcp` Better Auth: masih direkomendasikan? Mendukung scope kustom dan `workspaceId`? | **Plugin `mcp` jangan dipakai.** Ia dibangun di atas `oidc-provider` yang berstatus deprecated (kode mengaktifkan `__skipDeprecationWarning`), akan dihapus di major berikutnya. Gantinya `@better-auth/oauth-provider`. Paket itu mendukung scope kustom dan mengikat consent ke workspace lewat `postLogin.consentReferenceId`, lalu menaruh `workspace_id` ke JWT lewat `customAccessTokenClaims`. Terbukti jalan. |
| 2   | Klien MCP nyata bisa OAuth ke staging?                                                      | **Sebagian.** Kode OAuth klien bawaan `@modelcontextprotocol/sdk` (pola yang sama dengan Claude Code dan Cursor) lolos penuh ke Next.js 16 lokal: discovery, pendaftaran klien otomatis, PKCE S256, parameter `resource`, token, lalu pemanggilan tool. **Belum diuji:** Claude.ai atau Claude Code sungguhan ke URL HTTPS staging Railway. Itu butuh deploy dan tidak bisa dari sesi ini.                            |
| 3   | Transport SDK berjalan di Route Handler Next.js 16?                                         | **Ya.** SDK 1.32.1 menyediakan `WebStandardStreamableHTTPServerTransport` (Web `Request`/`Response`). Diuji di `next build` + `next start` Next 16.2.10 (Turbopack, Node) dan juga di Bun. Stateless (`sessionIdGenerator: undefined`, `enableJsonResponse: true`) berjalan. **Belum diuji di Railway.**                                                                                                              |
| 4   | `get_workspace` dengan validasi member?                                                     | **Ya.** Tool membaca `workspace_id` dan `sub` dari JWT, memeriksa tabel member di setiap panggilan, dan menolak bila bukan member.                                                                                                                                                                                                                                                                                    |

## Bukti perilaku (semua lolos)

- Discovery: `/.well-known/oauth-authorization-server` mencantumkan scope kustom; `/.well-known/oauth-protected-resource/api/mcp` memberi resource metadata. Tanpa token: HTTP 401 dengan `WWW-Authenticate: Bearer resource_metadata=...`.
- Pendaftaran klien dinamis (DCR) berjalan; scope klien dibatasi oleh `clientRegistrationDefaultScopes` dan `clientRegistrationAllowedScopes`.
- Alur: authorize → halaman pilih workspace (`postLogin`) → `/oauth2/continue` → halaman consent → `/oauth2/consent` → code → token. Baris `oauthConsent` menyimpan `referenceId = workspaceId` dan scope yang diberikan. JWT berisi `workspace_id`, `sub`, `scope`, `aud = URL MCP`, `azp = client id`, `sid`.
- Tool dengan scope tidak diberikan (`schedule_posts` tanpa `mcp:schedule`) ditolak. Member yang dikeluarkan ditolak pada panggilan berikutnya.
- Refresh token yang dicabut lewat `/oauth2/revoke` tidak bisa dipakai lagi.

## Temuan yang mengubah desain

1. **Access token JWT stateless: tetap berlaku sampai kedaluwarsa (1 jam) walau consent dan refresh token sudah dihapus.** Terbukti: setelah `oauthConsent` dan `oauthRefreshToken` dihapus, access token lama masih diterima. Jadi **setiap panggilan wajib memeriksa grant di DB** (consent untuk `clientId` + `userId` + `workspaceId` masih ada dan tidak dicabut), selain memeriksa member dan role. Pencabutan di aplikasi harus menghapus atau menandai consent dan refresh token sekaligus.
2. **Alur pengguna dua langkah, bukan satu layar.** `referenceId` (workspace) harus ditetapkan sebelum consent, jadi urutannya: halaman **pilih workspace** (`postLogin.page`), baru halaman **persetujuan scope** (`consentPage`). Layar T-151 harus dirancang sebagai dua langkah berurutan (atau satu halaman yang menjalankan keduanya berurutan). Pemilihan workspace disimpan di tabel kita sendiri berdasarkan ID sesi, karena `consentReferenceId` hanya menerima `user`, `session`, dan `scopes`, bukan cookie.
3. **Consent sudah per (klien, pengguna, workspace).** Menyambungkan klien yang sama ke workspace lain menghasilkan baris consent baru. Baris `oauthConsent` praktis adalah grant. T-149 perlu memutuskan: `McpGrant` memakai tabel consent plugin atau tabel tipis sendiri untuk `lastUsedAt` dan penanda pencabutan.
4. **Pendaftaran klien dinamis harus terbuka tanpa login** (`allowUnauthenticatedClientRegistration`), karena klien mendaftar sebelum pengguna login. Endpoint itu perlu rate limit dan pembersihan klien yang tidak pernah dipakai (masuk T-150 dan T-154).
5. **Versi paket.** `@better-auth/oauth-provider@1.6.33` mensyaratkan `better-auth` `^1.6.33`; repo di `1.6.23`, jadi `better-auth` dinaikkan ke `^1.6.33` (patch dalam minor yang sama). `@better-auth/infra@0.3.7` mensyaratkan `@better-auth/core >=1.4.0` sehingga tidak bentrok. **Risiko:** `auth.ts` sudah memakai plugin `dash` (infra) dengan catatan soal JWKS self-check. Menambah plugin `jwt` (wajib oleh oauth-provider) harus diuji agar tidak mengganggu itu.
6. **Nama tabel.** Better Auth membuat tabel `oauthClient`, `oauthConsent`, `oauthRefreshToken`, `jwks` (plus tabel token akses bila token opaque). Di repo, tabel identitas memakai prefiks `identity_`; plugin menyediakan opsi `schema` untuk mengganti nama model. Dipetakan di T-149.
7. **Nama scope di kabel** memakai namespace `mcp:read`, `mcp:draft`, `mcp:schedule` (ditambah `openid`/`offline_access` bila perlu refresh). Nama logis di ADR-138 dan S-001 (`read`, `draft`, `schedule`) tetap dipakai di dokumentasi.
8. **Catatan klien.** `authorize` mengembalikan JSON `{redirect, url}` (bukan HTTP 302) bila permintaan datang dari `fetch` dengan header Fetch Metadata. Browser sungguhan mendapat 302. Hanya relevan untuk skrip uji. `typescript@7` tidak kompatibel dengan build Next 16.2.10; repo memakai `^5` jadi tidak terpengaruh.

## Konfigurasi yang terbukti

```ts
jwt({ jwt: { issuer: BASE, audience: MCP_URL } }),
oauthProvider({
  loginPage: "/login",
  consentPage: "/consent",
  scopes: ["openid", "offline_access", "mcp:read", "mcp:draft", "mcp:schedule"],
  validAudiences: [MCP_URL],
  allowDynamicClientRegistration: true,
  allowUnauthenticatedClientRegistration: true,
  clientRegistrationDefaultScopes: ["mcp:read", "mcp:draft"],
  clientRegistrationAllowedScopes: ["mcp:schedule", "offline_access"],
  postLogin: {
    page: "/select-workspace",
    shouldRedirect: ({ session }) => /* belum ada pilihan workspace untuk session.id */,
    consentReferenceId: ({ session }) => /* workspaceId pilihan untuk session.id */,
  },
  customAccessTokenClaims: ({ referenceId }) => ({ workspace_id: referenceId }),
})
```

Handler MCP: `mcpHandler({ jwksUrl, verifyOptions: { issuer, audience } }, (req, claims) => ...)` dari `@better-auth/oauth-provider`, membungkus `WebStandardStreamableHTTPServerTransport` stateless dan `McpServer` yang dibuat per request dari `claims`.

## Yang belum terbukti (syarat menutup T-148)

- Claude.ai atau Claude Code sungguhan ke URL HTTPS staging (Railway), termasuk perilaku di balik proxy Railway.
- Interaksi plugin `jwt` dengan `dash` di `auth.ts` yang sebenarnya.
- Penyimpanan tabel OAuth lewat Prisma (harness memakai adapter `pg` langsung).
