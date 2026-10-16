## Decision ADR-094

### Title

Perluasan Supabase Realtime ke `publishing_posts` — Calendar/Queue/Drafts/History, Granular Client-Side Patch

### Status

Accepted

### Date

2026-08-28

### Context

King Rezi ingin kolaborasi tim ala Buffer: user A membuat/mengubah draft atau
schedule, user B (workspace sama) melihat perubahannya tanpa refresh manual.
Baseline saat ini (`realtime-strategy.md`, RT-D01/RT-D02) membatasi Supabase
Realtime **hanya** untuk tabel `notifications`; Calendar/Queue/Drafts/History
semuanya manual refresh.

**Dua temuan penting saat investigasi teknis:**

1. **Tidak ada Realtime subscription yang benar-benar hidup di aplikasi ini
   sekarang** — satu-satunya konsumen yang direncanakan (T-036, notification
   bell) statusnya masih `⏳ Not Started`. Helper bridge Better
   Auth↔Supabase JWT (`apps/web/src/lib/better-auth/supabase-jwt.ts`) sudah
   ada tapi **belum dipakai di kode manapun**. Fitur ini otomatis berbagi
   prasyarat yang sama dengan T-036, bukan berdiri sendiri.
2. Policy RLS existing (`{table}_workspace_isolation` via
   `current_setting('app.current_user_id')`, `database-strategy.md`) adalah
   pola **server-side** (service role) — **tidak berlaku** untuk koneksi
   Realtime client (anon key, butuh `auth.uid()`). Perlu policy tambahan.

King Rezi memutuskan scope-nya **4 screen** (Calendar, Queue, Drafts,
History — History belum dibangun, T-034 masih `⏳ Not Started`) dan
strategi update **granular client-side patch** (bukan full-page refresh),
demi UX responsif tanpa reset state lokal tiap screen (mis. expand/collapse
cell Calendar, filter aktif, scroll position). King Rezi juga memutuskan
T-036 **wajib selesai lebih dulu** sebagai hard dependency, bukan
"siapa duluan membangun wiring".

### Decision

1. **Amandemen RT-D01/RT-D02** (`realtime-strategy.md`): tabel
   `publishing_posts` ditambahkan sebagai target Supabase Realtime, khusus
   untuk 4 screen Publish — bukan aplikasi-wide, bukan tabel lain.
2. **Channel scope per-workspace** (beda dari `notifications` yang
   per-user): `Channel: publishing_posts:{workspaceId}`,
   `Table: publishing_posts`, `Event: INSERT, UPDATE` (tanpa `DELETE` — post
   pakai soft-delete via `deletedAt`, tercermin sebagai `UPDATE`),
   `Filter: workspace_id=eq.{workspaceId}`.
