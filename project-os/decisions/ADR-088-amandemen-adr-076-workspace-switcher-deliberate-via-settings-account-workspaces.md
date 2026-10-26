## Decision ADR-088

### Title

Amandemen ADR-076 — Deliberate Workspace Switcher via Settings → Account →
Workspaces

### Status

Accepted — Amended by ADR-089 (2026-08-24)

### Date

2026-08-24

### Context

ADR-076 (2026-08-10) menetapkan "Multi Workspace Management" sebagai **Out of
Scope MVP** dan menghapus konsep Workspace Selector — alasannya saat itu:
user efektif hanya punya 1 workspace, sehingga switcher penuh dianggap
kompleksitas tanpa manfaat. Poin 4 ADR-076 secara eksplisit menyatakan picker
`/onboarding` (dibangun sebagai T-039.4) "bukan fitur Multi Workspace
Management — ia re-entry point saat cookie hilang, bukan UI switch-workspace
permanen".

King Rezi menemukan gap nyata dari premis ini: begitu user sudah pernah
memilih satu workspace lewat picker onboarding, **tidak ada cara untuk
pindah ke workspace lain miliknya secara sengaja**. Picker `/onboarding`
hanya muncul saat cookie `active-workspace-id` sudah hilang duluan (browser
baru, cookie terhapus) — bukan mekanisme switch yang bisa dipicu user kapan
saja selama masih login dan cookie masih valid. Ini bukan by-design yang bisa
dibiarkan; user yang jadi anggota lebih dari satu workspace (baik sebagai
Owner satu, member biasa di workspace lain) tidak punya jalur apa pun untuk
berpindah.

Setelah AI utama memberi rekomendasi trade-off penempatan (halaman/section
tersendiri di Settings vs digabung ke General Settings), King Rezi memutuskan
**halaman tersendiri**, ditempatkan di grup **Account** (bukan Organization).

Sempat ada miskonsepsi soal mekanisme switch — King Rezi awalnya mengira
switch harus melalui hapus cookie dulu lalu membangun ulang lewat alur
picker onboarding yang sudah ada (dianggap aneh oleh King Rezi sendiri, dan
memang tidak perlu serumit itu). Dikoreksi: switch yang disengaja itu
operasi sederhana — overwrite langsung cookie `active-workspace-id` ke
workspace tujuan (setelah validasi ulang membership), lalu redirect ke Home.
Tidak ada langkah hapus cookie sama sekali di alur ini; alur `/onboarding`
tetap ada sebagai penanganan kasus cookie yang **sudah** hilang duluan (belum
berubah, tetap dalam pola ADR-076).

