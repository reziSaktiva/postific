# Roles & Permissions

Dokumen ini mendefinisikan sistem peran dan hak akses pada produk **Postific**.

Setiap role merepresentasikan tanggung jawab nyata dalam sebuah tim, bukan abstraksi teknis semata. Dokumen ini menjadi acuan wajib untuk UX Planning, System Architecture, dan Engineering Planning — terutama saat mendefinisikan alur kolaborasi, visibilitas konten, dan kendali akses fitur.

Dokumen ini adalah **addendum dari Product Baseline v1.0** (ADR-012), direvisi oleh **ADR-074** yang mengurangi struktur role dari 4 menjadi 3.

---

# Overview

Produk mendukung kolaborasi tim dalam satu Workspace. Setiap anggota memiliki satu role yang menentukan apa yang dapat mereka lihat, buat, dan lakukan.

Pendekatan roles ini mengikuti prinsip **visibilitas tanpa birokrasi** (UXP-06): setiap anggota tim dapat melihat status pekerjaan, tetapi kontrol akses dirancang proporsional dengan kebutuhan koordinasi MVP — bukan enforcement workflow berlapis.

Produk memiliki **3 role**: Account Owner, Admin, Creator (ADR-074 — sebelumnya 4 role dengan role tambahan "Manager" yang dihapus karena tanggung jawab operasionalnya digabung ke Creator).

---

# Roles

## Account Owner

Pemilik workspace. Role ini dipegang oleh orang yang mendaftarkan workspace ke platform — biasanya pimpinan tim, founder, atau account lead.

**Karakteristik:**
- Hanya ada satu Account Owner per workspace.
- Account Owner tidak bisa dihapus oleh Admin atau Member lain.
- Ownership bisa ditransfer ke Admin lain — proses **dua langkah**: Account Owner
  memicu transfer, Admin target harus menerima (`acceptOwnershipTransfer`)
  sebelum role benar-benar bertukar; bukan swap langsung sepihak
  (ADR-050).

**Hak Akses:**

| Area | Hak Akses |
| ---- | --------- |
| Organization Settings | Baca, ubah, hapus workspace |
| Billing & Subscription | Penuh (upgrade, downgrade, batalkan) |
| Connected Accounts | Tambah, hapus, kelola semua akun media sosial |
| Members | Undang, hapus, ubah role semua anggota |
| Brand Settings | Baca dan ubah |
| Content | Buat, edit, hapus, jadwalkan, publish semua konten |
| Analytics | Akses penuh |
| Engagement (Comments Inbox) | Baca dan balas semua komentar |
| Audit Logs | Baca |
| Transfer Ownership | Ya |

---

## Admin

Admin adalah kepercayaan Account Owner. Role ini cocok untuk manajer senior atau orang kedua yang perlu menjalankan operasional workspace secara penuh tanpa hak untuk menghapus workspace atau mentransfer kepemilikan.

**Karakteristik:**
- Workspace bisa memiliki lebih dari satu Admin.
- Admin tidak bisa mengubah role Account Owner atau menghapus Account Owner dari workspace.

**Hak Akses:**

| Area | Hak Akses |
| ---- | --------- |
| Organization Settings | Baca dan ubah (tidak bisa hapus workspace) |
| Billing & Subscription | Baca (tidak bisa ubah plan) |
| Connected Accounts | Tambah, hapus, kelola semua akun media sosial |
| Members | Undang, hapus, ubah role (kecuali role Account Owner) |
| Brand Settings | Baca dan ubah |
| Content | Buat, edit, hapus, jadwalkan, publish semua konten |
| Analytics | Akses penuh |
| Engagement (Comments Inbox) | Baca dan balas semua komentar |
| Audit Logs | Baca |
| Transfer Ownership | Tidak |

---

## Creator

Creator adalah operator konten — mencakup pembuatan draft **dan** eksekusi jadwal/publish, tanpa akses administrasi workspace. Role ini cocok untuk Content Creator, Social Media Manager harian, Copywriter, atau Social Media Specialist yang bertanggung jawab penuh atas siklus konten dari draft sampai tayang.

