## Decision ADR-089

### Title

Amandemen ADR-088 — Dialog Konfirmasi Tier 2 Sebelum Switch Workspace

### Status

Accepted

### Date

2026-08-24

### Context

ADR-088 (Accepted, hari yang sama) menetapkan mekanisme switch workspace
di halaman baru Settings → Account → Workspaces: klik row workspace lain
→ (a) validasi ulang membership, (b) overwrite cookie
`active-workspace-id`, (c) redirect Home — **tanpa** langkah konfirmasi
apa pun di antaranya (lihat ADR-088 poin 2 dan 4). Subtask kode T-089.1–.5
yang mengimplementasikan mekanisme itu sudah selesai dan lolos review
arsitektur Ridwan + QA Najwa sebelum amandemen ini dibuat.

Setelah T-089.1–.5 ditutup `✅ Done`, King Rezi mengubah rancangan
`settings-workspaces.html` di Claude Design (project "Social Media
Management") — mencatat di `readme.md` project tersebut bahwa kolom
ketiga di `components/dialog.html` (pola Tier 2 / `AlertDialog`, sudah
dipakai untuk Logout dan Remove Member) dipakai ulang tanpa variant baru
untuk konfirmasi Switch Workspace: klik row workspace sekarang membuka
dialog "Pindah ke workspace [nama]?" dengan pilihan Batal/Pindah,
alih-alih langsung mengeksekusi switch.

Kode `apps/web/src/app/(app)/settings/account/workspaces/components/WorkspacesSettingsView.tsx`
diselaraskan mengikuti perubahan rancangan ini pada sesi yang sama, sebelum
governance dokumentasi (ADR ini) ditulis — bukan usulan yang menunggu
persetujuan lebih lanjut. Perubahan kedua yang menyertainya (`Density`
List `balanced` → `spacious`, murni visual/spacing, tidak berdampak
behavior) tidak dianggap keputusan material dan tidak dicatat sebagai
bagian dari ADR ini — cukup dicatat sebagai catatan teknis di
`tickets/v01-foundation.md` § T-089.

**Koreksi penomoran subtask:** rancangan di Claude Design mencatat label
"T-016.6" untuk perubahan ini. Dicek terhadap `tickets/v01-foundation.md`:
T-016 ("Account & user settings screens") hanya berisi subtask sampai
T-016.5 (Dialog konfirmasi Logout) — tidak ada T-016.6 di manapun. Label
itu kemungkinan keliru penomoran oleh King Rezi saat mengedit catatan
desain, bukan referensi ke task yang benar-benar ada. Secara substansi,
perubahan ini adalah bagian dari fitur Workspace Switcher (T-089, ADR-088)
yang sudah `✅ Done`, bukan bagian T-016 (yang temanya Logout/Account
settings secara umum). Diputuskan: dicatat sebagai **T-089.6**, subtask
baru di bawah T-089 — konsisten dengan konvensi ID subtask project
(`T-NNN.M`) dan dengan isi task yang memang membahas mekanisme switch
workspace itu sendiri.

### Decision

1. **Mekanisme switch workspace diamandemen** dari "klik row → langsung
   overwrite cookie + redirect" (ADR-088 poin 2 & 4, versi awal) menjadi
   "klik row → buka dialog konfirmasi Tier 2 → overwrite cookie + redirect
   hanya setelah user mengonfirmasi". Validasi ulang membership (poin (a)
   ADR-088 poin 4) tetap terjadi sebelum switch benar-benar dieksekusi,
   tidak berubah.
2. **Dialog konfirmasi mereuse pola `AlertDialog` Tier 2 yang sudah ada**
   di codebase (Logout — T-016.5, Remove Member) — bukan komponen atau
   variant baru:
   - Title dinamis: `"Pindah ke workspace [nama]?"` (nama workspace
     tujuan disisipkan runtime).
   - Description: `"Anda akan keluar dari workspace saat ini dan
berpindah konteks kerja."`
   - `cancelLabel="Batal"`, `actionLabel="Pindah"`.
   - `actionVariant="primary"` — **bukan** `destructive`, karena switch
     workspace bersifat non-destruktif dan reversible (user bisa switch
     balik kapan saja); berbeda dari Delete Workspace/Remove Member yang
     memang destruktif.
3. **Dicatat sebagai subtask baru T-089.6** di bawah task T-089 (Workspace
   Switcher deliberate) di `tickets/v01-foundation.md` — bukan T-016.6.
   T-089 tetap `✅ Done` (subtask tambahan pada task yang sudah selesai,
   bukan reopen status task).
4. Perubahan `Density` List (`balanced` → `spacious`) di halaman yang sama
   **tidak** termasuk keputusan material ADR ini — murni penyesuaian
   visual/spacing tanpa dampak behavior, dicatat sebagai catatan teknis
   saja di `tickets/v01-foundation.md`.

### Reason

