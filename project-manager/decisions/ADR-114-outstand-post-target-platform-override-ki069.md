## Decision ADR-114

### Title

Redesain kontrak `OutstandPostTargetInput` — tambah field `platform`
supaya override format platform-specific (Story/Reel, ADR-039/ADR-107)
benar-benar terkirim ke Outstand — menutup KI-069

### Status

Accepted

### Date

2026-09-24

### Decision

KI-069 (ditemukan Elon Backend Engineer 2026-09-23 saat implementasi Real
OutstandAdapter, T-025) mencatat bahwa `OutstandPostTargetInput` tidak
membawa `platform`/network per target, padahal body resmi Outstand
`POST /v1/posts` butuh override format (Story/Reel/Pin) dikirim sebagai key
top-level BERNAMA NETWORK (`instagram`/`facebook`/`pinterest`/dst) — bukan
per-account. Tanpa field itu, `RealOutstandAdapter.buildPostRequestBody`
tidak bisa membentuk key tersebut dengan aman, jadi override platform-
specific yang sudah didesain ADR-039/ADR-107 TIDAK PERNAH terkirim ke
Outstand (post tetap tayang, tapi selalu sebagai "post" biasa).

King Rezi mengonfirmasi scope sebelum implementasi dimulai:

1. Kerjakan penuh Bagian A (tambah field `platform` ke kontrak) + Bagian B
   (mapping `contentFormat`/`platformOptions` kita ke shape asli Outstand
   per network) — untuk field yang datanya SUDAH ada di domain kita.
2. **Pinterest `board_id`** (wajib di API resmi Outstand untuk publish ke
   Pinterest) SENGAJA TIDAK diimplementasikan — domain/UI kita saat ini
   sama sekali tidak mengumpulkan `board_id` (hanya `pinTitle`/`pinLink`).
   Key `pinterest` TIDAK PERNAH dikirim di request body Outstand (sama
   seperti sebelumnya — tidak menambah risiko baru), dicatat sebagai KI
   baru terpisah oleh Gibran Project Manager, di luar scope ADR ini.

Shape asli Outstand diverifikasi langsung lewat MCP resmi `create_post`
(bukan tebakan), cross-check OpenAPI spec resmi
(`https://api.outstand.so/v1/posts/openapi.json`):

- `instagram: { publishAsStory?, reelCoverUrl?, reelThumbOffset?, altText?,
  caption?, collaborators?, locationId?, isAiGenerated?, userTags?,
  trialReel? }` — **TIDAK ADA flag eksplisit untuk Reel** (auto-detect dari
  video di sisi Outstand). Jadi: `ContentFormat.Story` → kirim
  `instagram: { publishAsStory: true }`; `ContentFormat.Post`/`Reel` →
  jangan sertakan key `instagram` sama sekali (tidak ada yang perlu diisi).
- `facebook: { publishAsStory?, publishAsReel?, mentions? }` —
  `ContentFormat.Story` → `facebook: { publishAsStory: true }`;
  `ContentFormat.Reel` → `facebook: { publishAsReel: true }`;
  `ContentFormat.Post` → tidak ada key `facebook`.
- `pinterest: { board_id (wajib), title?, link?, alt_text?,
  cover_image_url? }` — **TIDAK diimplementasikan** (lihat poin 2 di atas).

#### 1. Kontrak (`packages/shared/src/contracts/outstand-adapter.ts`)

`OutstandPostTargetInput` bertambah field `platform: SocialPlatform`
(wajib, konsisten dengan field lain di interface ini yang sudah wajib —
bukan opsional/best-effort):

```ts
export interface OutstandPostTargetInput {
  outstandAccountId: string;
  platform: SocialPlatform;
  contentFormat: ContentFormat;
  platformOptions?: Record<string, unknown>;
}
```

#### 2. Caller — meneruskan `platform` yang sudah tersedia di scope

`platform` per target SUDAH ada di data domain (`SchedulePostsTargetInput.
platform`, `RetryTargetRecord.platform`) — perubahan di caller murni
meneruskan nilai yang sudah ada, bukan mengambil data baru:

- `apps/web/src/domains/publishing/services/schedule-posts.use-case.ts` —
  construct payload `outstandAdapter.schedulePost({ targets: ... })`
  sekarang menyertakan `platform: target.platform`.
- `apps/web/src/domains/publishing/services/publish-now.use-case.ts` —
  pola sama.
- `apps/web/src/domains/publishing/services/retry-failed-target.use-case.ts`
  — pola sama, `target.platform` dari `RetryTargetRecord`.

#### 3. `RealOutstandAdapter.buildPostRequestBody`

Fungsi baru `computePlatformOverride(platform, contentFormat)` memetakan
SATU target ke override (atau `null` kalau tidak ada override yang perlu
dikirim, lihat mapping di atas). `buildPostRequestBody` mengumpulkan
override per network (`toOutstandNetwork`, mapping yang sama dipakai
`connectAccount`/`fetchComments`) dan menyisipkannya sebagai key top-level
ke body request.