**Karakteristik:**
- Workspace bisa memiliki lebih dari satu Creator.
- Creator bisa melihat **semua** konten di workspace (bukan cuma miliknya sendiri) — diperlukan untuk menjalankan jadwal dan queue tim secara efektif.
- Creator bisa membuat, edit, jadwalkan, dan mempublish konten (termasuk **Publish Now**, ADR-047) — tidak lagi dibatasi hanya ke konten sendiri seperti pada struktur role sebelumnya.
- Creator tidak memiliki akses ke Members, Billing, Organization Settings, atau Audit Logs.

**Hak Akses:**

| Area | Hak Akses |
| ---- | --------- |
| Organization Settings | Tidak ada akses |
| Billing & Subscription | Tidak ada akses |
| Connected Accounts | Baca saja (melihat akun yang tersedia) |
| Members | Tidak ada akses |
| Brand Settings | Baca saja |
| Content | Buat, edit, hapus, jadwalkan, publish semua konten |
| Analytics | Baca penuh |
| Engagement (Comments Inbox) | Baca dan balas semua komentar |
| Audit Logs | Tidak ada akses |
| Transfer Ownership | Tidak |

---

# Ringkasan Hak Akses per Role

| Kemampuan | Account Owner | Admin | Creator |
| --------- | -------------- | ----- | ------- |
| Hapus workspace (wajib konfirmasi Tier 1, ADR-049) | ✅ | ❌ | ❌ |
| Transfer ownership (wajib konfirmasi Tier 1, ADR-049) | ✅ | ❌ | ❌ |
| Kelola billing | ✅ | 👁 | ❌ |
| Kelola Organization Settings | ✅ | ✅ | ❌ |
| Undang/hapus member (hapus wajib konfirmasi Tier 2, ADR-049) | ✅ | ✅ | ❌ |
| Ubah role member (wajib konfirmasi Tier 2, ADR-049) | ✅ | ✅ (kecuali Account Owner) | ❌ |
| Tambah/hapus connected accounts (hapus wajib lewat Disconnect Confirmation, ADR-048) | ✅ | ✅ | ❌ |
| Buat/edit konten | ✅ | ✅ | ✅ |
| Jadwalkan/publish konten (termasuk Publish Now, ADR-047) | ✅ | ✅ | ✅ |
| Akses Analytics penuh | ✅ | ✅ | ✅ |
| Kelola Engagement Comments Inbox | ✅ | ✅ | ✅ |
| Baca Audit Logs | ✅ | ✅ | ❌ |

**Legenda:** ✅ Ya &nbsp; ❌ Tidak &nbsp; 👁 Baca saja

---

# Content Status — Set Kanonikal

Berikut adalah daftar status konten yang berlaku di seluruh produk. Set ini adalah **satu-satunya acuan status kanonikal** — semua dokumen UX dan implementasi harus merujuk ke daftar ini.

| Status | Deskripsi |
| ------ | --------- |
| `Draft` | Konten sedang dibuat atau diedit. Belum siap untuk ditinjau atau dijadwalkan. |
| `In Review` | Creator telah menandai konten sebagai siap ditinjau. Menunggu konfirmasi dari Admin/Account Owner (opsional — bisa dilewati). |
| `Ready to Schedule` | Konten telah disetujui secara informal. Siap dijadwalkan. |
| `Scheduled` | Konten telah memiliki waktu tayang. Sistem akan mempublikasikannya secara otomatis. |
| `Published` | Konten telah berhasil dipublikasikan ke platform media sosial. |
| `Failed` | Konten gagal dipublikasikan. Membutuhkan tindakan manual untuk diperbaiki atau dijadwalkan ulang. |

**Catatan penting:** `In Review` dan `Ready to Schedule` adalah status koordinasi yang ringan — bukan enforcement approval workflow berlapis (UXP-06). Karena Creator sekarang bisa menjadwalkan sendiri, siapa pun (Account Owner/Admin/Creator) dapat melewati `In Review`/`Ready to Schedule` dan menjadwalkan konten langsung dari `Draft` jika konteks tim mengizinkan.

---

# Aturan Transisi Status per Role

Tabel berikut mendefinisikan siapa yang dapat memicu setiap transisi status konten.