3. **RLS policy baru khusus Realtime**, terpisah dari policy server-side
   yang sudah ada — `publishing_posts_realtime_workspace_members`, berbasis
   `auth.uid()`, cek user adalah member `active` dari `workspace_id` baris
   tsb (pola sama semangat dengan RLS Policy Pattern di
   `database-strategy.md`, tapi varian `auth.uid()` bukan
   `current_setting`).

   > **Catatan implementasi (2026-09-11, T-092.1):** implementasi nyata di
   > migration `20260911090000_t092_1_publishing_posts_realtime_rls`
   > **tidak** memanggil fungsi `auth.uid()` Supabase secara langsung —
   > memakai `current_setting('request.jwt.claim.sub', true)` (dengan
   > fallback parse `request.jwt.claims`) untuk membaca klaim `sub` JWT
   > sebagai `text`. Root cause: `auth.uid()` bawaan Supabase melakukan cast
   > paksa `::uuid` terhadap klaim `sub`, sementara seluruh `user_id` di
   > sistem ini (termasuk `workspace_members.user_id`) adalah `cuid()`
   > string, bukan UUID valid — persis bug yang sudah ditemukan dan
   > diperbaiki di T-036 (`20260901120000_t036_fix_realtime_rls_cuid_cast`,
   > lihat juga preseden DO-D06/T-017 di `database-strategy.md`). T-092.1
   > menerapkan versi yang sudah diperbaiki sejak awal, tidak perlu migration
   > fix susulan. Poin keputusan di atas ("berbasis `auth.uid()`") tetap benar
   > secara _maksud_ (cek membership `active` untuk Realtime, bukan
   > `current_setting('app.current_user_id')` server-side) — catatan ini
   > murni koreksi detail cara membaca identitas user dari JWT, bukan
   > perubahan keputusan arsitektur.
   >
   > **Catatan implementasi (2026-09-11, T-092.4):** ditemukan gap
   > arsitektur RLS lintas-tabel yang belum tersentuh poin di atas —
   > policy `publishing_posts_realtime_workspace_members` (T-092.1)
   > melakukan subquery ke tabel `workspace_members` untuk cek membership,
   > tapi RLS `workspace_members` yang sudah ada sebelumnya
   > (`workspace_members_workspace_isolation`, pra-T-092) hanya mengenali
   > `current_setting('app.current_user_id')` (GUC session server-side) —
   > koneksi Realtime (anon key + JWT, tanpa GUC session) membuat
   > `workspace_members` tidak terlihat sama sekali oleh subquery tsb,
   > sehingga policy `publishing_posts` selalu mengembalikan `false`.
   > Gejalanya: channel `SUBSCRIBED` tanpa error, tapi event Realtime tidak
   > pernah sampai ke subscriber manapun — baru ketahuan saat verifikasi
   > cross-tab nyata di T-092.4 (Queue), setelah T-092.2/T-092.3 sempat
   > lolos verifikasi "token sukses + tanpa console error" yang ternyata
   > tidak cukup untuk menangkap bug ini.
   >
   > **Fix:** migration
   > `20260911100000_t092_4_fix_workspace_members_realtime_visibility`
   > menambah 1 policy PERMISSIVE tambahan di tabel `workspace_members`
   > (`workspace_members_realtime_own_row`, user hanya bisa lihat baris
   > membership-nya sendiri lewat klaim JWT) — **additive**, tidak
   > mengganti/menghapus policy `workspace_members_workspace_isolation`
   > yang sudah ada. Diverifikasi lewat simulasi query role
   > `authenticated` (transaksi ROLLBACK): user member workspace dapat
   > seluruh baris `publishing_posts` workspace-nya, negative control
   > (user id palsu) dapat 0 baris; dikonfirmasi ulang end-to-end nyata di
   > browser (2 tab, tanpa refresh) oleh Najwa QA Engineer — PASS untuk
   > Queue dan Calendar. Ini bukan perubahan keputusan arsitektur di poin
   > 3 (tetap RLS berbasis JWT untuk Realtime) — murni menutup gap yang
   > belum kepikiran saat poin 3 pertama ditulis (RLS antar-tabel yang
   > saling subquery butuh visibility yang konsisten di kedua tabel,
   > bukan cuma tabel utamanya). Dicatat di sini (bukan ADR baru) mengikuti
   > pola yang sama seperti catatan `auth.uid()`/cuid di atas.

4. **Depends on T-036 (hard dependency, bukan shared-whichever-first):**
   T-036 (notification bell) **wajib selesai lebih dulu** — wiring generic
   Supabase Realtime client + Better Auth↔Supabase JWT bridge dibangun di
   T-036, fitur ini murni **reuse**, tidak membangun ulang. Task baru dari
   ADR ini otomatis punya `Depends: T-036`.
5. **Strategi update: granular client-side patch.** Tiap 4 screen:
   - Menyimpan list datanya sendiri sebagai **client state** (diinisialisasi
     dari props Server Component awal) — perubahan pola dari "RSC-pure,
     tanpa state" ke "client state + Realtime patch".
   - Saat event Realtime masuk (`{postId, eventType}`), panggil fungsi
     "fetch record termapping" milik screen itu (reuse service layer yang
     sudah ada per screen — `PublishingService` method yang sesuai, 1 post
     saja, bukan refetch seluruh list).
   - **Upsert atau remove** ke local state berdasarkan apakah post itu
     masih cocok kriteria tampilan screen itu (mis. Queue cuma tampilkan
     `Scheduled` — kalau status berubah jadi `Published`, item **dihapus**
     dari local state Queue, bukan di-update jadi Published di situ).
   - Event dari perubahan milik user sendiri (echo) diproses sama seperti
     event orang lain — **tidak perlu deteksi/skip** "ini aksi saya
     sendiri", karena hasil fetch akan selalu konsisten dengan state
     optimistic yang sudah ada (idempoten).