**Edge case: multi-target dengan network SAMA tapi `contentFormat`
BERBEDA** (mis. dua akun Instagram di post yang sama, satu `Story` satu
`Post`) — body Outstand hanya punya SATU key `instagram` per POST (bukan
per-account), jadi override berbeda pada network yang sama TIDAK BISA
dikirim keduanya. Aturan eksplisit (dikonfirmasi King Rezi sebagai
"reasonable rule", bukan STOP-and-ask — belum ada kasus nyata di UI
sekarang untuk multi-target beda format di network yang sama, jadi ini
defensif untuk masa depan): target PERTAMA (urutan array `targets`) yang
menghasilkan override untuk network itu MENANG; target berikutnya dengan
override BERBEDA di network yang sama diabaikan — TIDAK silent,
`console.warn` eksplisit menyebut network + kedua override supaya kelihatan
di log produksi/CI kalau kasus ini benar-benar terjadi.

### Reason

* Kontrak lama tidak membawa data yang dibutuhkan real adapter untuk
  memenuhi kontrak resmi Outstand — bug diam-diam (override yang sudah
  didesain ADR-039/ADR-107 tidak pernah efektif), bukan gap fungsional yang
  memblokir publish dasar, tapi menghilangkan behavior yang sudah
  dijanjikan produk (Story/Reel).
* `platform` diteruskan dari data yang SUDAH ada di scope caller (bukan
  lookup baru) — konsisten dengan pola lain di kontrak ini
  (`expectedOutstandAccountIds` di `fetchPostOutcome`, `accountUsername` di
  `fetchComments`): adapter tidak menebak, caller menyuplai.
* Pinterest `board_id` sengaja tidak diimplementasikan sekarang — menambah
  field itu ke domain/UI adalah scope terpisah (form/persistensi baru),
  bukan sekadar redesain kontrak adapter. Mengirim key `pinterest` tanpa
  `board_id` valid berisiko 400 di sisi Outstand — lebih aman TIDAK
  mengirim key itu sama sekali (perilaku existing, tidak berubah).
* First-match-wins + `console.warn` untuk konflik same-network dipilih
  alih-alih menolak/throw — konsisten dengan filosofi ACL "best-effort,
  jangan blokir publish dasar demi override yang tidak esensial" (sama
  seperti `deletePost`/`cancelScheduledPost` best-effort di use-case
  pemanggil), dan kasus ini belum pernah terjadi di UI produksi sekarang.

### Alternatives Considered

* **`platform` opsional di `OutstandPostTargetInput`, adapter skip override
  kalau kosong**. Ditolak — field lain di interface ini sudah wajib;
  opsional di sini hanya memindahkan bug (lupa isi field) dari compile-time
  ke runtime tanpa alasan kuat.
* **Derive `platform` dari `outstandAccountId` di adapter (mis. prefix/
  lookup)**. Ditolak — `outstandAccountId` adalah string opaque dari
  Outstand (lihat instruksi MCP resmi: "never construct one, and never
  assume they are integers"), tidak ada struktur yang bisa diparse dengan
  aman; caller sudah tahu platform dari data domain durable.
* **Throw error (bukan `console.warn` + first-match-wins) saat konflik
  same-network contentFormat**. Dipertimbangkan tapi ditolak untuk task ini
  — akan mengubah `schedulePost`/`publishNow` all-or-nothing menjadi gagal
  total hanya karena override sekunder yang tidak esensial, padahal publish
  dasar tetap valid. Log eksplisit dianggap cukup untuk kasus yang saat ini
  hipotetis (belum ada UI yang menghasilkan kombinasi ini).
* **Implementasikan Pinterest `board_id` sekaligus (tambah field UI/domain
  baru)**. Ditolak untuk task ini — eksplisit di luar scope keputusan King
  Rezi, butuh kerja form/persistensi terpisah, dicatat KI baru oleh Gibran
  Project Manager.

### References

* KI-069 (`PROJECT_STATE.md` § Known Issues) — temuan awal gap.
* ADR-039 — Content Format per akun tujuan (Story/Reel/Post/Pin, desain
  produk asal override ini).
* ADR-107 — (lihat `PROJECT_STATE.md`/task terkait untuk detail Content
  Format matrix per platform).
* ADR-059 — pola Fake/Real adapter switch, filosofi ACL.
* ADR-108 — pola `expectedOutstandAccountIds` disuplai caller, preseden
  untuk `platform` disuplai caller di ADR ini.
* `packages/shared/src/contracts/outstand-adapter.ts` — kontrak final
  `OutstandPostTargetInput`.
* `apps/web/src/lib/adapters/outstand/real-outstand-adapter.ts` —
  `computePlatformOverride`/`buildPostRequestBody`.
* `apps/web/src/lib/adapters/outstand/real-outstand-adapter.test.ts` —
  test override Instagram Story, Facebook Story/Reel, Instagram Reel (tanpa
  key), Post biasa (tanpa key), Pinterest (tetap tanpa key), konflik
  same-network.
* `apps/web/src/domains/publishing/services/schedule-posts.use-case.ts`,
  `publish-now.use-case.ts`, `retry-failed-target.use-case.ts` — caller
  yang meneruskan `platform`.
* `tasks/v02-publishing-mvp.md` § T-025 (T-025.2/T-025.3).
