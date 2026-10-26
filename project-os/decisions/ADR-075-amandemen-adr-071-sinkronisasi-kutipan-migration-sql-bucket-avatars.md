## Decision ADR-075

### Title

Amandemen ADR-071 — Sinkronisasi Kutipan `migration.sql` Bucket `avatars` (Resolusi KI-018)

### Status

Accepted

### Date

2026-08-07

### Context

Saat investigasi **KI-016** (lihat **ADR-073**), ditemukan bahwa isi
`migration.sql` aktual di
`apps/web/prisma/migrations/20260806120000_extend_avatars_bucket_user_profile/migration.sql`
sudah diedit setelah **ADR-071** ditulis — kode sudah punya
`ON CONFLICT (id) DO UPDATE` plus guardrail kolom `file_size_limit` dan
`allowed_mime_types` (menegakkan batas 2MB + JPG/PNG di level Storage juga,
bukan hanya application-layer), sementara kutipan "Catatan implementasi" di
ADR-071 masih menyebut versi lama (`ON CONFLICT (id) DO NOTHING`, tanpa
guardrail). Temuan ini bukan bagian dari resolusi KI-016 (berbeda file,
berbeda root cause) — dicatat terpisah sebagai **KI-018**.

Karena `DECISIONS.md`/ADR bersifat _append-only_ (tidak diedit diam-diam),
perbaikan kutipan dilakukan sebagai ADR baru yang mengamandemen ADR-071,
mengikuti konvensi amandemen yang sudah dipakai di ADR-027 (amandemen
ADR-014) dan ADR-067 (amandemen ADR-066).

### Decision

Kutipan resmi bagian "Catatan implementasi" ADR-071 digantikan oleh versi
berikut, sinkron dengan kode aktual saat ADR ini ditulis:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
```

Perbedaan dari kutipan lama di ADR-071:

1. `ON CONFLICT (id) DO NOTHING` → `ON CONFLICT (id) DO UPDATE SET ...` —
   idempotent terhadap baris yang sudah ada juga (bukan hanya insert baru),
   supaya guardrail di poin 2 ikut diterapkan meski bucket sudah eksis.
2. Kolom `file_size_limit` (2097152 byte = 2MB) dan `allowed_mime_types`
   (`image/jpeg`, `image/png`) ditambahkan — menegakkan batas ukuran/tipe
   file di level Supabase Storage, bukan hanya validasi
   application-layer di `identity.service.ts`. Ditambahkan sebagai
   code-review finding: tanpa guardrail ini, jalur upload lain ke bucket
   yang sama (mis. tool admin) tidak punya proteksi sama sekali.

Body ADR-071 sendiri **tidak diedit** — hanya kolom Status di
`DECISIONS.md` yang ditandai `Accepted — Amended by ADR-075 (2026-08-07)`,
mengikuti pola ADR-066/ADR-067.

### Reason

- Menjaga akurasi historis ADR-071 tanpa melanggar prinsip append-only
  DECISIONS.md.
- Kutipan SQL di sebuah ADR harus bisa dipercaya sebagai cerminan kode
  aktual — staleness seperti ini berisiko menyesatkan pembaca di masa
  depan yang mengasumsikan bucket `avatars` tidak punya guardrail
  ukuran/tipe file.

### Impact / Baseline yang diamandemen

- `project-os/DECISIONS.md` — baris ADR-071: Status diubah jadi
  `Accepted — Amended by ADR-075 (2026-08-07)`.
- `project-os/PROJECT_STATE.md` — **KI-018** ditutup (Status →
  Resolved), merujuk ADR ini.

Menutup KI-018.

---