| Transisi | Account Owner | Admin | Creator | Sistem |
| -------- | -------------- | ----- | ------- | ------ |
| (baru) → `Draft` | ✅ | ✅ | ✅ | — |
| `Draft` → `In Review` | ✅ | ✅ | ✅ | — |
| `In Review` → `Draft` | ✅ | ✅ | ✅ | — |
| `In Review` → `Ready to Schedule` | ✅ | ✅ | ✅ | — |
| `Ready to Schedule` → `Scheduled` | ✅ | ✅ | ✅ | — |
| `Draft` → `Scheduled` (skip review) | ✅ | ✅ | ✅ | — |
| `Draft` → `Published` (**Publish Now**, skip jadwal) | ✅ | ✅ | ✅ | — |
| `Scheduled` → `Draft` (tarik jadwal) | ✅ | ✅ | ✅ | — |
| `Scheduled` → `Published` | — | — | — | ✅ otomatis |
| `Scheduled` → `Failed` | — | — | — | ✅ otomatis |
| `Failed` → `Draft` | ✅ | ✅ | ✅ | — |

**Catatan:**
- Semua transisi yang memerlukan role tertentu membutuhkan login dengan role tersebut — bukan pemeriksaan manual.
- Semua role (Account Owner, Admin, Creator) memiliki hak yang sama untuk transisi status konten — tidak ada lagi role yang dibatasi hanya "In Review" seperti pada struktur 4-role sebelumnya.
- Transisi `Scheduled → Published` dan `Scheduled → Failed` sepenuhnya otomatis oleh sistem — tidak ada user action yang diperlukan.
- **Publish Now (ADR-047):** `Draft → Published` langsung (melewati `In Review`/`Ready to Schedule`/`Scheduled`) dibatasi ke role yang **sama persis** dengan Schedule (Account Owner/Admin/Creator) — bukan tingkat akses baru yang lebih ketat. Ini konsisten dengan baris "Jadwalkan/publish konten" di tabel ringkasan hak akses di atas. Publish Now lebih berisiko daripada Schedule (langsung tayang, tanpa jeda `cancelSchedule` untuk koreksi) sehingga UI wajib menampilkan konfirmasi eksplisit sebelum eksekusi (selaras UXP-06).

---

# Mapping ke Personas

Dokumen ini dapat ditelusuri ke User Discovery Baseline v1.0 melalui pemetaan persona berikut.

| Persona | Role di Platform | Catatan |
| ------- | ---------------- | ------- |
| Maya — Marketing Manager | Admin atau Account Owner | Buyer; visibility tinggi, jarang buat konten langsung |
| Raka — Social Media Manager | Creator | Primary daily user; operator publishing dan queue — kini role Creator mencakup hak schedule/publish yang sebelumnya ada di role Manager |
| Sinta — Content Creator | Creator | Fokus buat draft; kini juga bisa menjadwalkan sendiri kalau workflow tim mengizinkan |
| Dimas — Startup Growth Lead | Account Owner | Solo/small team; kemungkinan merangkap semua role |
| Lara — Agency Social Lead | Admin atau Creator | Oversight multi-akun; koordinasi tim kecil |

---

# Decision Rules

1. Jika struktur roles perlu diubah (misalnya: menambah role baru), diskusikan dan buat ADR baru.
2. Set status kanonikal tidak boleh diubah tanpa ADR. Seluruh dokumen UX yang merujuk status harus diperbarui bersamaan.
3. Dokumen ini menjadi acuan untuk desain database (tabel `members`, `roles`, `content_posts`) pada fase Architecture.
4. Jangan implementasikan "Approval Workflow" berlapis — ini bukan MVP (lihat `mvp-definition.md`: Approval Workflow ada di *Could Have*, bukan *Must Have*).

---

# Related Documents

* `README.md`
* `feature-modules.md` — modul Workspace mendefinisikan Roles & Permissions sebagai responsibilities
* `mvp-definition.md` — scope MVP termasuk Workspace management
* `feature-priority.md`
* `../03-user/user-personas.md` — mapping persona ke role
* `../04-ux/ux-principles.md` — UXP-06: Status Jelas, Proses Ringan
* `../04-ux/information-architecture.md`
* `../04-ux/user-flows.md`
* `../04-ux/key-screen-patterns.md`
* `../../project-manager/DECISIONS.md` — ADR-008 (Product Baseline), ADR-012 (addendum ini), ADR-047 (Publish Now), ADR-048 (Disconnect Confirmation), ADR-049 (Safety Check / Double Confirmation), ADR-050 (Transfer Ownership & Delete Workspace), ADR-074 (reduksi 4 role → 3 role, resolusi KI-017)
