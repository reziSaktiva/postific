## Decision ADR-151

### Title

Required Check E2E untuk PR `staging` → `main` Ditunda sampai MVP Public Launch; Mengamandemen ADR-150 Poin 3 dan CI-D07

### Status

Accepted

### Date

2026-10-29

### Context

ADR-149 dan ADR-150 menetapkan hasil hijau workflow "E2E staging" sebagai required check untuk PR `staging` → `main` (T-175.3). Workflow itu sudah terbukti berjalan penuh (run 40820128077 pada PR uji 213). Namun `main`/production belum dipakai, dan King Rezi memutuskan tidak memaksakan gerbang itu sekarang.

### Decision

1. Workflow E2E tetap ada dan tetap berjalan pada PR `staging` → `main`, tetapi tidak dijadikan required check. Untuk sementara `main` hanya mewajibkan "Quality gates".
2. Menjadikan "E2E staging" required check ditunda sampai MVP public launch dan dilacak di T-088.1 (`tickets/v10-public-launch.md`), tercatat di `AVAILABLE_TICKETS.md`.
3. AI wajib mengingatkan King Rezi tentang T-088.1 saat v1.0 / MVP public launch dimulai.
4. Keputusan lain ADR-149 dan ADR-150 tidak berubah.

### Reason

- `main` belum dipakai, jadi gerbang wajib belum melindungi apa pun.
- Pekerjaan ditunda, bukan dibatalkan: workflow sudah siap dan tinggal satu pengaturan GitHub.

### Alternatives Considered

- **Menjadikannya required check sekarang.** Ditolak oleh King Rezi: `main` belum dipakai.
- **Menghapus workflow.** Ditolak: sudah terbukti dan murah dipertahankan.

### Impact / Baseline yang diamandemen

- `product-discovery/06-engineering/cicd-pipeline.md`: CI-D07 dan tabel trigger (catatan status).
- `project-os/decisions/ADR-150-*.md` poin 3 (catatan amandemen), tiket T-175.3 dan T-088.1.
- Konsekuensi yang diterima: sampai T-088.1 selesai, PR `staging` → `main` bisa di-merge dengan E2E merah.

---
