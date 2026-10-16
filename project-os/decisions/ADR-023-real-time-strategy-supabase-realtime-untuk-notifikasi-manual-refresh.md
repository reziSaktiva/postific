## Decision ADR-023

### Title

Real-time Strategy — Supabase Realtime untuk Notifikasi + Manual Refresh

### Status

Accepted — Amended by ADR-040 (2026-07-23)

### Date

2026-07-15

### Decision

Sistem menggunakan **Supabase Realtime** hanya untuk tabel `notifications` (event `INSERT`, filter per `user_id`). Semua data lain (content calendar, engagement list, analytics) menggunakan **manual refresh** atau **optimistic update** setelah aksi user.

Scope real-time MVP:

- Notifikasi in-app (badge count, toast) via Supabase Realtime subscription.
- Content calendar dan engagement inbox: manual refresh dipicu user atau hint dari notifikasi.
- Analytics: manual refresh on demand.
- Presence dan collaborative editing: Post-MVP.

### Reason

- Real-time hanya untuk notifikasi — scope minimal yang memberikan nilai UX terbesar (awareness tim tanpa polling agresif).
- Supabase Realtime sudah built-in dalam Supabase stack yang digunakan — tidak perlu infrastruktur WebSocket terpisah.
- Content calendar tidak memerlukan real-time — perubahan status sudah dikomunikasikan via notifikasi.
- Mengurangi kompleksitas client-side subscription lifecycle untuk MVP.

### Alternatives Considered

- Real-time subscription untuk seluruh data (post, calendar, engagement) — terlalu kompleks untuk MVP, menambah subscription overhead.
- Polling interval (misal setiap 30 detik) — lebih sederhana dari Realtime, tapi konsumsi bandwidth dan load database lebih tinggi.
- Server-Sent Events (SSE) — alternatif Realtime yang lebih sederhana, tapi tidak terintegrasi native dengan Supabase RLS.

---
