## Decision ADR-164

### Title

Tiket S-007 tinggal di berkas sendiri (mengamandemen ADR-159, ADR-131, ADR-134)

### Status

**Accepted** (keputusan King Rezi di chat, 2026-11-12)

### Date

2026-11-12

### Decision

Tiket spec S-007 (T-263 sampai T-277) tinggal di `project-os/tickets/s007-documentation-language.md`, mengikuti pola S-004 (ADR-159). Satu berkas menampung seluruh tiket spec itu. Nomor `T-NNN` tidak berubah. Antrian tetap di `AVAILABLE_TICKETS.md`; tabel berkas di sana menunjuk berkas itu.

Tiket rilis tetap di `tickets/vXX-*.md`. Tiket yang lahir dari Known Issue tetap di `tickets/known-issues.md` (ADR-134). Tiket S-004 tetap di `tickets/s004-orchestration-language.md` (ADR-159). Tiket S-003 tetap di `tickets/v01-foundation.md`.

Spec lain tidak mendapat berkas sendiri dari keputusan ini.

### Reason

- King Rezi meminta tiket S-007 dipindah ke berkas sendiri seperti tiket S-004 (2026-11-12).
- Berkas rilis v0.1 tidak perlu memuat 15 tiket kerja bahasa yang bukan rilis. ADR-159 sudah menetapkan pola itu untuk S-004.
- ADR-131 menolak satu berkas per tiket. Satu berkas untuk seluruh tiket S-007 menjaga batas itu.

### Alternatives Considered

- Membiarkan tiket S-007 di `tickets/v01-foundation.md`, seperti tiket S-003. Ditolak King Rezi 2026-11-12.
- Satu berkas per tiket. Ditolak. ADR-131 sudah menolak pecahan itu.
- Satu berkas untuk setiap spec. Tidak diputuskan di sini. Hanya S-004 dan S-007.

### Consequences

- Penunjuk ke berkas tiket S-004 di `AGENTS.md`, skill `project-os-navigator`, `AVAILABLE_TICKETS.md`, `specs/README.md`, dan `.claude/agents/README.md` ikut menyebut berkas S-007.
- Tiket T-263 sampai T-277 dipindah utuh dari `tickets/v01-foundation.md`. Isinya tidak berubah.