Keputusan ini sudah dieksekusi King Rezi di Claude Design (project "Social
Media Management") pada sesi yang sama, bukan usulan yang menunggu
persetujuan lebih lanjut: `templates/settings-workspaces.html` (halaman
baru), 6 template Settings lain (`settings-general.html`,
`settings-connected-accounts.html`, `settings-members.html`,
`settings-profile.html`, `settings-notifications.html`,
`settings-preferences.html`) ditambah link nav "Workspaces" di grup Account,
`components/dialog.html` (dialog "Buat Workspace Baru"), `styles.css` (class
`.ws-pick-item.is-active`), dan `readme.md` (section baru). Halaman ini
**belum** diwire ke `templates/app-prototype/AppPrototype.dc.html` (interactive
runner) — sengaja ditunda sebagai follow-up terpisah, dicatat di `readme.md`
project Claude Design tersebut, supaya scope kerja Claude Design tidak
melebar ke routing table + role-visibility rules runner itu.

### Decision

1. **Halaman baru** "Workspaces" di Settings, grup **Account** (bukan
   Organization), ditempatkan di posisi **paling atas** grup Account — di
   atas Profile.
2. **Konten halaman**: list seluruh workspace yang user jadi anggotanya
   (baik sebagai pemilik maupun member biasa). Workspace yang sedang aktif
   dirender non-interactive dengan chip "Aktif" (reuse `chip chip-active`
   yang sudah ada — tidak ada token/warna baru). Workspace lain dirender
   sebagai row yang bisa diklik untuk berpindah ke workspace itu.
3. **Tombol "Buat Workspace Baru"** di page-head (posisi/bentuk sama seperti
   tombol "Connect Account" di halaman Connected Accounts) — membuka dialog
   kecil `purpose="form"` (field Nama Workspace saja). **Tidak ada** tier
   konfirmasi (ADR-049) karena membuat workspace baru bersifat
   non-destruktif dan reversible — berbeda dengan Transfer Ownership/Delete
   Workspace (Tier 1, ADR-050).
4. **Mekanisme switch: overwrite cookie langsung**, bukan hapus-lalu-buat-
   ulang. Setelah user mengklik workspace tujuan di halaman ini: (a)
   validasi ulang bahwa user memang member workspace tersebut, (b) set
   cookie `active-workspace-id` ke id workspace baru (menimpa nilai lama,
   tanpa langkah hapus terpisah), (c) redirect ke Home. Alur `/onboarding`
   (picker saat cookie **sudah** hilang duluan, T-039.4) tidak berubah dan
   tetap kasus yang berbeda — ia dipicu oleh cookie yang hilang di luar
   kendali user (browser baru, cookie terhapus), bukan oleh keputusan
   sengaja untuk berpindah workspace.
5. **Scope amandemen ini sengaja narrow.** Yang resmi masuk scope MVP dari
   amandemen ini hanya dua hal: (a) switch active workspace di antara
   workspace yang user sudah jadi anggotanya, dan (b) create additional
   workspace dari halaman Settings ini. Hal lain yang mungkin terdengar
   seperti "Multi Workspace Management" penuh — cross-workspace bulk
   actions, billing gabungan, shared views lintas workspace, dan sejenisnya
   — **tetap Out of Scope** kecuali ada keputusan terpisah lagi di masa
   depan.
6. Halaman ini sudah dibuat di Claude Design (lihat Context untuk daftar
   file) tapi **belum diwire** ke interactive runner
   (`AppPrototype.dc.html`) — status ini sengaja dicatat sebagai open
   follow-up di `readme.md` Claude Design, bukan oversight yang perlu
   ditutup segera.

### Reason

- **Kenapa scope dibuka sebagian, bukan penuh:** gap yang ditemukan King
  Rezi spesifik pada satu kebutuhan nyata — user dengan lebih dari satu
  membership tidak punya jalur pindah. Membuka "Multi Workspace Management"
  secara penuh (bulk actions, billing gabungan, dst.) tidak diminta dan
  tidak ada kebutuhan nyata yang mendukungnya saat ini — menambah scope di
  luar gap yang ditemukan akan mengulang pola yang sudah ditolak ADR-076
  (kompleksitas tanpa manfaat terukur).
- **Kenapa Account, bukan Organization:** switch-workspace adalah properti
  keanggotaan _user_ (ke workspace mana saja dia jadi anggota), bukan
  setting dari satu workspace tertentu — begitu switch terjadi, konteks
  Organization Settings dari workspace sebelumnya otomatis tidak relevan
  lagi (karena Organization Settings selalu scoped ke workspace aktif).
  Ini paralel dengan Profile/Notifications/Preferences yang juga soal
  "user", bukan "org" — konsisten dengan taksonomi Organization vs Account
  yang sudah ditetapkan ADR-076.
- **Kenapa overwrite cookie langsung, bukan hapus-lalu-onboarding-ulang:**
  hapus cookie lalu mengandalkan alur `/onboarding` untuk membangunnya
  kembali menambah langkah tanpa manfaat — alur itu didesain untuk kasus
  cookie hilang di luar kendali user, bukan untuk switch yang disengaja.
  Overwrite langsung + validasi ulang membership mencapai hasil yang sama
  (cookie baru yang valid) tanpa langkah perantara yang tidak perlu.
- **Kenapa tidak ada tier konfirmasi untuk create workspace:** kriteria
  wajib konfirmasi (ADR-049) adalah irreversibel/mahal dibatalkan atau
  blast radius luas — membuat workspace baru tidak memenuhi kriteria itu
  (bisa dihapus lagi lewat Delete Workspace yang sudah ada tier-nya
  sendiri).

### Alternatives Considered

- **Taruh switcher di General Settings (grup Organization)** —
  dipertimbangkan sebagai opsi lebih murah (tidak perlu halaman baru), tapi
  ditolak King Rezi: General Settings scoped ke satu workspace tertentu,
  sedangkan switch-workspace secara konsep adalah properti user lintas
  workspace, bukan setting dari workspace yang sedang dilihat.
- **Buka penuh "Multi Workspace Management"** (cross-workspace bulk
  actions, billing gabungan, shared views) — ditolak; tidak ada kebutuhan
  nyata yang mendukungnya saat ini, dan ini akan mengulang kompleksitas
  yang sudah ditolak ADR-076 tanpa gap konkret sebagai justifikasi (beda
  dengan switch/create yang punya gap nyata).
- **Switch via hapus cookie + alur `/onboarding` ulang** — ide awal King
  Rezi, dikoreksi sendiri setelah didiskusikan; ditolak karena tidak perlu
  serumit itu, dan mencampur dua konsep berbeda (recovery cookie hilang vs
  switch disengaja) yang seharusnya tetap terpisah.
- **Tier konfirmasi untuk "Buat Workspace Baru"** — dipertimbangkan
  mengikuti pola dialog lain di Settings (Transfer Ownership, Delete
  Workspace), ditolak karena aksi ini non-destruktif dan reversible, tidak
  memenuhi kriteria wajib konfirmasi ADR-049.

### Impact / Baseline yang diamandemen

- **`project-os/decisions/ADR-076-workspace-context-via-cookie-hapus-slug-konsolidasi-settings-organization-account.md`**
  — poin 4 Decision **diamandemen** (bukan dihapus/ditulis ulang): picker
  `/onboarding` tetap seperti apa adanya (re-entry point cookie hilang),
  tapi klaim "tidak ada fitur multi-workspace switching sama sekali" pada
  poin itu sekarang dibatasi oleh ADR-088 ini — ditandai catatan append di
  file tersebut, isi poin 4 yang lama tidak diedit.
- `product-discovery/02-product/mvp-definition.md` — baris "Multi Workspace
  Management" di daftar Out of Scope diubah untuk mencantumkan scope
  sebagian yang masuk MVP (switch antar membership + create workspace
  tambahan via Settings → Account → Workspaces), sisanya tetap Out of
  Scope, merujuk ADR-088.
- `product-discovery/05-architecture/auth-architecture.md` — section
  "Workspace Context" dan "Onboarding Flow (First Login & Cookie
  Re-entry)": ditambahkan penjelasan mekanisme switch deliberate (overwrite
  cookie langsung setelah validasi membership, tanpa delete) sebagai
  pembeda eksplisit dari alur recovery cookie-hilang yang sudah ada.