6. **Subscription lifecycle per-screen** — dibuat saat screen di-mount
   (halaman dibuka), dilepas saat unmount/pindah halaman/workspace. Bukan
   global sepanjang sesi seperti notification bell (karena cuma 1 dari 4
   screen ini aktif dalam satu waktu di satu tab).
7. **History (T-034)**, karena belum dibangun, **wajib** menyertakan pola
   Realtime ini sejak desain awal — bukan ditambah belakangan (amandemen
   catatan pada T-034).

### Reason

- Data post kita sendiri adalah source of truth (konsisten dengan diskusi
  sebelumnya, ADR-093) — subscribe langsung ke `publishing_posts` valid
  tanpa bergantung Outstand.
- Granular patch dipilih King Rezi eksplisit meski lebih kompleks — full
  `router.refresh()` berisiko mereset state lokal tiap screen
  (expand/collapse Calendar, filter, dst.) yang sudah dibangun di T-033.
- RLS baru berbasis `auth.uid()` wajib karena konteks Realtime client (anon
  key) secara fundamental beda dari server-side query (service role) —
  bukan pilihan, tapi keharusan teknis Supabase.
- Hard dependency ke T-036 (bukan jalan paralel) dipilih King Rezi untuk
  urutan yang lebih runut — T-036 scope-nya lebih kecil dan sudah ada di
  backlog, wiring generic-nya established di situ dulu.
- Channel per-workspace (bukan per-user) sesuai sifat kolaboratif fitur ini
  — semua anggota workspace perlu tahu perubahan, bukan cuma pemilik post.

### Alternatives Considered

- **Full refresh via `router.refresh()`** — ditolak; King Rezi pilih
  granular demi UX, walau lebih kompleks untuk diimplementasikan.
- **Scope Calendar saja** — ditolak; King Rezi eksplisit ingin keempat
  screen (Calendar/Queue/Drafts/History) konsisten.
- **Global subscription 1 channel untuk seluruh app** (bukan per-screen) —
  ditolak; cukup per-screen karena hanya 1 dari 4 screen aktif dalam satu
  waktu di satu tab, subscription global menambah kompleksitas tanpa
  manfaat nyata.
- **Reuse RLS policy server-side yang sudah ada untuk Realtime** — ditolak;
  secara teknis tidak bisa (`current_setting` tidak pernah ter-set di
  koneksi client), butuh policy baru berbasis `auth.uid()`.
- **Deteksi & skip event echo milik sendiri** — ditolak; fetch-and-patch
  idempoten sudah cukup, deteksi echo nambah kompleksitas tanpa manfaat
  signifikan.
- **Fitur ini jalan duluan, membangun wiring JWT bridge generic-nya
  sendiri** — ditolak; King Rezi pilih urutan yang lebih runut (T-036 dulu,
  scope-nya lebih kecil dan sudah ada di backlog), fitur ini reuse
  belakangan.

### Impact / Baseline yang diamandemen

- `realtime-strategy.md` — RT-D01 (scope Realtime) dan RT-D02 (Calendar
  manual refresh) diamandemen: `publishing_posts` jadi target Realtime
  kedua setelah `notifications`, khusus 4 screen Publish.
- `database-strategy.md` — RLS Policy Pattern bertambah 1 varian
  (`auth.uid()`-based, khusus Realtime), didokumentasikan sebagai contoh
  policy tambahan untuk `publishing_posts`.
- `auth-architecture.md` — dependency implementasi bridge Better
  Auth↔Supabase JWT jadi prasyarat aktif (sebelumnya cuma direncanakan
  untuk T-036, sekarang dipakai 2 fitur, tapi tetap dibangun sekali di
  T-036).
- `v02-publishing-mvp.md` (T-034, History) — wajib menyertakan Realtime
  sejak desain awal, dicatat sebagai amandemen catatan task.
- Task baru akan ditulis ke `TASKS.md` + `tickets/v02-publishing-mvp.md`
  setelah ADR ini dikonfirmasi — `Depends: T-036` (hard dependency), dan
  UI-nya (indikator "live update" kalau ada) tetap kena gate rule 17 kalau
  ada elemen visual baru.

---
