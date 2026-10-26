## Decision ADR-134

### Title

Tiket yang lahir dari Known Issue pindah ke `tickets/known-issues.md` (amandemen ADR-131)

### Status

Accepted

### Date

2026-10-19

### Decision

Tiket yang ada karena sebuah Known Issue — bukan karena kerja sebuah rilis — tinggal di `project-os/tickets/known-issues.md`.

Pada tanggal keputusan ini yang pindah adalah T-119 (KI-015), T-120 (KI-033), T-121 (KI-050), T-122 (KI-053), T-123 (KI-089), dan T-124 (KI-091).

Tiket rilis yang kebetulan memuat atau menutup satu KI tetap di `tickets/vXX-*.md`. T-008 tetap rumah KI-027. T-088 tetap rumah KI-028. Tiket promosi yang sudah menjadi kerja rilis (misalnya T-107, T-108, T-109, T-110, T-111) juga tetap di file rilisnya.

KI yang masih terbuka tetap menunjuk satu tiket (ADR-132). Yang berubah hanya filenya. Nomor `T-NNN` tidak diubah. Antrian tetap di `AVAILABLE_TICKETS.md`; kolom File menunjuk `known-issues.md` untuk tiket di atas.

Tiket KI baru berikutnya ditulis di `known-issues.md`, bukan diselipkan ke file rilis.

### Reason

- File rilis (terutama v0.1 dan v0.2) ikut terbuka saat agent membuka tiket yang sebenarnya hanya pelacak Known Issue.
- Section "Dari Known Issue" di dalam file rilis sudah memisahkan tiket itu secara isi, tapi masih satu berkas dengan kerja rilis.
- ADR-131 menolak satu file per tiket. Satu file untuk seluruh tiket Known Issue menjaga pandangan itu, tanpa mengembalikan tiket KI ke novel rilis.

### Alternatives Considered

- Satu file per tiket KI — ditolak. ADR-131 sudah menolak pecahan satu berkas per tiket.
- Memindahkan juga setiap tiket rilis yang pernah menutup sebuah KI — ditolak. Itu kerja rilis yang selesai, rumahnya tetap file rilis.
