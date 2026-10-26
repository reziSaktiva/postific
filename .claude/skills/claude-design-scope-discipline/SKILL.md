---
name: claude-design-scope-discipline
description: Mencegah AI mengubah default/state yang sudah disetujui user sebagai efek samping saat mengimplementasikan perubahan di artifact desain Postific (toggle, switch, variant pembanding, dsb). Gunakan skill ini SEBELUM melakukan perubahan apapun di artifact desain lewat tool Artifact (ADR-140) — terutama saat diminta menambah kontrol pembanding antar dua tampilan/variant, atau saat permintaan user berpotensi diartikan lebih dari satu cara.
---

# Artifact Desain — Scope Discipline

Skill ini mengunci satu prinsip: **implementasi fitur baru tidak boleh diam-diam mengubah state/tampilan yang sudah disetujui user.** Ditulis setelah insiden nyata di ADR-052 (lihat `project-os/DECISIONS.md`).

---

## Kapan Wajib Pakai Skill Ini

- Sebelum melakukan perubahan apapun di artifact desain Postific atau galeri Postific Design Review (via tool `Artifact`, ADR-140).
- Khususnya saat user meminta **kontrol pembanding** antar dua tampilan/variant — toggle, switch, A/B, dsb.
- Saat permintaan user bisa diartikan lebih dari satu cara (ambigu antara "tambahkan alat bantu" vs "ganti tampilan aktif").
- Berlaku juga untuk implementasi kode di `apps/web` yang menyentuh state/default UI yang sudah pernah di-approve — bukan cuma khusus artifact desain.

---

## Insiden yang Melatarbelakangi (ADR-052)

Kronologi singkat (detail lengkap: `DECISIONS.md` ADR-052, addendum "Variant Dialog dibuka kembali untuk perbandingan" dan "Koreksi: default dikembalikan ke Fullscreen"):

1. User minta Draft Editor (Create Post/Update Draft) diubah dari halaman penuh menjadi dialog. Hasilnya dialog `variant="fullscreen"` — sengaja tanpa backdrop gelap (desain asli Astryx), sehingga user sempat tidak sadar itu sudah jadi dialog.
2. User minta: tambahkan **toggle** supaya ada dua versi (Fullscreen & Standard) untuk dibandingkan langsung.
3. **Kesalahan:** toggle-nya berhasil ditambahkan dan berfungsi benar — tapi default tampilan diam-diam diubah dari Fullscreen → Standard sebagai bagian dari implementasi, padahal user tidak pernah minta default-nya berubah. Karena Standard vs Fullscreen punya struktur berbeda (card mengambang vs full-viewport), semua elemen di dalamnya (termasuk Media/Account Selector) ikut terlihat berubah layout-nya walau class CSS-nya sendiri tidak disentuh.
4. Root cause: AI menganggap tugas selesai begitu "fitur baru (toggle) berfungsi", tanpa memverifikasi apakah ada efek samping pada state yang sudah disetujui sebelumnya.

---

## Aturan Wajib

1. **Jangan pernah mengubah default/state/tampilan yang sudah disetujui user sebagai efek samping dari fitur baru** — termasuk saat menambah kontrol pembanding. Kalau permintaan adalah "tambahkan toggle A/B", itu berarti **hanya menambahkan alat untuk berpindah antara A dan B** — bukan izin untuk mengganti mana yang aktif secara default.

2. **Sebelum eksekusi**, kalau scope perubahan berpotensi ambigu, nyatakan ringkas ke user:
   - Apa yang akan **berubah**.
   - Apa yang **tetap sama** (termasuk default/state aktif saat ini).

   Contoh kalimat: "Saya akan tambahkan toggle Fullscreen/Standard di header dialog. Default tetap Fullscreen seperti sekarang — toggle cuma alat bantu untuk lihat versi Standard saat diklik, tidak mengubah tampilan default. Betul begitu?"

3. **Kalau ambigu, tanya dulu** sebelum eksekusi (lihat skill `proactive-clarification`). Jangan berasumsi salah satu interpretasi lebih "masuk akal" tanpa konfirmasi — terutama kalau efeknya mengubah tampilan yang sudah di-approve.

4. **Definisi selesai bukan cuma "fitur baru berfungsi".** Verifikasi eksplisit dua hal:
   - Fitur yang diminta bekerja dengan benar.
   - **Tidak ada perubahan tak diminta** pada tampilan/behavior existing (bandingkan state sebelum vs sesudah, screenshot/diff visual bila memungkinkan).

5. **Kalau terlanjur mengubah sesuatu di luar scope** (sengaja atau tidak sengaja), sebutkan secara eksplisit ke user sebagai bagian dari laporan — jangan diamkan, walau perubahannya terlihat kecil atau "lebih baik". User yang berhak memutuskan apakah perubahan tambahan itu diterima atau di-revert.

6. **Selalu baca versi terbaru sebelum publish ulang** — King Rezi dan sesi
   lain bisa mengubah artifact langsung, jadi isi di artifact sering lebih
   baru dari salinan lokal atau rencana mana pun. Sebelum `Artifact` publish
   apa pun: (1) `read` file target (dan indeks `project/design-system.json`)
   dari artifact dulu, (2) bandingkan dengan yang akan dipublish, (3) kalau
   artifact lebih maju, batalkan rencana "kirim ulang utuh" dan terapkan
   perubahan **minimal** di atas isi terbaru — susun file gabungan lewat
   script, bukan diketik ulang manual (file sering berisi path SVG inline
   panjang yang typo-nya tidak kelihatan saat review), pertahankan
   indentasi apa adanya supaya diff hanya berisi perubahan yang dimaksud,
   lalu baca ulang artifact setelah publish untuk verifikasi. Tool menolak
   publish bila versi yang dibaca sudah tertinggal; ikuti penolakannya, jangan
   memakai `force`. Kasus asal aturan ini (T-010.3, 2026-08-04, saat masih
   Claude Design): task backlog bilang `components/navigation.html` "tinggal
   push dari scratchpad", tapi remote sudah punya 5 baris Channels yang
   ditambahkan King Rezi sendiri — push tanpa verifikasi akan menghapus
   kerja King Rezi.

---

## Contoh

**Salah (yang terjadi di insiden ADR-052):**

> User: "Buat toggle biar ada dua versi, Fullscreen dan Standard, biar bisa dibandingkan."
>
> AI: _menambahkan toggle, sekaligus mengganti default state ke Standard tanpa bilang_ → dilaporkan sebagai "toggle sudah ditambahkan" tanpa menyebut default ikut berubah.

**Benar:**

> User: "Buat toggle biar ada dua versi, Fullscreen dan Standard, biar bisa dibandingkan."
>
> AI: "Saya tambahkan toggle di header dialog. Default tetap Fullscreen (tidak berubah dari sekarang) — klik toggle untuk preview Standard, klik lagi untuk kembali. Lanjutkan dengan asumsi ini?" → baru eksekusi setelah dikonfirmasi (atau langsung eksekusi dengan asumsi eksplisit ini dinyatakan di laporan akhir, kalau task cukup jelas untuk tidak perlu menunggu jawaban).

---

## Related

- `project-os/DECISIONS.md` — ADR-052 (insiden asal + kronologi lengkap).
- `context/ctx-design.md` — Aturan operasional artifact desain (pointer ke skill ini).
- `.claude/skills/proactive-clarification/SKILL.md` — cara bertanya saat ada fork keputusan/ambiguitas.
- `AGENTS.md` — Aturan keras project.
- `project-os/DECISIONS.md` — ADR-140 (alat desain pindah dari Claude Design ke artifact; aturan skill ini tetap berlaku).
