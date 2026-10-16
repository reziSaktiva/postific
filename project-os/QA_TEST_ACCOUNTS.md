# QA TEST ACCOUNTS

Dokumen ini mencatat akun test yang tersedia untuk verifikasi browser
end-to-end (dipakai terutama oleh Najwa QA Engineer, `.claude/agents/
najwa-qa-engineer.md`), supaya akun yang sama bisa dipakai berulang kali
tanpa registrasi ulang.

---

## Testing browser pakai localhost langsung (ADR-070)

Akar masalah requirement ngrok sebelumnya adalah **Better Auth Cloud**
(produk hosted terpisah, sempat aktif via plugin `dash` di `auth.ts` dengan
`BETTER_AUTH_API_KEY` terisi) yang mewajibkan Base URL publik — bukan
Better Auth self-hosted. Setelah `BETTER_AUTH_API_KEY` dikosongkan dan
project kembali ke Better Auth self-hosted sesuai baseline
(`auth-strategy.md`, ADR-024), login/session terverifikasi normal lewat
`http://localhost:3000` — lihat ADR-070 di `DECISIONS.md`.

**Verifikasi browser:** buka langsung `http://localhost:3000` (via
`bun run dev` atau `preview_start` dengan config `web` di `.claude/
launch.json`) — **tidak perlu tanya URL tunnel ke user lagi.**

---

## Akun test yang tersedia saat ini

Akun ini **sudah terdaftar di database** — jangan registrasi ulang.

| Field    | Value                       |
| -------- | --------------------------- |
| Nama     | Raka Pratama                |
| Email    | `raka.test@kopiselasar.com` |
| Password | `Password123!`              |
| Role     | Owner                       |

Akun ini sudah dipakai berkali-kali untuk verifikasi end-to-end M8 (lihat
riwayat "akun test Raka Pratama" di `PROJECT_STATE.md` — ADR-046, Publishing
MVP persistensi, ADR-052 Tahap 3, dll).

| Field    | Value                       |
| -------- | --------------------------- |
| Nama     | Maya Anggraini              |
| Email    | `maya.test@kopiselasar.com` |
| Password | `Password123!`              |
| Role     | Admin                       |

Dibuat 2026-08-31 lewat alur **Accept Invite (T-093)** yang baru selesai
diimplementasikan — Raka Pratama (Owner) invite via Settings → Members →
Invite Member (role Admin, metode Copy Link), lalu link `/invite/{token}`
dibuka untuk isi Nama + Password (state "Email Baru", email terkunci ke
undangan). Berhasil landing di workspace yang sama (workspace "Insvire")
dengan role Admin — dipakai sebagai bukti T-093 berfungsi end-to-end
sekaligus akun kedua untuk verifikasi RBAC (KI-038, T-093.4: Owner vs
Admin vs Creator — belum dilakukan tuntas, masih terbuka).

| Field    | Value                        |
| -------- | ---------------------------- |
| Nama     | Sinta Wijaya                 |
| Email    | `sinta.test@kopiselasar.com` |
| Password | `Password123!`               |
| Role     | Creator                      |

Dibuat 2026-08-31 — registrasi akun via `/register` oleh AI, invite ke
workspace Insvire (role Creator) dilakukan sendiri oleh King Rezi lewat
Settings → Members → Invite Member → link `/invite/{token}`, berhasil.

Dengan ini workspace **Insvire** sudah punya akun real untuk **ketiga
role** (Raka=Owner, Maya=Admin, Sinta=Creator) — melengkapi data yang
dibutuhkan untuk verifikasi RBAC end-to-end (KI-038, T-093.4: Danger Zone
hidden non-Owner, Transfer Ownership, Update Role, Remove Member) yang
sebelumnya terhambat karena tidak ada ≥2 akun nyata di satu workspace.

---

## Update dokumen ini

Saat akun test baru ditambahkan (mis. Manager/Creator setelah fitur invite
selesai, atau akun tambahan lain), tambahkan baris baru di tabel "Akun test
yang tersedia saat ini" di atas — jangan buat file terpisah lagi per akun.
