## Decision ADR-037

### Title

Perluasan daftar SocialPlatform: Threads & Pinterest

### Status

Accepted

### Date

2026-07-21

### Decision

Daftar platform media sosial yang didukung aplikasi **diperluas secara aditif** (platform lama tetap):

1. Instagram
2. Facebook
3. Twitter / X
4. LinkedIn
5. TikTok
6. YouTube
7. Threads _(baru)_
8. Pinterest _(baru)_

Enum kanonikal `SocialPlatform` di `packages/shared` dan Shared Types di Architecture Baseline (`domain-model.md`) diupdate agar mencakup `threads` dan `pinterest`. Referensi daftar platform di Integration Layer, Architecture Overview, dan UX (user-flows / key-screen-patterns) diselaraskan.

### Reason

- Product owner menetapkan Threads dan Pinterest sebagai platform yang tersedia di app, tanpa menghapus Twitter/X dan LinkedIn yang sudah ada di baseline.
- Shared enum harus menjadi Source of Truth tunggal agar Publishing, Connected Accounts, Analytics, dan UI selector tidak diverge.
- Perubahan bersifat aditif — tidak memperkecil scope platform yang sudah didokumentasikan.

### Alternatives Considered

- Mengganti daftar lama (hapus Twitter/X & LinkedIn, ganti dengan Threads & Pinterest) — ditolak; product owner memilih opsi _tambah saja_.
- Mencatat hanya di CONVERSATIONS tanpa update enum/baseline — ditolak; risiko implementasi M8 memakai daftar yang usang.

---
