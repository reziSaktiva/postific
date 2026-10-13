## Decision ADR-116

### Title

Koreksi Wire-Format Facebook Pages Session-Token Connect (Amandemen ADR-115,
menutup verifikasi KI-070)

### Status

Accepted

### Date

2026-09-24

### Decision

ADR-115 menulis kontrak `listPendingFacebookPages`/
`confirmFacebookPagesConnection` sebagai **tebakan best-effort** (sesi
penyusunnya tidak berhasil mengakses OpenAPI spec resmi Outstand maupun MCP
`mcp__outstand__*`) dan mencatat eksplisit 4 poin **Belum Terverifikasi**.
Sesi ini (Elon Backend Engineer, T-025.4) berhasil memverifikasi wire-format
asli langsung dari dokumentasi resmi Outstand
(`https://www.outstand.so/docs/configurations/facebook`,
`https://www.outstand.so/docs/get-pending-connection-details`,
`https://www.outstand.so/docs/finalize-pending-connection`, diakses via
WebFetch 2026-09-24 — OpenAPI JSON `api.outstand.so/openapi.json` tetap
404/tidak dapat diakses, tapi docs page HTML resmi bisa) — pola verifikasi
yang sama dengan ADR-105→ADR-112.

Ditemukan **4 perbedaan konkret** dari asumsi ADR-115:

#### 1. Nama query param redirect callback: `session` (bukan `session_token`)

Dokumentasi resmi (`docs/configurations/facebook`): *"We will redirect to
it with a `session` query parameter"* dan *"Strip the `session` parameter
from the browser URL as soon as you have read it."* ADR-115 menebak
`session_token`. **Dikoreksi**: Route Handler callback
(`apps/web/src/app/api/integrations/outstand/callback/route.ts`) membaca
`request.nextUrl.searchParams.get("session")`, BUKAN `"session_token"`.

Nama parameter INTERNAL kita sendiri (`connectFacebookSessionToken` yang
dikirim ke Connected Accounts page, dan nama variabel `sessionToken` di
kontrak `IOutstandAdapter`) TIDAK berubah — itu murni penamaan sisi kita,
bukan wire Outstand.

#### 2. Path finalize: `POST /v1/social-accounts/pending/{sessionToken}/finalize` (bukan `POST` langsung ke `/pending/{sessionToken}`)

Dokumentasi resmi (`docs/finalize-pending-connection`): method & path
persis `POST /v1/social-accounts/pending/{sessionToken}/finalize`. ADR-115
menebak `POST` ke path yang sama dengan `GET` (tanpa suffix `/finalize`).
**Dikoreksi**: `real-outstand-adapter.ts`
`confirmFacebookPagesConnection` memanggil path dengan suffix `/finalize`.

#### 3. Bentuk response `GET .../pending/{sessionToken}` — dibungkus `data.availablePages[]`, nama field per-Page beda

Response asli terverifikasi (`docs/get-pending-connection-details`):

```json
{
  "success": true,
  "data": {
    "network": "linkedin",
    "expiresAt": 1734567890000,
    "availablePages": [
      {
        "id": "abc123",
        "type": "organization",
        "name": "Acme Inc",
        "username": "acme-inc",
        "profilePictureUrl": "https://example.com/profile.jpg",
        "category": "Real Estate Agent",
        "urn": "urn:li:organization:12345",
        "accountId": "accounts/1234567890",
        "address": "12 Example St, Sydney NSW 2000"
      }
    ]
  }
}
```

(Contoh di docs memakai `network: "linkedin"` — endpoint session-token ini
generik lintas provider multi-halaman, bukan Facebook-spesifik; untuk
Facebook `network` akan berisi `"facebook"`.) ADR-115 menebak bentuk flat
`{ pages: [{ pageId, name, pictureUrl, category }] }`. **Dikoreksi**: adapter
membaca `response.data.availablePages[]`, memetakan `id`→`pageId`,
`name`→`name`, `profilePictureUrl`→`pictureUrl`, `category`→`category`
(field lain — `type`/`username`/`urn`/`accountId`/`address` — TIDAK
dipetakan, kontrak `FacebookPendingPage` kita tidak membutuhkannya).

**Kontrak `packages/shared/src/contracts/outstand-adapter.ts` (`FacebookPendingPage`,
`ListPendingFacebookPagesResult`, dst.) TIDAK berubah** — ini murni koreksi
mapping wire→domain di DALAM `real-outstand-adapter.ts` (ACL boundary,
domain-facing shape tetap sama seperti didesain ADR-115).

#### 4. Bentuk response `POST .../finalize` — `connectedAccounts[]` (bukan `accounts[]`), field per-akun beda

Response asli terverifikasi (`docs/finalize-pending-connection`):

```json
{
  "success": true,
  "connectedAccounts": [
    {
      "id": "9dyJS",
      "nickname": "johndoe",
      "username": "johndoe",
      "network": "linkedin",
      "accountType": "personal"
    }
  ]
}
```

