## Decision ADR-052

### Title

New Post & Edit Draft — Draft Editor jadi Modal Reusable (override NP-D02)

### Status

Accepted — Amended by ADR-065 (2026-08-05)

### Date

2026-07-30

### Decision

Draft Editor (New Post dan Edit Draft, KSP-05) diubah dari full-page/panel
route menjadi **modal overlay fullscreen** (`Dialog variant="fullscreen"`),
mengoverride keputusan lama NP-D02 di `navigation-patterns.md` (dicatat
sebagai NP-D11 di dokumen tersebut). Detail keputusan teknis:

- **Cakupan:** modal dipakai untuk **New Post dan Edit Draft**, keduanya.
- **State management:** React Context + `useState` biasa (tidak ada state
  library baru ditambahkan) — bukan Next.js intercepting route
  (`(.)new`).
- **Routing:** route lama `/publish/drafts/new` dan `[postId]` di
  `calendar`/`queue`/`drafts` (ketiganya berlabel scaffold "Draft Editor")
  **dihapus total** — modal-only, tanpa deep-link URL khusus.
  **`history/[postId]` (scaffold "Post Detail") TIDAK termasuk** — itu
  layar terpisah untuk konten yang sudah published (KSP-D10, sengaja tidak
  didalami di UX Baseline, bukan Draft Editor), di luar scope ADR-052
  sepenuhnya. Implementasinya menyusul kapan pun History section
  dikerjakan, tidak terkait modal ini.
- **Resume unsaved state:** hanya untuk **New Post** — state form yang
  belum disimpan disimpan browser-only (localStorage), dan saat modal New
  Post dibuka kembali dengan state tersimpan, muncul dialog "Resume
  unfinished post?" (Resume / Mulai Baru). **Edit Draft tidak** memiliki
  mekanisme ini — kalau modal ditutup tanpa disimpan, perubahan pada draft
  yang sedang diedit hilang (perilaku standar).
- **Urutan kerja:** dokumentasi (ADR ini + update baseline UX) → Design
  System (sinkronisasi mockup ke Claude Design, ADR-042/045) →
  implementasi kode — masing-masing sesi terpisah, tidak boleh loncat
  tahap (pola kerja yang sama dengan ADR-051).

### Reason

- Motivasi user: New Post/Edit Draft terasa lebih cepat/ringan tanpa
  pindah halaman penuh, konsisten dengan pola aplikasi serupa lainnya.
- Trade-off dari NP-D02 asli (modal menutupi Calendar/Queue, pengguna
  kehilangan konteks jadwal) disadari dan **diterima secara eksplisit**
  oleh user demi kecepatan alur kerja — bukan diabaikan diam-diam.
- Resume state dipersempit ke New Post saja (bukan juga Edit Draft) untuk
  membatasi kompleksitas awal implementasi; Edit Draft draft sudah
  tersimpan di database sehingga risikonya lebih rendah dibanding New Post
  yang belum pernah disimpan sama sekali.

### Alternatives Considered

- **Next.js intercepting route (`(.)new`)** — ditolak; user memilih
  Context state biasa agar tidak menambah kompleksitas routing, dan modal
  tidak butuh URL sendiri untuk deep-link.
- **Resume unfinished state juga untuk Edit Draft** — ditolak (dipersempit
  user saat review plan); menambah kompleksitas (perlu baseline
  perbandingan data server vs localStorage) tanpa manfaat sepadan pada
  tahap ini.
- **Auto-save unsaved state ke database** — ditolak; browser-only
  localStorage cukup untuk kebutuhan saat ini, dan menghindari draft
  "sampah" di database dari percobaan yang dibatalkan pengguna.
- **Pertahankan route lama untuk direct link/bookmark, trigger via modal**
  — ditolak; user memilih modal-only demi kesederhanaan, tidak ada
  kebutuhan deep-link ke Draft Editor saat ini.

### Impact

