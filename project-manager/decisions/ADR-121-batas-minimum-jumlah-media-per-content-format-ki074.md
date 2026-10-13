## Decision ADR-121

### Title

Batas Minimum Jumlah Media per `ContentFormat` (Story/Reel/Pin) — Amandemen ADR-107/ADR-039, resolusi KI-074

### Status

Accepted

### Date

2026-09-26

### Decision

KI-074 (Story bisa "berhasil" terpublish tapi tayang kosong di Instagram)
menemukan gap: ADR-039/ADR-107 hanya menegakkan batas **MAKSIMUM** jumlah
media per `ContentFormat` (`MAX_MEDIA_COUNT_BY_FORMAT`), tidak pernah ada
batas **MINIMUM** — Story/Reel/Pin secara native platform selalu berbasis
media (tidak ada mode "text-only" untuk ketiganya di Instagram/Facebook/
Pinterest), tapi kode tidak pernah menegakkan itu. Diputuskan menambah
dimensi baru ke matriks yang sama:

1. **Batas minimum media per `ContentFormat`:**

   | `ContentFormat` | Min media | Alasan                                               |
   | ---------------- | --------- | ----------------------------------------------------- |
   | `Post`            | 0         | Post boleh caption-only (text-only tetap valid)        |
   | `Reel`            | 1         | Reel selalu single video, tidak ada mode text-only     |
   | `Story`           | 1         | Story selalu single media, tidak ada mode text-only    |
   | `Pin`             | 1         | Pinterest Pin selalu single media/video                |

2. **Batas efektif untuk beberapa target format berbeda dalam satu post:
   MAKSIMUM dari batas minimum semua format yang dipilih** (kebalikan dari
   ADR-107 poin 2, yang memakai MINIMUM untuk batas atas). Karena kalau ada
   target Story (butuh ≥1) dicampur dengan target Post (butuh ≥0), post itu
   harus tetap punya ≥1 media supaya target Story-nya tidak tayang kosong —
   memakai MINIMUM antar format di sini (seperti ADR-107) justru akan
   mengizinkan 0 media asal salah satu format yang dipilih mengizinkannya,
   melewatkan constraint format lain yang justru mewajibkan media.

3. **Ditegakkan di DUA tempat yang WAJIB dijaga sinkron** (pola sama
   ADR-107):
   - Server: `MIN_MEDIA_COUNT_BY_FORMAT` + `minMediaCountForFormats`/
     `assertMediaCountMeetsMinimum` di
     `apps/web/src/domains/publishing/content-format-matrix.ts`. Ditegakkan
     di `scheduleDraftAction`/`publishNowAction`
     (`apps/web/src/app/(app)/components/draft-editor/actions.ts`) —
     **sengaja TIDAK** ditegakkan di `saveDraftAction`/`updateDraftAction`,
     karena draft yang masih disusun boleh belum punya media (beda dari
     ADR-107 poin 4 yang menegakkan batas maksimum di keempat Server
     Action — batas minimum hanya relevan begitu post benar-benar akan
     dipublish/dijadwalkan, bukan saat masih draft).
   - Client (mirror): `minMediaCountConstraintMessage` di
     `apps/web/src/app/(app)/components/draft-editor/Modal.tsx` — dipakai
     untuk disable tombol Publish Now/Schedule dan menampilkan pesan begitu
     target Story/Reel/Pin dipilih tanpa media, sebelum request dikirim ke
     server sama sekali.

### Reason

* Batas ini adalah batas **fisik platform** (Outstand/Instagram/Facebook
  menerima request Story/Reel/Pin tanpa media secara sintaks valid, tapi
  hasilnya tayang kosong di aplikasi asli — kegagalan silent yang tidak
  pernah muncul sebagai error di Outstand) — menolak di level aplikasi
  jauh lebih awal (saat attach, bukan setelah publish "berhasil" tapi
  kosong) memberi umpan balik yang jelas ke user, alih-alih silent failure
  yang baru terlihat setelah cek manual ke Instagram (persis skenario
  KI-074).
* Batas minimum HANYA relevan untuk aksi yang benar-benar mempublish/
  menjadwalkan (`scheduleDraftAction`/`publishNowAction`), bukan untuk draft
  yang masih disusun — draft eksplisit dirancang bisa disimpan dalam
  keadaan belum lengkap (ADR-107 sendiri menegaskan alur ini untuk batas
  maksimum: validasi ulang terjadi di titik publish/schedule, bukan
  dipaksakan sejak awal).
* Pola "server + client mirror, WAJIB sinkron" dan struktur fungsi
  (`Record<ContentFormat, number>` + fungsi agregat + fungsi assert)
  mengikuti persis konvensi ADR-107 yang sudah dipakai untuk batas
  maksimum — bukan menciptakan mekanisme baru.

### Alternatives Considered

* **Batas minimum seragam untuk semua format (mis. selalu 0, atau selalu
  1).** Ditolak — tidak mencerminkan bahwa `Post` secara native platform
  memang boleh text-only, sementara Story/Reel/Pin tidak pernah punya mode
  itu.
* **Batas efektif MINIMUM antar format (mengikuti pola ADR-107 poin 2 apa
  adanya).** Ditolak — akan melewatkan constraint Story/Reel/Pin kalau
  dicampur dengan Post dalam satu post yang sama (lihat poin 2 di atas);
  MAKSIMUM antar format adalah satu-satunya pilihan yang tidak pernah
  mengizinkan target manapun tayang kosong.
* **Menegakkan batas minimum juga di `saveDraftAction`/`updateDraftAction`**
  (simetris penuh dengan ADR-107). Ditolak — draft yang masih disusun
  legitimately boleh belum punya media (user bisa memilih akun/format dulu
  sebelum sempat upload); memaksakan batas minimum di titik itu akan
  memblokir alur kerja normal penyusunan draft, bukan hanya mencegah bug.

### References

* ADR-039 — matriks `ContentFormat` per platform.
* ADR-107 — batas MAKSIMUM jumlah media per `ContentFormat` (diamandemen
  ADR ini, menambah dimensi baru: batas minimum, bukan mengubah batas
  maksimum yang sudah ada).
* KI-074 — Known Issue asal (`project-manager/PROJECT_STATE.md` §
  Known Issues, ditemukan King Rezi 2026-09-25 saat retest publish nyata
  ke Instagram real account, Resolved 2026-09-26).
* `apps/web/src/domains/publishing/content-format-matrix.ts` —
  `MIN_MEDIA_COUNT_BY_FORMAT`, `minMediaCountForFormat`,
  `minMediaCountForFormats`, `minMediaCountConstraintMessage`,
  `assertMediaCountMeetsMinimum`.
* `apps/web/src/app/(app)/components/draft-editor/Modal.tsx` — mirror
  client `minMediaCountConstraintMessage`, gate `isReadyToSchedule`/
  `isReadyToPublishNow`.
* `apps/web/src/app/(app)/components/draft-editor/actions.ts` —
  `scheduleDraftAction`/`publishNowAction`.
