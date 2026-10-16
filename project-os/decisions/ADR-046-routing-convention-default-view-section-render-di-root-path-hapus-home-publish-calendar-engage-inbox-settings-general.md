## Decision ADR-046

### Title

Routing Convention — Default View Section Render di Root Path (Hapus `/home`, `/publish/calendar`, `/engage/inbox`, `/settings/general`)

### Status

Accepted

### Date

2026-07-28

### Decision

1. Section yang punya **satu default/single view** merender langsung di
   `page.tsx` pada root path section itu sendiri — bukan di named child
   segment terpisah. Konkretnya:
   - `/{slug}` (root workspace) langsung merender **Home** — segment
     `/{slug}/home` **dihapus**. `app/page.tsx` (root redirect) mengarah ke
     `/${slug}` (bukan lagi `/${slug}/home`).
   - `/{slug}/publish` langsung merender **Calendar** (default tab per
     IA-D04/NP-D06) — segment `/publish/calendar` **dihapus**. Detail route
     `calendar/[postId]` pindah menjadi `/publish/[postId]`. **Superseded**
     untuk Publish oleh amandemen final 2026-07-29 di bawah — lihat
     "Amandemen Final (2026-07-29)".
   - `/{slug}/engage` langsung merender **Inbox** (satu-satunya layar Engage
     per `navigation-patterns.md`) — segment `/engage/inbox` **dihapus**.
   - `/{slug}/settings` langsung merender **General** (tab pertama Settings)
     — segment `/settings/general` **dihapus**.
2. Sub-screen **non-default** tetap punya segment eksplisit seperti
   sekarang: `/publish/queue`, `/publish/drafts`, `/publish/history`,
   `/settings/connected-accounts`, `/settings/members`, `/settings/roles`,
   `/settings/billing`. Tidak berubah.
3. Path lama (`/home`, `/publish/calendar`, `/engage/inbox`,
   `/settings/general`) **tidak** dipertahankan sebagai redirect
   kompatibilitas — fitur ini masih tahap M8 Development, belum pernah
   dirilis ke user eksternal, dan audit codebase + dokumentasi (grep
   menyeluruh) mengonfirmasi belum ada internal link yang hardcode ke
   path-path tersebut. Tidak ada broken-link risk nyata.
4. Aturan umum baru untuk routing App Router project ini: **segment yang
   hanya berfungsi sebagai container (punya `layout.tsx` tapi tanpa
   `page.tsx` sendiri, atau tanpa keduanya) tidak boleh dibiarkan begitu
   saja** — setiap section wajib punya `page.tsx` di root path-nya sendiri,
   baik berupa default view (kasus di atas) maupun konten asli section
   tersebut.

### Reason

- Konsisten dengan pola navigasi profesional yang sudah dipraktikkan luas
  (GitHub repo → tab **Code** default tanpa segment URL; Vercel/Notion →
  root workspace langsung render konten, bukan `/workspace/home`) —
  dibanding pola sebelumnya yang membuat root section jadi 404 kalau
  diakses langsung.
- Menutup celah 404 sistemik yang ditemukan sekaligus di 4 titik:
  `/{slug}`, `/{slug}/publish`, `/{slug}/engage`, `/{slug}/settings` —
  semuanya cuma punya `layout.tsx` (atau bahkan tidak punya apa-apa) di root
  tanpa `page.tsx`/redirect, sehingga langsung 404 saat diakses.
- IA-D04/NP-D06 sudah menetapkan Calendar sebagai default Publish secara
  **tetap** (dijustifikasi khusus untuk persona Raka & Maya), bukan
  sesuatu yang direncanakan berubah per role/preferensi — jadi tidak ada
  kehilangan fleksibilitas nyata dari mem-fix default view langsung di
  root path section.
- URL jadi lebih pendek dan bersih — selaras dengan keinginan menghindari
  path yang tidak perlu panjang seperti `/{slug}/home`.

### Alternatives Considered

- **Redirect ke default child** (root section melempar redirect ke
  `/publish/calendar`, dst., URL berubah di address bar) — ditolak;
  menambah satu HTTP roundtrip dan tetap mengubah URL bar, padahal tujuan
  awal justru menyederhanakan URL.
- **Shared component, dua URL** (root section dan child route sama-sama
  render komponen yang sama, tanpa redirect) — ditolak; menciptakan dua
  "canonical URL" untuk konten identik, berisiko membingungkan untuk
  internal linking dan analytics di kemudian hari.
