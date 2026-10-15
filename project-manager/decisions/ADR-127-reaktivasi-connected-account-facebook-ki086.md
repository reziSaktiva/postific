## Decision ADR-127

### Title

Reaktivasi row `WorkspaceConnectedAccount` yang `disconnected`/`reconnect-required` di `createConnectedAccounts` (amandemen ADR-115 poin 8, menutup KI-086)

### Status

Accepted

### Date

2026-10-15

### Decision

`WorkspaceRepository.createConnectedAccounts` (dipakai satu-satunya oleh
`WorkspaceService.confirmFacebookPagesConnection`, flow "Connect Account"
multi-Page Facebook) sekarang mencocokkan row existing lewat
`outstandAccountId` **DAN** `status`:

- Row yang sudah `active` — tetap **di-skip** (behavior lama, tidak berubah).
- Row yang `disconnected`/`reconnect-required` — **direaktivasi** (UPDATE:
  `status: "active"`, `reconnectRequired: false`, refresh `handle`, dan
  `avatarUrl` hanya ditulis kalau ada nilai baru — pola sama
  `reconnectAccount`), bukan lagi di-skip diam-diam seperti sebelumnya.
- Row yang belum ada sama sekali — tetap **create** baru (tidak berubah).

Return value `createConnectedAccounts` berisi Page yang baru dibuat **dan**
Page yang direaktivasi — konsisten dengan titik seed JOB-03
(`engagementSyncSeeder.onAccountConnected`) di `background-jobs.md` §
"created/activated", sehingga reaktivasi juga memicu seeding ulang
engagement sync (idempotent — `hasActiveEngagementJob` sudah menjaga supaya
tidak dobel kalau chain job lama masih berjalan).

**Tidak diubah:** `ReconnectButton`/`ConnectedAccountAction`
(`ConnectedAccountsList.tsx`) tetap menyembunyikan aksi untuk status
`reconnect-required`/`disconnected` pada platform Facebook. Jalur reconnect
Facebook SELALU lewat tombol "Connect Account" (header, selalu visible) →
`FacebookPagesPickerDialog` → pilih ulang Page yang sama — bukan lewat
tombol Reconnect single-account, yang genuinely tidak kompatibel dengan
Facebook (`RealOutstandAdapter.connectAccount`/`resolveConnectCallback`
throw eksplisit untuk platform ini, Facebook memakai flow
session-token+page-selection terpisah, ADR-115).

### Reason

- **ADR-115 poin 8** eksplisit menulis "Reconnect Facebook Page tunggal —
  DI LUAR SCOPE" dan sengaja YAGNI pada saat itu (belum ada kebutuhan
  konkret). KI-086 (ditemukan King Rezi 2026-10-08) mengonfirmasi lewat
  pembacaan kode langsung bahwa ini bukan cuma UI yang kurang nyaman —
  `createConnectedAccounts` SELALU skip row existing apa pun status-nya,
  jadi reconnect Facebook genuinely **dead flow**, tidak ada jalur apa pun
  yang mengaktifkannya kembali.
- King Rezi sebelumnya diberi 3 opsi (perbaiki sekarang + ADR baru / backend
  saja dulu / tunda) dan memilih **tunda** (2026-10-08). Pada 2026-10-15
  King Rezi meminta dikerjakan — ADR ini adalah "ADR baru" yang disyaratkan
  opsi pertama itu, scope final disepakati **backend-only** (lihat poin
  berikutnya).
- **Claude Design dicek dulu** (`templates/settings-connected-accounts.html`,
  rule 17 AGENTS.md) sebelum menentukan scope UI — pola `Reconnect` (chip
  `disconnected` + tombol `btn-primary`) sudah digambarkan generik di sana
  (row "X (Twitter)"), **tanpa pengecualian khusus Facebook**. Jadi
  menyembunyikan tombol itu untuk Facebook murni keputusan implementasi
  (komentar kode `ConnectedAccountAction`), bukan gap desain — tidak ada
  yang perlu dikunci ulang ke Claude Design.
- **Scope backend-only dipilih** (bukan sekaligus "un-hide" tombol
  Reconnect untuk Facebook) karena ditemukan saat implementasi:
  `RealOutstandAdapter.connectAccount`/`resolveConnectCallback` throw
  eksplisit untuk `SocialPlatform.Facebook` — tombol itu memang **tidak
  bisa** dipakai untuk Facebook (beda arsitektur OAuth, bukan sekadar
  pilihan UI), jadi tetap disembunyikan itu justru BENAR, bukan bug.
  Mengubahnya akan memicu error, bukan memperbaiki apa pun.

### Alternatives Considered

- **Tunda lebih lanjut** (opsi semula King Rezi 2026-10-08) — ditolak,
  King Rezi secara eksplisit meminta dikerjakan sekarang (2026-10-15).
- **Un-hide `ReconnectButton` untuk Facebook sekaligus** (scope "full fix"
  yang semula diajukan sebelum membaca kode adapter) — ditolak setelah
  investigasi: akan memicu throw di adapter, bukan memperbaiki apa pun.
  Jalur reconnect Facebook yang benar sudah ada lewat "Connect Account" +
  Facebook Pages Picker; yang rusak hanya logic backend-nya
  (`createConnectedAccounts`).
- **N panggilan `reconnectAccount` terpisah dari `confirmFacebookPagesConnection`**
  (reuse method yang sudah ada untuk single-account, bukan menambah logic
  baru di `createConnectedAccounts`) — ditolak: `reconnectAccount` butuh
  `connectedAccountId` tunggal yang sudah diketahui di awal (dipanggil dari
  UI yang sudah tahu row mana yang mau direconnect), sedangkan
  `confirmFacebookPagesConnection` menerima banyak Page sekaligus dari
  `selectedPageIds` tanpa tahu di awal mana yang baru vs yang perlu
  reaktivasi — lookup gabungan di `createConnectedAccounts` (satu query,
  satu transaksi) lebih sesuai bentuk data yang sudah ada, konsisten dengan
  alasan ADR-115 poin 8 kenapa flow ini satu panggilan batch bukan N
  panggilan terpisah.

### Related

- ADR-115 — keputusan asli yang diamandemen poin 8-nya (`createConnectedAccounts`
  SELALU create, reconnect Facebook di luar scope).
- ADR-122 — pola reconnect `disconnected` untuk platform non-Facebook
  (lewat `ReconnectButton`/`reconnectAccount`), preseden "created/activated"
  sebagai titik seed JOB-03 yang diikuti ADR ini.
- ADR-109 — preseden idempotent-guard (skip, bukan gagal) yang jadi dasar
  pola `match?.status === "active"` di sini.
- `apps/web/src/lib/repositories/workspace/workspace.repository.ts` —
  `createConnectedAccounts` (implementasi fix).
- `apps/web/src/domains/workspace/services/workspace.service.ts` —
  `confirmFacebookPagesConnection` (docstring diperbarui, tidak ada logic
  baru di layer ini).
- `apps/web/src/lib/repositories/workspace/workspace.repository.reactivate-connected-account.test.ts` —
  integration test (Postgres real) untuk reaktivasi vs skip.
- `project-manager/PROJECT_STATE.md` § Known Issues KI-086.
