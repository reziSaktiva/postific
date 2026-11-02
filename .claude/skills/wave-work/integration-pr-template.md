# Integration PR

Badan PR integrasi ke `staging` (squash). Tiga bagian.

## Summary

Apa yang berubah dan mengapa, dalam beberapa butir. Tunjuk tiket, spec, dan ADR lewat ID; jangan menyalin isinya.

## Evidence

- Sebelum dan sesudah (perilaku atau tangkapan layar bila UI).
- Hasil `typecheck`, `lint`, tes unit, dan E2E golden path lokal (ADR-149).
- Hasil review dua sumbu (Standards dan Spec): temuan, label, dan commit perbaikannya.

## Merge Danger

- **Arah:** pintu satu arah (migrasi, perubahan data) atau dua arah (dapat di-revert).
- **Jangkauan dampak:** area, domain, dan pengguna yang terkena.
- **Migrasi:** nama migrasi, dan apakah sudah diterapkan ke DB bersama (ADR-081) beserta izin langsung King Rezi.
- **Belum terbukti:** butir yang hanya bisa diverifikasi di staging dan tiket verifikasi gelombangnya.
