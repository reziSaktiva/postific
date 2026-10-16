# Developer Workflow

Catatan untuk developer (manusia maupun AI agent) yang bekerja di repo ini —
menjawab "bagaimana kerja di project ini berjalan?" dalam bentuk diagram.

**Ini bukan Source of Truth.** Diagram di sini adalah **visualisasi** dari
proses dan flow yang sudah didefinisikan di dokumen lain. Kalau ada
perbedaan antara diagram di sini dan dokumen aslinya, **dokumen asli yang
menang** — update dokumen aslinya dulu, lalu sinkronkan diagram ini.

Pintu masuk penuh tetap `../AGENTS.md`. Dokumen ini melengkapi, bukan
menggantikan.

---

## 1. Alur kerja project — dari kebutuhan sampai kode

Bagaimana sebuah kebutuhan bergerak dari percakapan sampai menjadi dokumen
atau kode. Empat lapisnya: docs, spec, tiket, lalu implementasi (ADR-131).
Kode di `apps/` dan `packages/` hanya dimulai setelah tiketnya ada (ADR-132).

```mermaid
flowchart TD
  A[Kebutuhan baru, atau pilih satu ID<br/>dari AVAILABLE_TICKETS.md] --> B{Kebenaran produk berubah?}

  B -->|Ya| C[Tulis product-discovery/ dulu]
  C --> C2{Penunjuk context/ berubah?}
  C2 -->|Ya| C3[Update context/ctx-*.md<br/>jangan salin paragraf yang sama]
  C2 -->|Tidak| D
  C3 --> D[ADR di project-os/decisions/<br/>bila keputusannya material]
  D --> E

  B -->|Tidak| E{Melewati lebih dari satu sesi?}

  E -->|Ya| F[Tulis specs/S-NNN.md<br/>perilaku, jahitan tes, di luar spec]
  F --> Q
  E -->|Tidak, tanpa spec| Q{Mengubah kode<br/>di apps/ atau packages/?}

  Q -->|Tidak| L
  Q -->|Ya| G[Tiket di tickets/vXX-*.md<br/>sudah ada sebelum baris kode pertama<br/>menunjuk docs atau spec]

  G --> R[Baca context/ctx-*.md yang relevan]
  R --> H{Menyentuh UI?}

  H -->|Tidak| K
  H -->|Ya| I{Rancangan ada di Claude Design<br/>dan polanya sudah terkunci?}
  I -->|Belum ada, atau pola masih ambigu| STOP[Berhenti dan tanya King Rezi<br/>jangan menulis kode UI]
  I -->|Sudah| J[Baca apps/web/.claude/CLAUDE.md<br/>lalu CLI/MCP shadcn]
  J --> K[Kode domain, job, atau API]

  K --> L[Bila tiket dikerjakan: status ✅<br/>baris keluar dari AVAILABLE_TICKETS<br/>tanpa cerita sesi]
  L --> M{Fase, milestone, KI,<br/>atau fokus terdekat berubah?}
  M -->|Ya| P[Update PROJECT_STATE.md]
  M -->|Tidak| O[Selesai]
  P --> O
```

Perubahan dokumen tidak memakai aturan tiket. Known Issue yang masih terbuka
menunjuk satu tiket; barisnya di `PROJECT_STATE.md` cukup menyebut ID dan
tiket itu. Jejak sesi ada di git.

**Rujukan:** `../AGENTS.md` (aturan 17, 20, 22), `specs/README.md`,
`context/README.md`, ADR-131, ADR-132. ADR-062 tetap berlaku untuk bentuk
backlog per rilis pada bagian yang tidak diubah kedua ADR itu. Gerbang desain
UI: ADR-042 dan ADR-056.

---

## 2. Alur pengguna — dari buka aplikasi sampai konten terjadwal

End-to-end: auth → workspace → connect account → publish. Ini gabungan dari
`auth-architecture.md` (session & workspace resolution), UF-05 (Connect
Account), dan UF-01 (Create & Schedule Content) di
`product-discovery/04-ux/user-flows.md` — bukan flow baru.

