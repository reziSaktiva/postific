# Handoff

Dipakai saat sesi gelombang berhenti di tengah jalan (batas pemakaian, idle,
ganti agen). Dasar: `project-os/specs/S-003.md` § 3, ADR-133. Dokumen ini
hanya **menunjuk**; isi spec, tiket, ADR, dan diff tidak disalin.

## Aturan

- **Simpan di scratchpad sesi**, bukan di repo dan tidak di-commit.
- **Penunjuk, bukan salinan:** spec, tiket, ADR, commit, dan PR ditulis lewat path, hash, atau URL. Agen berikutnya membuka sumbernya sendiri.
- **Tanpa rahasia dan data pribadi:** tidak ada isi `.env.local`, token, kredensial, email, atau data pengguna. Bila sebuah nilai harus disebut, tulis letaknya, bukan nilainya.
- **Ringkas:** cukup agar agen berikutnya bisa lanjut tanpa membaca ulang percakapan.
- Izin gerbang King Rezi (migrasi, merge ke `staging`, tutup PR) tidak ikut berpindah lewat handoff. Agen berikutnya memintanya langsung ke King Rezi (lihat `SKILL.md` § Gerbang King Rezi).

## Bentuk

```markdown
# Handoff <nama gelombang atau jalur> · <tanggal>

## Tujuan lanjutan

Satu sampai tiga kalimat: apa yang harus selesai dan tiket mana (ID, path section).

## Keadaan terakhir

- Branch integrasi dan branch jalur: <nama>; worktree: <path>
- Commit terakhir per branch: <hash>
- PR dan hasil CI: <URL>
- Yang sudah selesai (✅) dan yang belum, per butir tiket
- Yang belum terbukti (mis. butir yang hanya bisa dicek di staging)

## Keputusan yang sudah diambil

Satu baris per keputusan, dengan penunjuk (ADR, komentar PR, atau pesan King Rezi
yang dikutip singkat). Tandai pertanyaan yang masih milik King Rezi.

## Skill yang harus dipanggil agen berikutnya

Nama skill dan alasan (mis. `wave-work` mulai dari langkah "Gabungkan jalur").

## Penunjuk bacaan

Path yang dibuka lebih dulu: spec, section tiket, brief jalur.
```