- `product-discovery/04-ux/navigation-patterns.md` — NP-D02 ditandai
  dioverride, NP-D11 baru ditambahkan; pola "Item → Editor" dan "New Post
  CTA" direword ke modal; Ringkasan Pola diperbarui.
- `product-discovery/04-ux/key-screen-patterns.md` — KSP-05 Identitas +
  Tujuan diberi catatan modal; KSP-05-F10 direword jadi "Tutup Modal";
  KSP-05-F13 baru (Resume Unfinished Post, New Post saja); State Handling
  ditambah 2 baris baru; diagram Zona Fungsional diberi catatan modal.
- `product-discovery/06-engineering/monorepo-setup.md` — diagram App Router
  diperbarui: `[postId]` di `calendar`/`queue`/`drafts` dihapus dari
  diagram (digantikan modal state di `publish/layout.tsx`);
  `history/[postId]` (Post Detail) dibiarkan apa adanya, tidak termasuk.
- **Implementasi kode belum berjalan** — hanya dokumentasi + Design System
  yang selesai di ADR ini (lihat Next Tasks di `PROJECT_STATE.md`).

### Addendum (2026-07-30) — Design System (Claude Design) selesai

`templates/draft-editor.html` ditulis ulang jadi modal `Dialog
variant="fullscreen"` (fidelitas nilai diverifikasi via `astryx swizzle
Dialog` sementara — dibaca lalu dihapus segera, ADR-041) — sidebar/app-shell
dihapus total dari markup karena fullscreen menutupi seluruh viewport.
`components/dialog.html` ditambah contoh kedua: dialog "Resume unfinished
post?" (`purpose="required"`, khusus New Post). `styles.css` dapat 6 kelas
baru (`.dialog-fs` + `-header/-title/-actions/-body/-footer`), dianotasikan
ke `Dialog`/`DialogHeader`/`Layout`+`LayoutContent`+`LayoutFooter` asli.
`readme.md` diperbarui (tabel Components, Direction, Do, Files) untuk
mendokumentasikan pola baru ini.

**Catatan jujur, tidak didiamkan:** `templates/app-prototype/
AppPrototype.dc.html` (interactive runner) **belum** direwiring — Draft
Editor di prototype interaktif ini masih pindah halaman penuh, bukan modal.
Rewiring prototype + alur Resume Unfinished Post di dalamnya adalah
follow-up terpisah, dicatat di `readme.md` project Claude Design sendiri
maupun di sini supaya tidak dianggap sudah selesai.

### Addendum (2026-07-30) — App Prototype (interactive runner) direwiring, gap ditutup