- `product-discovery/05-architecture/application-layer.md` — tabel kontrak
  `WorkspaceService`: ditambahkan entri `switchWorkspace` (kontrak level
  service: validasi membership, set cookie, redirect Home — tanpa detail
  implementasi).
- `product-discovery/04-ux/information-architecture.md` — section 6
  Settings: struktur grup Account ditambah "Workspaces" (paling atas,
  sebelum Profile).
- **Tidak diubah** (dicek, tidak relevan): `monorepo-setup.md` (statement
  "tidak ada workspace switcher di URL" tetap akurat — switch ini
  cookie-based, bukan URL-based, tidak menambah dynamic segment apa pun),
  `auth-strategy.md` (baris Workspace Context Table tetap akurat, murni
  soal resolusi bukan switching), `domain-model.md`, `database-strategy.md`
  (tidak ada perubahan skema data dari amandemen ini).
- Claude Design (project "Social Media Management") — sudah diperbarui di
  luar sesi dokumentasi ini (lihat Context untuk daftar file); belum diwire
  ke `AppPrototype.dc.html`, dicatat sebagai open follow-up di `readme.md`
  Claude Design tersebut, di luar cakupan ADR ini.
- **Tidak termasuk dalam ADR ini** (sengaja dipisah ke pass terpisah sesuai
  instruksi eksplisit King Rezi): `TASKS.md`, `tickets/vXX-*.md`,
  `PROJECT_STATE.md`, `COMPLETE_TASK.md` — governance dokumentasi project
  state dilakukan Gibran Project Manager di akhir, bukan bagian dari ADR
  ini.

---