- **Kenapa perlu ADR baru, bukan cukup update T-089.6 di `tickets/`:**
  ADR-088 (append-only) sudah menyatakan eksplisit "tanpa konfirmasi apa
  pun" sebagai bagian dari Decision-nya (poin 2 & 4) — kontradiksi itu
  material terhadap keputusan arsitektur/UX yang sudah Accepted, sehingga
  butuh amandemen resmi mengikuti pola append-only (ADR baru menunjuk balik
  ke ADR lama), bukan sekadar dianggap detail implementasi.
- **Kenapa Tier 2 (bukan Tier 1) dan `actionVariant="primary"`:** mengikuti
  kerangka ADR-049 (Safety Check / Double Confirmation) — kriteria wajib
  konfirmasi destruktif (irreversibel/blast radius luas) tidak terpenuhi
  di sini; switch workspace mudah dibalik (switch lagi ke workspace
  semula). King Rezi tetap memutuskan menambahkan gate konfirmasi (Tier 2)
  murni untuk mencegah salah klik yang mengubah konteks kerja secara tidak
  sengaja — bukan karena aksinya berbahaya, tapi karena mengganggu jika
  tidak disengaja.
- **Kenapa T-089.6, bukan T-016.6:** T-016 sudah berhenti di subtask .5
  dan bertema Account/user settings screens secara umum (Layout,
  Profile, Preferences, Notifications yang di-defer, Logout) — bukan
  tempat yang tepat untuk perubahan mekanisme Workspace Switcher yang
  memang lahir dari task terpisah (T-089/ADR-088). Menaruhnya di T-089
  menjaga satu sumber kebenaran untuk seluruh riwayat fitur ini.

### Alternatives Considered

- **Ikuti label "T-016.6" apa adanya dari catatan Claude Design** —
  ditolak; T-016 di `tickets/v01-foundation.md` tidak punya subtask itu, dan
  isinya (Logout/Account settings umum) tidak sesuai substansi perubahan
  ini (mekanisme switch workspace, bagian T-089).
- **Anggap perubahan ini sebagai detail implementasi T-089.3 yang
  diperbarui, tanpa subtask/ADR baru** — dipertimbangkan karena T-089.3
  memang sudah membahas "row klik untuk switch", tapi ditolak karena
  perubahan ini mengubah keputusan Decision ADR-088 (poin 2 & 4) yang
  sudah Accepted — perlu jejak amandemen resmi, bukan diam-diam ditimpa di
  deskripsi subtask lama.
- **Catat sebagai bagian ADR-088 langsung (edit isi ADR-088)** — ditolak
  karena `DECISIONS.md` append-only; ADR-088 sudah Accepted sebelum
  perubahan ini muncul.

### Impact / Baseline yang diamandemen

- **`project-os/decisions/ADR-088-amandemen-adr-076-workspace-switcher-deliberate-via-settings-account-workspaces.md`**
  — header `### Status` ditambah catatan `Accepted — Amended by ADR-089
(2026-08-24)`, dilakukan bersamaan dengan pembuatan ADR ini. Isi body
  (Decision poin 2 & 4) **tidak diedit** (append-only) — pembaca perlu
  membaca ADR-089 ini untuk tahu mekanismenya sudah berubah.
- `apps/web/src/app/(app)/settings/account/workspaces/components/WorkspacesSettingsView.tsx`
  — sudah diselaraskan (dialog konfirmasi Tier 2 + density `spacious`)
  sebelum ADR ini ditulis; tidak ada perubahan kode lanjutan dari ADR ini
  sendiri, murni governance dokumentasi menyusul.
- `project-os/tickets/v01-foundation.md` § T-089 — subtask baru
  **T-089.6** ditambahkan (checked, sudah diverifikasi), body task
  diperbarui (gap description, koreksi mekanisme, acceptance T-089.3,
  Status/Terkait/ADR field) agar tidak lagi menyiratkan switch langsung
  tanpa konfirmasi.
- `project-os/TASKS.md` — total subtask terdefinisi naik dari 147
  jadi 148 (dihitung ulang dari `tickets/vXX-*.md`, bukan increment manual),
  breakdown v0.1 58 → 59 subtask; catatan "Fokus sekarang" untuk T-089
  diperbarui menyebut T-089.6.
- `project-os/PROJECT_STATE.md` — Known Issue baru **KI-034** (QA
  Najwa belum retest golden path switch dengan dialog konfirmasi baru);
  Completed (Ringkasan) diperbarui.
- **Tidak diubah oleh ADR ini** (di luar cakupan, ditangani terpisah oleh
  main agent sesuai pembagian kerja sesi ini):
  `product-discovery/05-architecture/auth-architecture.md` — baris yang
  menjelaskan mekanisme switch (section Workspace Context/Onboarding
  Flow) masih perlu diperbarui menyebut gate dialog konfirmasi ini;
  ditunda ke sesi/agent lain supaya tidak race condition dengan penulisan
  ADR ini.

---
