## Decision ADR-047

### Title

Publish Now — Fitur Resmi Publish Langsung Tanpa Jadwal

### Status

Accepted — Amended by ADR-074 (2026-08-07, role Manager dihapus, struktur jadi 3 role Owner/Admin/Creator)

### Date

2026-07-29

### Context

Audit konsistensi dokumentasi (dipicu saat memperbarui App Prototype Claude
Design) menemukan `application-layer.md` sudah menyebut method
`publishNow` ("Publish langsung tanpa jadwal") di tabel `PublishingService`
— tetapi UX Baseline (`key-screen-patterns.md` KSP-05) dan
`roles-permissions.md` (tabel transisi status) sama sekali tidak memiliki
konsep ini. KSP-05 hanya mendefinisikan "Schedule Action" (KSP-05-F09), dan
tabel transisi status hanya mengenal `Scheduled → Published` sebagai
transisi otomatis sistem — tidak ada jalur `Draft → Published` langsung.

### Decision

1. **Publish Now diangkat menjadi fitur UX resmi**, bukan sekadar method
   arsitektur yang menggantung tanpa desain UI:
   * `key-screen-patterns.md` — KSP-05 mendapat function ID baru
     **KSP-05-F12 (Publish Now Action)**: eksekusi publish langsung tanpa
     jadwal, tombol tersedia berdampingan dengan Schedule Action di action
     bar Draft Editor.
   * `mvp-definition.md` — bullet baru di bagian Publishing Must Have.
   * `information-architecture.md` — Publish Now ditambahkan ke hierarki
     layar Draft Editor dan tabel pemetaan fitur MVP.
2. **Akses Publish Now dibatasi identik dengan Schedule**: Owner, Admin,
   Manager — **bukan** tingkat akses baru yang lebih ketat, dan **bukan**
   dibuka lebih lebar dari Schedule. Creator tidak melihat/tidak bisa
   memicu aksi ini.
   * `roles-permissions.md` — baris baru di tabel transisi status:
     `Draft → Published (Publish Now, skip jadwal)`: Owner ✅, Admin ✅,
     Manager ✅, Creator ❌, Sistem —. Baris ringkasan "Jadwalkan/publish
     konten" diberi catatan eksplisit bahwa ini mencakup Publish Now.
3. `application-layer.md` — baris `publishNow` diperjelas: merujuk
   KSP-05-F12, RBAC sama dengan `schedulePosts`, dan tetap wajib validasi
   matriks `ContentFormat` per target (ADR-039) sebelum memanggil Outstand.
4. UI wajib menampilkan **konfirmasi eksplisit** sebelum eksekusi Publish
   Now (selaras **UXP-04** — *"Konfirmasi akun dan jadwal harus jelas dan
   tidak bisa diabaikan sebelum publish"*) — karena aksi ini langsung
   tayang tanpa jeda koreksi seperti `cancelSchedule` pada Schedule biasa.
   UXP-06 (Status Jelas, Proses Ringan) justru prinsip yang membenarkan
   aksi *lain* yang reversibel (Save as Draft, Kirim untuk Review) **tidak**
   memerlukan konfirmasi tambahan — bukan dasar syarat konfirmasi di sini.

### Reason

* Pola akses yang **sudah ada** di `roles-permissions.md` selalu
  menyatukan Schedule dan Publish dalam satu tingkat akses yang sama
  (baris ringkasan "Jadwalkan/publish konten"; transisi
  `Ready to Schedule → Scheduled` dan `Draft → Scheduled (skip review)`
  sama-sama Owner/Admin/Manager, Creator ❌) — menyamakan Publish Now ke
  tingkat akses ini konsisten dengan pola yang sudah berlaku, bukan aturan
  baru yang asing.
* Membiarkan `publishNow` hanya disebut di layer arsitektur tanpa desain
  UX resmi berisiko diimplementasikan tanpa RBAC yang jelas, atau
  terlewat sepenuhnya karena tidak ada di KSP manapun.

### Alternatives Considered

* **Hapus `publishNow` dari `application-layer.md`** (turunkan arsitektur
  ke level UX yang sudah ada, publish langsung cukup lewat Schedule
  Picker dengan waktu = sekarang) — awalnya direkomendasikan sebagai opsi
  paling minim perubahan, **ditolak** oleh user: Publish Now dianggap
  cukup bernilai untuk diangkat jadi fitur resmi dengan tombol
  tersendiri, bukan disamarkan sebagai kasus khusus Schedule.
* **Akses lebih ketat — hanya Owner dan Admin** (mengecualikan Manager,
  dengan alasan Publish Now lebih berisiko/tanpa jeda koreksi dibanding
  Schedule) — **ditolak**; akan menciptakan tingkat akses baru untuk aksi
  konten yang belum pernah ada sebelumnya di `roles-permissions.md`
  (semua aksi konten selama ini konsisten Owner/Admin/Manager vs
  Creator). Konsistensi dengan pola yang ada dinilai lebih penting
  daripada mitigasi risiko tambahan untuk kasus ini.

### Impact

* Dokumentasi baseline (`mvp-definition.md`, `key-screen-patterns.md`,
  `information-architecture.md`, `roles-permissions.md`,
  `application-layer.md`) sudah diselaraskan pada tanggal keputusan ini.
* **Implementasi belum berjalan** — baik di kode (`PublishingService`
  belum punya `publishNow` nyata, baru nama method di dokumen arsitektur)
  maupun di App Prototype Claude Design (Draft Editor baru punya
  Save as Draft + Schedule). Keduanya adalah task lanjutan terpisah,
  bukan bagian dari ADR ini.

---
