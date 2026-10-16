## Decision ADR-074

### Title

Reduksi Struktur Role dari 4 Jadi 3 — Account Owner, Admin, Creator (Resolusi KI-017)

### Status

Accepted

### Date

2026-08-07

### Context

KI-017 mencatat mismatch antara mockup Claude Design
`templates/settings-members.html` (role dropdown: Admin/Editor/Viewer) dan
baseline produk saat itu (`roles-permissions.md` + enum `MemberRole`:
Owner/Admin/Manager/Creator). Saat mendiskusikan resolusi KI-017, King Rezi
menyampaikan role **Manager** dirasa kurang berguna dan meminta struktur role
disederhanakan menjadi 3 role saja, bukan sekadar menyamakan mockup ke
baseline 4-role yang lama.

Role Manager sebelumnya didefinisikan sebagai "operator harian workspace"
dengan hak: buat/edit/hapus/jadwalkan/publish semua konten, baca analytics
penuh, kelola engagement inbox — tapi tanpa akses billing, workspace
settings, audit logs, dan hanya bisa mengundang Creator (tidak bisa
ubah/hapus member lain). Persona **Raka (Social Media Manager)** — "primary
daily user, operator publishing dan queue" — dipetakan ke role ini.

Pertanyaan kunci: kalau Manager dihapus, ke mana hak operasionalnya
dialihkan — naik ke Admin (yang juga pegang billing/workspace
settings/member management), atau naik ke Creator (yang sebelumnya cuma bisa
buat draft, tidak bisa schedule/publish)?

### Decision

1. Struktur role menjadi **3 role**: **Account Owner** (rename tampilan dari
   "Owner" — value/enum key internal tetap `Owner`/`"owner"`, tidak ada
   migrasi data), **Admin**, **Creator**. Role **Manager dihapus**.
2. Hak operasional Manager (buat/edit/hapus/jadwalkan/publish konten,
   analytics penuh, kelola engagement inbox) **digabung ke Creator** — bukan
   ke Admin. Creator sekarang setara level akses konten dengan Account
   Owner/Admin, hanya berbeda di area administratif (Members, Billing,
   Workspace Settings, Audit Logs — tetap tidak bisa diakses Creator).
3. Visibilitas konten Creator diperluas: sebelumnya hanya bisa lihat/edit
   konten milik sendiri (kecuali dibagikan), sekarang bisa lihat **semua**
   konten workspace — supaya bisa efektif menjalankan jadwal/queue tim,
   fungsi yang sebelumnya dipegang Manager.
4. Mapping persona: **Raka (Social Media Manager)** yang sebelumnya ke role
   Manager, sekarang ke role **Creator**.
5. Hierarki role baru: `Account Owner > Admin > Creator` (sebelumnya
   `Owner > Admin > Manager > Creator`).

### Reason

- Digabung ke Creator, bukan Admin, karena persona yang sebenarnya memegang
  tanggung jawab Manager (Raka — operator publishing harian) tidak pernah
  butuh akses administratif (billing, workspace settings, member
  management). Menggabung ke Admin akan jadi privilege creep yang tidak
  sesuai kebutuhan riil — orang seperti Raka akan kebagian hak yang tidak
  dia perlukan.
- Menggabung ke Creator lebih presisi: Creator tetap terisolasi dari area
  administratif workspace, tapi mendapat hak konten penuh (schedule,
  publish, engagement inbox, analytics) yang memang jadi kebutuhan
  operator harian.
- Role Manager dinilai King Rezi tidak cukup berguna sebagai role terpisah
  untuk skala tim yang jadi target produk saat ini — 3 role (kontrol penuh /
  administrasi / operasi konten) sudah cukup merepresentasikan pembagian
  tanggung jawab nyata tanpa menambah birokrasi (selaras UXP-06).

### Alternatives Considered

- **Gabung hak Manager ke Admin.** Ditolak — lihat Reason di atas, membuat
  Admin over-privileged untuk orang yang tugasnya murni operasional konten.
- **Pertahankan 4 role, cuma benerin mockup Claude Design agar sesuai
  baseline lama.** Ditolak oleh King Rezi — evaluasi ulang saat resolusi
  KI-017 menyimpulkan role Manager memang tidak diperlukan, bukan cuma
  masalah mockup yang salah label.

### Impact / Baseline yang diamandemen

- `product-discovery/02-product/roles-permissions.md` — ditulis ulang total:
  3 role, matriks hak akses, tabel transisi status, mapping persona.
- `product-discovery/02-product/mvp-definition.md` — Publish Now RBAC.
- `product-discovery/05-architecture/README.md`, `domain-model.md`,
  `auth-architecture.md`, `application-layer.md`, `realtime-strategy.md`,
  `database-strategy.md` — semua referensi 4-role/`MemberRole.Manager`
  diupdate ke 3-role.
- `product-discovery/06-engineering/auth-strategy.md`,
  `product-discovery/04-ux/information-architecture.md`,
  `product-discovery/04-ux/key-screen-patterns.md` — referensi role di RBAC
  dan Publish Now diupdate.
- `context/ctx-business.md`, `context/ctx-development.md` — daftar role
  kanonikal diupdate.
- `packages/shared/src/enums.ts` — `MemberRole.Manager` dihapus dari enum.

### Catatan implementasi

- Kode: `packages/shared/src/enums.ts` (hapus `MemberRole.Manager`),
  `apps/web/src/domains/workspace/services/workspace.service.test.ts`
  (skenario test yang memakai `MemberRole.Manager` disesuaikan ke 3 role;
  test lain yang menegakkan "hanya Owner/Admin boleh jadi actor" tidak
  berubah logikanya karena Creator tetap ditolak sebagai actor). Semua test
  terkait (28 test, `bun test`) lolos setelah perubahan.
- `apps/web/prisma/schema.prisma` menyimpan `role` sebagai `String` biasa
  (bukan native Prisma enum) — tidak ada migration DB yang diperlukan untuk
  perubahan ini karena belum ada data live dengan role `manager`.
- Mockup Claude Design `templates/settings-members.html` (project "Social
  Media Management", id `84aded99-bb23-49b1-be9f-dd8f21c6873e`) direvisi
  langsung oleh King Rezi mengikuti prompt yang diberikan agent — bukan
  dieksekusi otomatis lewat `DesignSync` dalam sesi ini.
- Resolusi ini menutup **KI-017** (`PROJECT_STATE.md`).

---