ADR-115 menebak `{ accounts: [...] }`. **Dikoreksi**: adapter membaca
`response.connectedAccounts[]`, memetakan `id`→`outstandAccountId`,
`username` (fallback `nickname` kalau `username` kosong)→`handle`,
`platform` di-hardcode `SocialPlatform.Facebook` (method ini SELALU
dipanggil untuk konteks Facebook Pages — konsisten dengan kontrak
`ConfirmFacebookPagesResult.accounts` ADR-115 yang menyatakan "platform
SELALU `SocialPlatform.Facebook`"), `status: "active"`.

#### Poin ADR-115 yang TERKONFIRMASI BENAR (tidak berubah)

- **Body request finalize**: `{ "selectedPageIds": ["abc123", "org456"] }`
  — nama field `selectedPageIds`, array string, minimum 1 item. ADR-115
  menebak ini persis dan BENAR — tidak ada perubahan.
- **Path GET**: `GET /v1/social-accounts/pending/{sessionToken}` — persis
  sesuai tebakan ADR-115.

#### 5. TTL session-token: 30 menit (terverifikasi, mengisi poin 4 "Belum Terverifikasi" ADR-115)

Dokumentasi resmi (`docs/configurations/facebook`): *"The session itself is
valid for 30 minutes."* Response `GET .../pending/{sessionToken}` juga
membawa `expiresAt` (Unix ms) di `data.expiresAt` — dikonfirmasi field-nya
ada, TAPI **kontrak `FacebookPendingPage`/`ListPendingFacebookPagesResult`
(ADR-115) TIDAK membawa `expiresAt` ke domain kita** (keputusan scope,
bukan lupa) — UI Page-selection dialog (Mark UI Engineer, di luar scope
sesi ini) menangani kasus token sudah kedaluwarsa lewat error response
biasa (`404 Session expired or invalid` dari Outstand → dipetakan ke
`OutstandIntegrationError` oleh `outstand-http-client.ts` existing, path
error handling yang sudah ada, tidak butuh field `expiresAt` eksplisit di
kontrak). Kalau nanti dibutuhkan countdown/warning proaktif di UI sebelum
token expired, itu perlu keputusan scope terpisah (field baru di kontrak) —
dicatat sebagai catatan follow-up, bukan diimplementasikan sekarang (YAGNI,
konsisten dengan keputusan "Reconnect di luar scope" ADR-115 poin 8).

### Reason

Rule #4 AGENTS.md: jangan menambal kode berdasarkan bentuk asli yang beda
dari ADR tanpa mencatat ADR baru. ADR-115 eksplisit menandai dirinya
"Proposed, wajib diverifikasi" — sesi ini berhasil melakukan verifikasi itu
lewat WebFetch terhadap docs page resmi Outstand (bukan tebakan lanjutan),
menemukan 4 perbedaan konkret dari 4 poin "Belum Terverifikasi" ADR-115,
sehingga wajib diamandemen sebagai ADR terpisah (pola identik
ADR-105→ADR-112) alih-alih mengedit ADR-115 langsung (histori keputusan
tetap utuh).

### Alternatives Considered

- **Edit ADR-115 langsung untuk mencerminkan bentuk asli.** Ditolak — sama
  alasan ADR-112 tidak mengedit ADR-105: histori "apa yang diasumsikan lalu
  ternyata salah" adalah informasi berharga (kenapa proses verifikasi macam
  ini penting), menghapusnya lewat edit langsung menghilangkan pelajaran itu.
- **Ubah kontrak `packages/shared` (`FacebookPendingPage`, dst.) supaya
  field-nya match 1:1 dengan wire Outstand** (mis. tambah `type`/`urn`/
  `accountId`/`address`). Ditolak — ACL (AGENTS.md #6) sengaja memisahkan
  bentuk wire dari bentuk domain; domain kita tidak butuh field tambahan
  itu sekarang (YAGNI), menambahkannya "karena ada di wire" bertentangan
  dengan alasan ACL ada.

### References

- ADR-115 — draft awal kontrak, sekarang diamandemen ADR ini (4 poin
  "Belum Terverifikasi" di sana sekarang terjawab).
- ADR-112 — pola verifikasi wire-format yang sama (ADR-105→ADR-112).
- ADR-109 — preseden idempotent-guard, tidak berubah oleh amandemen ini.
- `apps/web/src/lib/adapters/outstand/real-outstand-adapter.ts` — mapping
  wire→domain dikoreksi sesuai amandemen ini.
- `apps/web/src/app/api/integrations/outstand/callback/route.ts` —
  query param `session` (bukan `session_token`).
- `tasks/v02-publishing-mvp.md` § T-025 (T-025.4).
- KI-070 (`PROJECT_STATE.md` § Known Issues) — verifikasi wire-format
  sekarang selesai; implementasi kode mengikuti ADR ini.
