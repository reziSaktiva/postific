## Decision ADR-056

### Title

Sinkronisasi UI/UX Docs ↔ Claude Design — Status Co-equal untuk Token + AI Wajib Reminder Proaktif (Amandemen ADR-038, ADR-042)

### Status

Accepted

### Date

2026-07-31

### Decision

Dipicu diskusi King Rezi soal pengalaman kerja nyata: perubahan UI/UX kadang
dimulai dari dokumentasi (`04-ux/`, `design-tokens.md`) lalu diikuti Claude
Design, kadang sebaliknya — tanpa aturan arah yang jelas, sehingga berpotensi
miss-match tanpa disadari (King Rezi mengaku sering lupa melakukan sync
manual).

1. **Nilai token visual** (warna, spacing, radius, font, dsb.) — `design-tokens.md`
   dan Design System di project Claude Design "Social Media Management"
   berstatus **co-equal (setara)**. Tidak ada yang wajib jadi "penulis
   pertama". Ini mengamendemen ADR-038 poin 1 (yang menyatakan
   `design-tokens.md` sebagai SoT tunggal) dan poin 2 (yang menyatakan nilai
   diisi satu kali setelah desain di-approve) — token sekarang boleh
   berevolusi iteratif dari kedua sisi sepanjang development, bukan diisi
   sekali di akhir.
2. **Alur, struktur, dan fungsi layar** (IA, navigasi, pola layar kritis) —
   **tidak berubah**: `product-discovery/04-ux/` tetap Source of Truth,
   Claude Design tetap representasi visual turunan (ADR-042 poin 2 & 5 tetap
   berlaku, termasuk "baseline + ADR menang" saat konflik).
3. **Kewajiban baru — AI wajib reminder proaktif:** setiap kali AI (Claude
   Code, termasuk subagent Neymar Product Designer dan siapapun yang
   mengedit `04-ux/`/`design-tokens.md`) melakukan atau mendeteksi perubahan
   apapun yang berhubungan dengan UI/UX — baik di sisi dokumentasi maupun di
   sisi project Claude Design "Social Media Management" (via `DesignSync`)
   — AI **wajib** secara eksplisit memberi tahu King Rezi bahwa kedua sisi
   berpotensi belum sinkron, dan menanyakan apakah perlu diselaraskan
   sekarang. Ini berlaku untuk kedua kategori di atas (token maupun
   flow/fungsi layar), bukan cuma token.
4. Sinkronisasi teknis tetap **manual/on-request** (ADR-042 poin 3 tidak
   berubah — tidak ada webhook/trigger otomatis). Yang berubah hanya
   kewajiban AI untuk **mengingatkan**, bukan mekanisme sync itu sendiri.
5. Tie-breaker saat ditemukan konflik nyata: untuk token (co-equal) — King
   Rezi yang memutuskan versi mana yang benar, tidak ada resolusi otomatis;
   untuk flow/fungsi layar — baseline `04-ux/` + ADR tetap menang (tidak
   berubah dari ADR-042 poin 5).

### Reason

- Solo developer yang mengerjakan dokumentasi dan Claude Design sendiri
  tanpa checklist eksplisit rentan lupa sisi mana yang perlu diselaraskan —
  masalah ini sudah terjadi berulang kali secara ad hoc sebelum ADR ini.
- Memaksa satu arah SoT tunggal untuk token (selalu docs dulu, atau selalu
  Claude Design dulu) dianggap terlalu kaku untuk cara kerja aktual King
  Rezi yang kadang lebih cepat iterasi visual langsung di Claude Design,
  kadang lebih cepat menulis keputusan di docs dulu.
- Reminder proaktif oleh AI adalah kompensasi paling murah secara teknis
  (tidak perlu infra sync otomatis, sesuai batas teknis yang sudah disadari
  di ADR-042 poin 3) sambil tetap menutup celah "lupa sync manual".
- Flow/fungsi layar sengaja **tidak** dijadikan co-equal seperti token —
  `04-ux/` sudah punya baseline matang (ADR-013) dan mengubah hierarkinya
  berisiko menghilangkan traceability keputusan UX yang sudah lama berjalan
  baik.

### Alternatives Considered

- Tetap SoT tunggal untuk token (docs dulu, ADR-038 asli) — ditolak; tidak
  mencerminkan cara kerja aktual dan tetap mengandalkan disiplin manual yang
  terbukti sering terlewat.
- Claude Design jadi SoT token, docs jadi cerminan (kebalikan ADR-038
  sepenuhnya) — ditolak; terlalu jauh dari niat awal ADR-038 (menjaga docs
  sebagai acuan engineering yang bisa direview tanpa buka tool eksternal).
- Sync otomatis penuh (webhook/polling) — ditolak; tidak ada infrastruktur
  untuk itu (sudah dinyatakan di ADR-042), dan di luar scope solo developer
  MVP.
- Reminder hanya untuk token, tidak untuk flow/fungsi layar — ditolak; King
  Rezi secara eksplisit meminta cakupan untuk **semua** perubahan UI/UX, bukan
  cuma token.

---