- **Biarkan sebagai container 404** sampai ada in-page tab-switcher yang
  dibangun — ditolak; root section tetap 404 kalau diakses langsung tanpa
  melalui klik sidebar dulu, dan tidak ada dokumen yang pernah menugaskan
  siapa yang harus menutup gap ini.

### Catatan Tambahan (2026-07-28, interim — lihat Amandemen Final di bawah)

Implementasi live menemukan masalah yang tidak diantisipasi poin Decision
di atas: karena `publish/` juga punya sibling route dinamis
(`publish/[postId]`, dipakai Draft Editor dari Calendar/Queue/Drafts/
History), menghapus folder statis `calendar/` membuat `/publish/calendar`
(path lama) **tertangkap oleh `[postId]`** — bukan 404, tapi merender
placeholder Draft Editor dengan `postId = "calendar"`. Home, Engage,
Settings tidak punya masalah ini karena tidak ada sibling route dinamis di
level root mereka.

Sebagai penanganan sementara (saat itu), khusus bagian Publish dari
ADR-046 di-revert: `calendar/` (+ `calendar/[postId]`) dihidupkan lagi
sebagai folder statis, dan `publish/page.tsx` redirect ke
`/publish/calendar` — bukan merender Calendar langsung di root seperti
poin Decision #1 di atas. Poin Decision #1 untuk Home, Engage, Settings
**tidak berubah** dan tetap berlaku penuh.

### Amandemen Final (2026-07-29) — Publish Dikecualikan Permanen dari Root-Render

**Keputusan final:** state interim di atas **diformalkan sebagai final**,
bukan sekadar sementara. `/{slug}/publish` **tetap** redirect ke
`/{slug}/publish/calendar`; `calendar/` (+ `calendar/[postId]`) **tetap**
jadi folder statis permanen. Poin Decision #1 baris Publish (render
langsung di root, `[postId]` pindah ke `/publish/[postId]`) **tidak
pernah dijalankan** dan tidak akan dijalankan.

**Alasan:**

- Publish adalah **satu-satunya** section dengan sibling route dinamis
  (`[postId]`) langsung di level root section — Home, Engage, Settings
  tidak punya kasus ini. Memaksakan pola root-render di sini berarti
  memindahkan `[postId]` ke path lain atau mengubahnya jadi intercepting
  route, keduanya menambah kompleksitas nyata untuk manfaat yang kecil
  (menghilangkan satu HTTP redirect).
- Redirect permanen sudah terverifikasi live (ngrok tunnel, akun test Raka
  Pratama) tanpa masalah — tidak ada broken link, sidebar highlight benar,
  typecheck/lint/test hijau.
- Konsistensi murni dengan Home/Engage/Settings bukan tujuan itu sendiri;
  ADR-046 tujuan utamanya menutup celah 404 sistemik — itu sudah tercapai
  untuk Publish lewat redirect yang jelas (bukan 404, bukan mismatch
  `[postId]`).

**Alternatif yang dipertimbangkan (ditolak):**

- **Root-render + rename `[postId]` ke path lain** (mis.
  `/publish/post/[postId]`) — ditolak; menambah kerja rename + update
  semua link ke detail post, untuk manfaat kosmetik (satu redirect lebih
  sedikit) yang tidak sepadan.
- **Root-render + `[postId]` jadi intercepting/parallel route (modal)** —
  ditolak untuk saat ini; effort paling besar (mengubah UX post detail
  dari full page ke modal), di luar scope keputusan routing murni.

**Dampak:** `/publish` adalah pengecualian **permanen** dan terdokumentasi
dari pola ADR-046 poin #1, bukan penyimpangan sementara yang menunggu
keputusan lanjutan. Tidak ada task lanjutan yang menggantung untuk topik
ini.

**Catatan silang (2026-07-30, ADR-052):** ADR-052 menghapus `[postId]` di
`calendar`/`queue`/`drafts` (digantikan modal), **tapi tidak**
`history/[postId]` ("Post Detail" — layar terpisah untuk konten published,
KSP-D10, sengaja tidak didalami di UX Baseline dan di luar scope ADR-052
sepenuhnya). Karena `history/[postId]` tetap ada, premis "Publish
satu-satunya section dengan sibling route dinamis `[postId]`" di atas
**tetap berlaku** — ADR-052 **tidak** mengubah kesimpulan amandemen ini.
Dicatat semata sebagai forward-reference agar jelas ADR-052 sudah
dipertimbangkan terhadap keputusan ini, bukan luput.

---
