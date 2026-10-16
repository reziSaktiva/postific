## Decision ADR-057

### Title

Tidak Ada Designer Eksternal — Peran Desainer Digantikan Permanen oleh Claude Design / King Rezi (Amandemen ADR-038, ADR-041)

### Status

Accepted — Amended by ADR-097 (2026-09-01)

### Date

2026-07-31

### Decision

Dipicu diskusi lanjutan soal design tokens (lihat ADR-056): King Rezi
mengonfirmasi project ini **tidak akan pernah** merekrut atau menunggu
designer eksternal bergabung — ini keputusan final, bukan status sementara.

1. **Peran "desainer"** di seluruh baseline (ADR-038, ADR-041,
   `design-tokens.md`, `context/ctx-design.md`, dan dokumen lain yang
   menyebut "designer masuk"/"designer aktif"/"designer join") digantikan
   **permanen** oleh King Rezi sendiri, bekerja langsung di project Claude
   Design "Social Media Management" (ADR-042).
2. **Gerbang "designer masuk" sebagai syarat lock token dihapus** —
   mengamendemen ADR-038 (DT-D02) dan ADR-041 poin 2 & 7. Nilai token final
   tidak lagi menunggu event "designer join"; token berkembang iteratif
   co-equal antara `design-tokens.md` dan Claude Design (ADR-056), dan
   dikunci (status → Locked) kapan pun King Rezi menganggap satu set token
   sudah stabil — bukan menunggu approval pihak ketiga.
3. Seluruh referensi "designer masuk"/"designer aktif"/"designer join" yang
   masih berupa kalimat aktif (bukan catatan historis di `DECISIONS.md`/
   `CHANGELOG.md`/`CONVERSATIONS.md` yang append-only) diperbarui mengikuti
   keputusan ini: `product-discovery/06-engineering/design-tokens.md`,
   `product-discovery/06-engineering/README.md`, `product-discovery/README.md`,
   `context/ctx-design.md`, `context/ctx-technical-context.md`,
   `context/ctx-implementation.md`, dan `PROJECT_STATE.md` (bagian aktif,
   bukan entri historis di "Completed"/"Recent Decisions").
4. Folder `design/` yang sudah dihapus (ADR-045) **tidak akan pernah dibuat
   ulang** untuk menyambut designer eksternal — bila suatu saat kebutuhan
   handoff formal muncul lagi, itu akan jadi keputusan baru dengan ADR
   terpisah, bukan konsekuensi otomatis dari ADR ini.
5. **Tidak berubah:** Astryx tetap fondasi komponen permanen (ADR-041 poin
   1 & 4); `04-ux/` tetap SoT alur/fungsi layar (ADR-042 poin 2); mekanisme
   sync co-equal + reminder proaktif token (ADR-056) tetap berlaku apa
   adanya — ADR ini hanya menghapus asumsi "sebelum/sesudah designer masuk"
   dari kalimat-kalimat yang masih memuatnya.

### Reason

- Project ini solo developer tanpa rencana rekrutmen designer — menunggu
  event yang tidak akan pernah terjadi hanya menghasilkan status
  "Draft/TBD menunggu lock design" yang salah merepresentasikan realita dan
  berpotensi membuat token dianggap belum boleh dipakai serius.
- ADR-051 sudah membuktikan Claude Design + King Rezi sendiri mampu
  menghasilkan fidelitas visual tinggi (replikasi langsung dari
  `@astryxdesign/core`/`theme-neutral`) — tidak ada gap kemampuan visual
  yang perlu ditutup oleh designer eksternal.
- ADR-056 sudah menyediakan mekanisme sinkronisasi co-equal + reminder
  proaktif yang cukup untuk menjaga konsistensi token tanpa perlu gerbang
  approval pihak ketiga tambahan.

### Alternatives Considered

- Tetap menyisakan opsi rekrut designer di masa depan (kebijakan default
  sebelumnya, ADR-038/041) — ditolak eksplisit oleh King Rezi; menyisakan
  ambiguitas yang sama seperti sebelum ADR ini dibuat.
- Menghapus `design-tokens.md` sepenuhnya karena dianggap tidak perlu lagi
  — ditolak; dokumen tetap berguna sebagai satu sisi dari model co-equal
  ADR-056, cuma gerbang "designer masuk"-nya yang dihapus, bukan
  dokumennya.

---