`templates/app-prototype/AppPrototype.dc.html` diubah supaya Draft Editor
tidak lagi jadi entri `SCREENS` yang dinavigasi lewat iframe `src` — sekarang
di-inject sebagai overlay `.dialog-fs` langsung ke document layar aktif
(Calendar/Queue/Drafts), pola yang sama dengan dialog kecil (Schedule/
Publish Now/Disconnect) yang sudah lebih dulu dipakai di file ini, hanya di
skala fullscreen. Titik trigger (`+ New Post`, klik item Calendar/Queue,
item Today's Schedule di Home) diarahkan ke `triggerNewPost`/
`triggerEditDraft`, bukan `go('draft-editor')`.

**Resume Unfinished Post (New Post saja) diimplementasikan nyata di
prototype** — pakai `localStorage` browser (bukan sekadar mockup statis):
tutup New Post via tombol ✕ setelah mengetik caption → tersimpan sementara
→ buka "+ New Post" lagi → dialog "Resume unfinished post?" muncul dengan
isi yang diketik sebelumnya. Edit Draft sengaja tidak punya mekanisme ini
(perubahan hilang saat ditutup tanpa disimpan), sesuai keputusan ADR-052.

Role-based button visibility (Publish Now disembunyikan untuk Creator,
Schedule ↔ "Kirim untuk Review") dipindah dari logic berbasis
`this.screen === 'draft-editor'` menjadi diterapkan langsung ke tombol di
dalam overlay saat dirender. Dropdown "Screen" toolbar kehilangan entri
langsung "Draft Editor" (karena bukan lagi screen ber-route) — digantikan
opsi terpisah "KSP-05 · Draft Editor (modal preview)" yang membuka overlay
sebagai shortcut preview (melewati cek Resume, yang lebih pas didemokan
lewat tombol "+ New Post" sungguhan).

Sebelum push: skrip JS komponen (`Component extends DCLogic`) diekstrak dan
dicek dengan `node --check` untuk memastikan tidak ada syntax error, karena
frameworknya (`dc-runtime`, custom `<x-dc>` template) tidak bisa dijalankan
langsung di browser biasa di luar Claude Design untuk verifikasi visual
end-to-end. `readme.md` (How to Demo, Files) diperbarui mengikuti perilaku
baru ini — tidak ada lagi gap yang menggantung dari ADR-052.

### Addendum (2026-07-30) — Variant Dialog dibuka kembali untuk perbandingan (fullscreen vs standard)

User mengecek langsung di Claude Design dan melaporkan New Post/Edit Draft
**tidak terasa seperti pakai komponen Dialog/Modal** — terlihat seperti
halaman biasa, bukan overlay. Investigasi menemukan dua hal:

1. **Bug nyata:** implementasi sebelumnya tidak punya animasi buka sama
   sekali — Astryx Dialog asli punya animasi masuk (fade + scale-in
   ~300ms, diverifikasi via `astryx swizzle Dialog` sementara), tanpa itu
   modal "muncul begitu saja" dan terasa seperti pergantian halaman biasa.
   **Diperbaiki** — animasi ditambahkan ke `.dialog`, `.dialog-fs`, dan
   `.dialog-lg` sekaligus di `styles.css`.
2. **Keterbatasan desain yang sudah benar secara fidelitas, tapi tidak
   sesuai ekspektasi:** `Dialog variant="fullscreen"` milik Astryx memang
   **sengaja tidak punya backdrop gelap terlihat** (karena menutupi 100%
   viewport, tidak ada apa-apa di belakang untuk digelapkan) — beda dari
   dialog standar (Schedule/Publish Now) yang punya card mengambang +
   backdrop gelap jelas. Ini bukan bug implementasi, tapi trade-off nyata
   dari variant fullscreen itu sendiri.

**Keputusan user:** daripada memilih salah satu, tambahkan **toggle
Standard/Fullscreen** di `templates/draft-editor.html` dan App Prototype
(`AppPrototype.dc.html`) supaya kedua variant bisa dibandingkan langsung
oleh tim — **default "Standard"** (card besar mengambang + backdrop gelap,
`min(960px, 94vw)`, memakai header/body/footer yang sama dengan
fullscreen). Ini berarti **keputusan "fullscreen" di Decision ADR-052 di
atas tidak lagi final** — variant asli tetap didukung penuh (toggle-able),
tapi pilihan mana yang benar-benar dipakai di `apps/web` (Tahap 3) masih
menunggu keputusan tim setelah membandingkan keduanya.

Class baru: `.dialog-lg-backdrop` + `.dialog-lg` (menggunakan ulang
`.dialog-fs-header/-title/-actions/-body/-footer` yang sudah ada — bukan
duplikasi struktur). Di App Prototype, toggle live-update overlay yang
sedang terbuka tanpa kehilangan teks yang sudah diketik di Caption.
`readme.md` diberi section baru "Draft Editor — Dialog variant still being
compared" menjelaskan trade-off ini secara eksplisit, plus catatan "Don't
ship both variants to apps/web" — toggle ini alat perbandingan untuk fase
Design System, bukan untuk dibawa ke implementasi kode.

**Tidak lanjut ke Tahap 3** — user eksplisit meminta menunggu aba-aba
sebelum implementasi kode dimulai; keputusan final fullscreen vs standard
akan ditentukan sebelum atau saat Tahap 3 dimulai.

### Addendum (2026-07-30) — Koreksi: default dikembalikan ke Fullscreen, toggle dipindah ke dalam header

Addendum di atas (default "Standard") **dikoreksi** — user menegaskan tidak
pernah meminta perubahan _layout_ Draft Editor itu sendiri, hanya toggle
untuk membandingkan; membuat "Standard" jadi default secara tidak sengaja
mengubah tampilan yang sudah direview di Tahap 2 (fullscreen) tanpa
persetujuan eksplisit. Diperbaiki:

- **Default dikembalikan ke "Fullscreen"** — layout yang sudah di-approve
  sebelumnya, di kedua file (`templates/draft-editor.html`,
  `AppPrototype.dc.html`). Tidak ada yang berubah tampilannya kecuali user
  sengaja toggle ke Standard.
- **Toggle dipindah dari luar dialog (tombol floating/toolbar terpisah)
  menjadi bagian dari header dialog itu sendiri** — persis di baris yang
  sama dengan status chip, di sebelah kiri tombol Close (✕):
  `[status chip] [toggle Fullscreen/Standard] [✕ Close]`. Baik di
  `templates/draft-editor.html` maupun `AppPrototype.dc.html` (via
  `data-proto="draft-toggle-variant"` di `.dialog-fs-actions`/
  `buildDraftEditorMarkup`).
- `readme.md` diperbarui mengikuti posisi & default baru ini.

Diverifikasi ulang secara visual di browser lokal sebelum push (toggle di
kedua posisi header berfungsi, kedua varian tampil benar).

### Addendum (2026-07-30) — Root cause ditemukan: CSS Draft Editor tidak ikut ter-inject, bug `.media-thumb` hilang

User melaporkan Media (drop zone) dan Account Selector (checkbox akun)
tampil "berubah, tidak sesuai keinginan, di awal tidak seperti ini" —
khususnya lewat App Prototype. Investigasi (dibantu agent riset read-only)
menemukan **dua root cause berbeda**, keduanya nyata:

1. **CSS page-specific Draft Editor cuma ada di `<style>` lokal
   `templates/draft-editor.html`** (`.editor-grid`, `.ai-trigger`,
   `.media-drop`, `.media-thumb`, `.acc-row`(`.disconnected`),
   `.acc-row-top`, `.fmt-row` (+`label`), `.reconnect-link`, `.sched-row`)
   — **tidak pernah ada di `styles.css` bersama**. Karena App Prototype
   meng-inject markup Draft Editor ke DALAM document screen lain (misal
   `publish-drafts.html`, yang hanya link `../styles.css` tanpa `<style>`
   lokal tambahan), semua class itu jadi tidak ter-style sama sekali saat
   dilihat lewat App Prototype — cocok persis dengan gejala yang
   dilaporkan user.
2. **Bug markup terpisah:** `<div class="media-thumb">preview media
4:3</div>` (kotak preview media) **hilang** dari
   `buildDraftEditorMarkup` di `AppPrototype.dc.html` sejak rewrite
   pertama App Prototype — tidak pernah ada di jalur itu sama sekali,
   berbeda dari `templates/draft-editor.html` yang selalu punya elemen
   ini.

**Perbaikan:**

- Semua class Draft Editor di atas **dipindah dari `<style>` lokal
  `templates/draft-editor.html` ke `styles.css`**, section "App patterns"
  (mengikuti pola `.cal-grid`/`.queue-row`/`.inbox-shell` yang sudah lebih
  dulu ada di situ untuk screen lain). Nilai px dipertahankan **persis
  sama** dengan yang lama (bukan didekati ke token terdekat) supaya tidak
  ada pergeseran visual sekecil apa pun.
- `templates/draft-editor.html` — `<style>` lokal dihapus total, sekarang
  murni mengandalkan `../styles.css`.
- `AppPrototype.dc.html` — `<div class="media-thumb">preview media
4:3</div>` ditambahkan kembali ke `buildDraftEditorMarkup`, persis di
  posisi yang sama (setelah `.media-drop`) seperti di
  `templates/draft-editor.html`.
- `readme.md` — ditambah aturan eksplisit "Do"/"Don't" baru: setiap class
  page-specific wajib di `styles.css`, tidak boleh di `<style>` lokal per
  halaman, walau cuma dipakai satu screen — supaya pola bug yang sama
  tidak terulang untuk screen lain di masa depan.

**Verifikasi:** dibuat simulasi lokal — document HTML terpisah yang HANYA
link `../styles.css` (meniru `publish-drafts.html`), lalu markup Draft
Editor di-inject via JS persis seperti App Prototype. Sebelum fix: Media
drop zone dan Account Selector tampil polos tanpa styling. Setelah fix:
render benar (border, radius, warna, spacing semua sesuai). Diverifikasi
juga `templates/draft-editor.html` standalone tetap benar tanpa `<style>`
lokal.

### Addendum (2026-07-30) — Governance: skill "Scope Discipline" dibuat dari insiden default toggle

User melaporkan retrospektif (via sesi terpisah): saat AI diminta menambah
toggle Fullscreen/Standard (addendum "Variant Dialog dibuka kembali"),
toggle-nya benar dan berfungsi, **tapi AI diam-diam mengubah default
tampilan dari Fullscreen ke Standard** sebagai bagian dari implementasi —
padahal permintaan user cuma "tambahkan alat pembanding", bukan "ganti
tampilan aktif". Karena Standard vs Fullscreen berbeda struktur (card
mengambang vs full-viewport), semua elemen di dalamnya (termasuk Media
drop zone dan Account Selector) ikut terlihat berubah layout padahal class
CSS-nya sendiri tidak disentuh. Insiden ini sudah dikoreksi sebelumnya
(lihat addendum "Koreksi: default dikembalikan ke Fullscreen" di atas),
tapi belum pernah dijadikan aturan pencegahan permanen.

