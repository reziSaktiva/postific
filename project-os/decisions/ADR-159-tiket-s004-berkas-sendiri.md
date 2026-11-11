## Decision ADR-159

### Title

Tiket S-004 tinggal di berkas sendiri (amandemen ADR-131, ADR-134)

### Status

**Accepted** (keputusan King Rezi, 2026-11-11)

### Date

2026-11-11

### Decision

Tiket spec S-004 tinggal di `project-os/tickets/s004-orchestration-language.md`. Satu berkas menampung seluruh tiket spec itu. Nomor `T-NNN` tidak berubah. Antrian tetap di `AVAILABLE_TICKETS.md`; kolom File menunjuk berkas itu.

Tiket rilis tetap di `tickets/vXX-*.md`. Tiket yang lahir dari Known Issue tetap di `tickets/known-issues.md` (ADR-134). Tiket S-003 tetap di `tickets/v01-foundation.md`.

Spec lain tidak mendapat berkas sendiri dari keputusan ini.

### Reason

- File rilis v0.1 sudah memuat tiket fondasi dan tiket orkestrasi S-003. Menambah tiket S-004 di berkas yang sama membuat file itu terbuka untuk kerja yang bukan rilis.
- ADR-131 menolak satu berkas per tiket. Satu berkas untuk seluruh tiket S-004 menjaga batas itu.

### Alternatives Considered

- Menitipkan tiket S-004 di `tickets/v01-foundation.md`, seperti tiket S-003. Ditolak King Rezi 2026-11-11.
- Satu berkas per tiket. Ditolak. ADR-131 sudah menolak pecahan itu.
- Satu berkas untuk setiap spec. Tidak diputuskan di sini. Hanya S-004.
