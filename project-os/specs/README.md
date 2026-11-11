# Specs

Rumah lapis **spec** (ADR-131). Bukan rumah docs, bukan rumah tiket, bukan catatan implementasi.

## Empat lapis

| Lapis     | Rumah                                                                                     | Agent membuka ini kapan                                              |
| --------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Docs      | `product-discovery/`, `context/`, `decisions/`                                            | Saat butuh bahasa domain atau keputusan yang sudah ada               |
| Spec      | `specs/S-NNN.md` di folder ini                                                            | Saat pekerjaan melewati lebih dari satu sesi                         |
| Tiket     | `tickets/vXX-*.md`, atau `tickets/known-issues.md` untuk tiket dari Known Issue (ADR-134) | Setelah ID task dipilih dari `AVAILABLE_TICKETS.md`                  |
| Implement | kode dan tes                                                                              | Saat tiket dikerjakan. Hasilnya commit, bukan paragraf baru di tiket |

Pekerjaan yang muat satu sesi tidak dibuatkan spec. Tiket menunjuk docs yang berlaku, lalu langsung diimplementasikan.

## Kapan menulis spec

Tulis spec setelah keputusannya sudah jatuh (docs / ADR), dan sebelum tiket dipecah, kalau hasilnya tidak muat satu jendela konteks.

Jangan menulis spec untuk mengulang wawancara. Wawancara terjadi sebelum file ini ada.

## Bentuk `specs/S-NNN.md`

```markdown
# S-NNN · Judul

**Docs:** ADR-xxx, path baseline yang berlaku
**Tiket:** T-xxx (diisi setelah tiket dibuat)

## Perilaku

Apa yang harus benar dari sisi pemakai. Bukan daftar file.

## Jahitan tes

Di batas mana ini dites. Nama modul, bukan cuplikan kode.

## Di luar spec

Yang sengaja tidak ikut.
```

ID spec global, tidak didaur ulang. Nomor berikutnya dicatat di `AVAILABLE_TICKETS.md` saat spec pertama dibuat. Saat folder ini masih kosong, spec pertama adalah **S-001**.

## Bentuk tiket

Tiket rilis tetap di `tickets/vXX-*.md`, termasuk setelah selesai. Tiket yang lahir dari Known Issue ada di `tickets/known-issues.md` (ADR-134), bentuknya sama. Tiket S-004 ada di `tickets/s004-orchestration-language.md` (keputusan King Rezi 2026-11-11).

```markdown
### T-xxx · Judul

| Field       | Value                                    |
| ----------- | ---------------------------------------- |
| **Status**  | ⏳ Not Started                           |
| **Mode**    | AFK atau HITL                            |
| **Domain**  | …                                        |
| **Spec**    | S-NNN, atau "tidak ada — muat satu sesi" |
| **Docs**    | ADR / baseline yang berlaku              |
| **Depends** | T-xxx, atau —                            |

**What to build:** perilaku yang selesai kalau tiket ini beres, dari sisi pemakai.

- [ ] Kriteria terima 1
- [ ] Kriteria terima 2

**Blocked by:** tidak ada, atau T-xxx
```

**Mode (ADR-153, S-003):** **AFK** berarti agen dapat menyelesaikan tiket secara mandiri; **HITL** berarti ada butir yang butuh jawaban atau keputusan King Rezi (persetujuan ADR, izin migrasi, verifikasi manual). Hanya tiket AFK yang boleh menjadi jalur paralel gelombang; tiket HITL ditandai dan tidak dijalankan agen. Tiket yang belum punya penanda diklasifikasi oleh `wave-plan` dari isinya dan hasilnya disodorkan ke King Rezi. Penanda ditulis di baris status tiket, mis. `⏳ Not Started` · **Mode** AFK.

**Status tiket:** tiket yang kodenya selesai tetapi butirnya masih menunggu staging ditulis `🟡 Done (code), menunggu Verified (staging)`. Arti status dan aturannya: skill `project-os-navigator` § Pekerjaan Baru (ADR-153).

Jangan menulis path file, jumlah tes, nama subagent, atau cerita sesi ke dalam tiket. Itu milik commit.

Saat tiket ✅, barisnya keluar dari `AVAILABLE_TICKETS.md`. Section di file tiketnya tetap.
