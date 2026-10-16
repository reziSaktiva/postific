---
name: docs-consistency-audit
description: >-
  Audit menyeluruh untuk mencari konflik, drift, atau inkonsistensi antar
  dokumentasi project (product-discovery, project-manager, context/, ADR).
  HANYA dipicu saat King Rezi secara eksplisit meminta audit/cross-check/
  consistency-check dokumentasi — bukan behavior otomatis rutin (itu sudah
  dicakup mode "Bug / Inkonsistensi Dokumen" di project-os-navigator). Cakupan
  audit ditentukan lewat argumen: nama area (product-discovery, context,
  project-manager, all) atau nama topik/fitur (mis. "calendar", "workspace
  switcher") yang akan di-resolve ke seluruh dokumen lintas layer yang
  menyinggung topik itu.
---

# Docs Consistency Audit

Skill ini untuk audit **sengaja dan menyeluruh** — bukan proses reaktif yang
menempel di akhir tiap task. Tujuannya menangkap drift yang lolos dari
kebiasaan "update docs setelah kerja" (`AGENTS.md` § "Setelah mengubah
sesuatu"): ADR yang mengamandemen ADR lama tapi baseline yang dirujuknya
belum diupdate, hitungan/status yang diam-diam desync antar file, context/
yang masih menjelaskan pola yang sudah digantikan.

**Mode kerja: report-only, lalu tanya.** Skill ini tidak pernah memperbaiki
apapun secara diam-diam — termasuk temuan yang kelihatannya jelas benar
(typo hitungan, status usang). Ini override eksplisit terhadap langkah 3 di
mode "Bug / Inkonsistensi Dokumen" (`project-os-navigator/SKILL.md`) yang
memperbolehkan perbaikan langsung — untuk audit lewat skill ini, semua
temuan dilaporkan dulu, baru dieksekusi setelah dikonfirmasi.

---

## Langkah 0 — Resolve Scope dari Argumen

Skill ini dipanggil dengan argumen bebas (`args`). Interpretasikan sebagai
salah satu dari:

| Argumen                          | Artinya                                                                 |
| --------------------------------- | ------------------------------------------------------------------------ |
| `project-manager`                 | `PROJECT_STATE.md`, `AVAILABLE_TICKETS.md` + seluruh `tickets/vXX-*.md` + `specs/`, `DECISIONS.md` + seluruh `decisions/ADR-*.md` |
| `context`                         | Seluruh `context/ctx-*.md` + `context/README.md`                        |
| `product-discovery`               | Seluruh `product-discovery/**/*.md`                                     |
| Kombinasi (`product-discovery+context`, dst.) | Union dari area yang disebut, dipisah `+`                   |
| `all`                             | Union semua area di atas                                                |
| Nama topik/fitur bebas (mis. `calendar`, `workspace switcher`, `invite`) | **Topic-based scope** — lihat Langkah 0b |
| Kosong / tidak ada argumen        | **Jangan menebak** — tanya dulu ke King Rezi area mana yang dimaksud (opsi: salah satu area di atas, atau topik spesifik) |

### Langkah 0b — Topic-Based Scope

Kalau argumen adalah nama topik/fitur (bukan nama area baku di atas):

1. Grep kata kunci topik (dan sinonim/istilah terkait yang jelas — mis.
   "calendar" juga cari "T-033", "kalender") di seluruh:
   - `project-os/AVAILABLE_TICKETS.md` + `project-os/tickets/`
   - `project-os/DECISIONS.md` + `project-os/decisions/`
   - `project-os/PROJECT_STATE.md`
   - `context/`
   - `product-discovery/`
2. Kumpulkan daftar file yang match sebagai scope. Kalau hasil grep sangat
   banyak (topik terlalu generik, mis. "workspace") atau sangat sedikit
   (mungkin salah eja/istilah), **konfirmasi dulu** ke King Rezi daftar file
   yang akan diaudit sebelum lanjut — jangan diam-diam mempersempit atau
   memperluas cakupan sendiri.

---

## Langkah 1 — Baca Seluruh Dokumen dalam Scope

Beda dengan cascade hemat-token di `project-os-navigator` (yang berhenti
secepat mungkin), audit ini **wajib baca penuh** setiap file dalam scope yang
sudah di-resolve — tujuannya memang menyisir menyeluruh, bukan lookup cepat.

Untuk scope besar (`all`, atau `product-discovery` penuh), pertimbangkan
delegasi ke Agent (Explore atau general-purpose) per sub-area supaya konteks
utama tidak penuh — tapi sintesis akhir (klasifikasi temuan, keputusan mana
yang ambigu) tetap dilakukan oleh AI utama, bukan diserahkan ke subagent.

---

## Langkah 2 — Kategori Pengecekan

Periksa lintas dokumen dalam scope untuk kategori berikut:

1. **Status/progress drift** — status task terbuka di `AVAILABLE_TICKETS.md`
   berbeda dari tiket di `tickets/vXX-*.md`, atau task ✅ masih tertinggal di antrian.
2. **Antrian drift** — `AVAILABLE_TICKETS.md` memuat task ✅, atau task ⏳/🟡/🚫
   yang ada di `tickets/vXX-*.md` tidak muncul di antrian.
3. **ADR amandemen belum tercermin** — ADR baru mengubah/mengamandemen ADR
   lama, tapi dokumen lain yang merujuk ke keputusan lama (baseline
   `product-discovery/`, `context/ctx-*.md`, atau task lain) belum diupdate
   mengikuti versi terbaru.
4. **Terminologi/enum drift** — penyebutan berbeda untuk hal yang sama:
   nama persona (harus Raka/Maya/Sinta/Dimas/Lara), nama role/permission,
   istilah domain, penamaan komponen/pattern yang sudah diganti nama.
5. **Referensi mati/usang** — link atau sebutan ke file/section/komponen
   yang sudah dihapus, dipindah, atau digantikan (mis. folder yang sudah
   dihapus, komponen Astryx yang sudah diganti pola lain).
6. **Pelanggaran Source of Truth** — dokumen bertipe Static Reference
   (README, `PROJECT_RULES.md`, baseline, `SKILL.md`) memuat info yang
   seharusnya hanya ada di Living Document (`PROJECT_STATE.md`) — status,
   progress %, phase aktif. Ini pola yang sama dengan "Proactive Consistency
   Check" di `project-os-navigator`, tapi di sini dicari secara sengaja ke
   seluruh scope, bukan cuma dokumen yang kebetulan dibaca.
7. **Dua dokumen saling bertentangan tanpa source of truth jelas** — lihat
   Langkah 3, kategori ini diperlakukan beda dari 6 kategori di atas.

---

## Langkah 3 — Klasifikasi Temuan

Setiap temuan masuk salah satu dari dua kelas:

### A. Mekanis / Objektif

Ada satu jawaban yang jelas benar berdasarkan Source of Truth yang sudah
ditetapkan (tabel Source of Truth di `AGENTS.md`, atau ADR yang sudah
Accepted). Contoh: hitungan subtask yang salah jumlah (kebenarannya tinggal
dihitung ulang dari file), status task di `PROJECT_STATE.md` yang belum
disalin dari `tickets/vXX-*.md` yang sudah diupdate.

→ Laporkan dengan **usulan perbaikan konkret**, tapi tetap tunggu konfirmasi
sebelum edit (lihat Langkah 5).

### B. Substantif / Ambigu

Dua dokumen menyatakan hal yang saling bertentangan **tanpa** ada satu yang
jelas menjadi Source of Truth — misalnya baseline lama vs. keputusan
verbal/implementasi yang belum pernah di-ADR-kan, atau dua ADR yang
tumpang-tindih tanpa saling mengamandemen secara eksplisit.

→ **Jangan berasumsi mana yang benar.** Sajikan kedua sisi apa adanya dan
tanyakan ke King Rezi (pola sama `proactive-clarification`). Temuan kelas
ini bisa berujung ADR baru — jangan diselesaikan tanpa keputusan eksplisit.

---

## Langkah 4 — Format Laporan

Sajikan hasil sebagai daftar temuan, dikelompokkan per kategori (Langkah 2),
masing-masing minimal memuat:

- **File yang terlibat** (path relatif, dengan link markdown)
- **Apa yang bertentangan** (kutip baris/bagian yang relevan, singkat)
- **Kelas** (A. Mekanis / B. Ambigu)
- **Usulan** (untuk kelas A: perbaikan konkret; untuk kelas B: pertanyaan
  yang perlu dijawab King Rezi)

Kalau tidak ada temuan sama sekali di scope yang diminta, katakan itu secara
eksplisit — jangan mengarang temuan supaya laporan terlihat berisi.

---

## Langkah 5 — Tindak Lanjut (Setelah Laporan Disajikan)

1. Untuk temuan kelas A: tanya per-temuan atau batch ("mau saya perbaiki
   semua temuan mekanis ini sekarang?") — baru eksekusi setelah dikonfirmasi.
2. Untuk temuan kelas B: tanya dulu, tunggu keputusan. Kalau keputusan itu
   mengubah baseline/arsitektur, ikuti alur ADR baru (mode "Planning Change"
   di `project-os-navigator`).
3. Setiap perbaikan yang benar-benar dieksekusi cukup tercatat di tiket atau ADR.
   Jangan menulis changelog terpisah (ADR-131).
4. Kalau perbaikan menyentuh status tiket, update `tickets/vXX-*.md` dan
   `AVAILABLE_TICKETS.md` bersamaan.

---

## Aturan Kritis

- Jangan trigger skill ini secara otomatis di sesi kerja biasa — hanya saat
  diminta eksplisit.
- Jangan memperbaiki apapun sebelum melaporkan dan dikonfirmasi — berlaku
  untuk temuan kelas A maupun B.
- Untuk temuan kelas B, jangan menebak mana yang benar walau salah satu
  terlihat "lebih baru" — tanggal lebih baru bukan otomatis berarti lebih
  benar tanpa dikonfirmasi.
- Kalau scope yang diminta (topic-based) menghasilkan daftar file yang
  terasa tidak lengkap atau berlebihan, konfirmasi dulu sebelum audit
  penuh berjalan — jangan mempersempit/memperluas cakupan secara diam-diam.