**Tindakan pencegahan:**

- Skill baru `.claude/skills/claude-design-scope-discipline/SKILL.md` —
  aturan wajib: (1) jangan mengubah default/state yang sudah disetujui
  user sebagai efek samping fitur baru; (2) sebelum eksekusi yang scope-nya
  ambigu, nyatakan ringkas apa yang berubah vs tetap sama; (3) kalau
  ambigu, tanya dulu (`proactive-clarification`); (4) definisi selesai
  mencakup "tidak ada side-effect tak diminta pada tampilan/behavior
  existing", bukan cuma "fitur baru berfungsi".
- `context/ctx-design.md` — Aturan operasional #10 baru, menunjuk ke skill
  di atas; dibaca setiap task UI/desain (termasuk Claude Design) via
  mapping table `AGENTS.md`.
- `AGENTS.md` — Aturan keras #13 baru (entry point wajib dibaca tiap sesi
  oleh AI apapun yang bekerja di repo ini), menunjuk ke skill yang sama.

**Alasan penempatan:** hanya Claude Code yang punya akses tool `DesignSync`
untuk mengubah Claude Design, sehingga aturan detailnya ditempatkan sebagai
skill khusus (auto-discoverable berdasarkan konteks tugas) dan di
`ctx-design.md` (dibaca spesifik untuk task UI/desain) — bukan sebagai
general rule di `PROJECT_RULES.md` yang scope-nya lebih luas dari yang
dibutuhkan. `AGENTS.md` tetap diberi satu baris pointer karena berfungsi
sebagai entry point yang wajib dibaca duluan oleh AI apapun (bukan
duplikasi isi, cuma penunjuk).

---