```mermaid
flowchart TD
  A[User membuka aplikasi] --> B{Ada session aktif?<br/>cookie better-auth.session_token}

  B -->|Tidak| C[Sign up / Sign in<br/>email-password atau Google OAuth]
  C --> C2[Session cookie dibuat<br/>HTTP-only, 7 hari]
  B -->|Ya| D{Middleware: workspaceSlug<br/>valid di URL?}
  C2 --> D

  D -->|Belum punya workspace| E[Onboarding: buat workspace pertama<br/>user otomatis jadi Owner]
  D -->|Sudah, role di-resolve| F[Masuk workspace aktif<br/>x-workspace-id + x-workspace-role]
  E --> F

  F --> G{Ada akun sosial<br/>terhubung? UF-05}
  G -->|Belum| H[Workspace Settings →<br/>Connected Accounts]
  G -->|Sudah| M[Publish → Drafts → New Post]

  H --> I[+ Connect Account → pilih platform<br/>IG · FB · X · LinkedIn · TikTok<br/>YouTube · Threads · Pinterest]
  I --> J[OAuth di platform pihak ketiga]
  J --> K{OAuth sukses?}

  K -->|Ya| K2[Akun muncul, status Active]
  K -->|Tidak / batal| H

  K2 --> M
  M --> N[Tulis caption<br/>manual atau AI Assist inline opsional]
  N --> O[Lampirkan media<br/>file lokal atau Media Library]
  O --> P[Account Selector<br/>pilih satu atau beberapa akun tujuan]
  P --> P2[Content Format per akun — ADR-039<br/>IG/FB: Post · Reel · Story<br/>Pinterest: Pin · lainnya: Post]
  P2 --> Q{Siap dijadwalkan?}

  Q -->|Belum| R[Save as Draft]
  Q -->|Ya| S[Schedule Picker → Confirmation Summary<br/>→ Schedule]

  R --> T[Status: Draft<br/>tampil di Publish → Drafts]
  S --> U[Status: Scheduled<br/>tampil di Calendar & Queue]
```

**Rujukan:** `../product-discovery/05-architecture/auth-architecture.md`,
`../product-discovery/04-ux/user-flows.md` (UF-01, UF-05),
`../product-discovery/04-ux/key-screen-patterns.md` (KSP-05), ADR-039.

Engagement (UF-04) dan Analytics (UF-06) tidak digambar di sini — keduanya
adalah siklus terpisah setelah konten published, lihat langsung
`user-flows.md`.

---

## 3. Siklus status konten (state per role)

Enam status kanonikal dan siapa yang boleh memicu tiap transisi — dari
`product-discovery/02-product/roles-permissions.md`. Sejak ADR-074 (3 role:
Account Owner/Admin/Creator), semua role memiliki hak yang sama untuk
transisi status konten — tidak ada lagi role yang dibatasi hanya sampai
`In Review`.

```mermaid
flowchart TD
  N((baru)) --> D[Draft]
  D -->|siapa saja: Account Owner/Admin/Creator| IR[In Review]
  IR -->|kembali: Account Owner/Admin/Creator| D
  IR -->|Account Owner/Admin/Creator| RS[Ready to Schedule]
  RS -->|Account Owner/Admin/Creator| SC[Scheduled]
  D -->|Account Owner/Admin/Creator, skip review| SC
  SC -->|tarik jadwal: Account Owner/Admin/Creator| D
  SC -->|otomatis, sistem| PB[Published]
  SC -->|otomatis, sistem| FL[Failed]
  FL -->|Account Owner/Admin/Creator| D
```

**Catatan:** Post yang sudah `Scheduled` **tidak** otomatis batal saat akun
disconnect (KSP-D09) — tetap menunggu di antrean sampai akun reconnect.

**Rujukan:** `../product-discovery/02-product/roles-permissions.md`,
`../product-discovery/04-ux/key-screen-patterns.md` (KSP-D09).

---

## Related Documents

- `../AGENTS.md` — pintu masuk agent, aturan keras
- `../context/README.md` — indeks AI Context per domain
- `PROJECT_STATE.md` — phase, milestone, Known Issues, blockers
- `AVAILABLE_TICKETS.md` — antrian tiket yang belum selesai; tiket di `tickets/vXX-*.md`
- `specs/README.md` — bentuk spec untuk kerja yang melewati lebih dari satu sesi (ADR-131)
- `DECISIONS.md` — indeks ADR; teks penuh di `decisions/`
- `../product-discovery/04-ux/user-flows.md` — flow lengkap (UF-01 s/d UF-06)
- `../product-discovery/02-product/roles-permissions.md` — roles & content status
- `../product-discovery/05-architecture/auth-architecture.md` — auth & session detail
- `../context/ctx-design.md` — pointer Claude Design project (ADR-045)
