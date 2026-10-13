/**
 * Seed mock `WorkspaceConnectedAccount` dihentikan (ADR-119).
 *
 * Script ini dulu menyisipkan akun `mock-ig-001` / `mock-fb-001` supaya
 * Draft Editor bisa diuji saat `OUTSTAND_API_KEY` kosong dan Fake adapter
 * masih aktif (ADR-059). Factory sekarang hanya memakai Real adapter, dan
 * database dev/staging dipakai bersama — menjalankan seed itu mengembalikan
 * channel palsu yang sudah dibersihkan di T-106.5.
 *
 * Akun sosial dihubungkan lewat OAuth Outstand sungguhan. Script ini
 * sengaja gagal keras dan tidak menulis apa pun ke database.
 */
console.error(
  "seed-connected-accounts dihentikan (ADR-119). Jangan menyisipkan akun mock ke database bersama. Hubungkan akun lewat OAuth Outstand.",
);
process.exit(1);
