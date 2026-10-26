## Decision ADR-055

### Title

Light/Dark Mode Toggle diangkat jadi fitur resmi produk, mengoverride
"neutral theme selama M8" (ADR-041)

### Status

Accepted — Amended by ADR-097 (2026-09-01), Amended by ADR-102 (2026-09-08)

### Date

2026-07-31

### Decision

Toggle Light/Dark Mode ditambahkan sebagai **kontrol persisten di sidebar
footer** (`AppShell`/`SideNav`), berdampingan dengan user account dropdown,
berlaku di seluruh section produk. Default tema tetap **Light** saat load
pertama (tidak berubah dari sebelumnya). Toggle **sengaja tidak dipersist**
lintas full reload — tema selalu reset ke Light tiap kali halaman di-reload
penuh, sampai ada keputusan resmi soal persistensi (localStorage/cookie).

King Rezi awalnya meminta button switch light/dark; sebelum implementasi
dimulai, diklarifikasikan dulu (via `AskUserQuestion`) apakah ini alat
banding internal (sekadar pembanding visual, tidak masuk produk) atau fitur
resmi produk — King Rezi memilih **fitur resmi produk**.

### Reason

- Token dark mode sudah tersedia **native** di Astryx
  (`@astryxdesign/theme-neutral@0.1.8`), terverifikasi sejak smoke test awal
  ADR-041 — tidak ada implementasi dark mode custom/hand-rolled, murni
  meng-expose mekanisme bawaan Astryx (`<Theme mode={mode}>`) lewat kontrol
  UI baru. Ini yang membuat keputusan ini **tidak melanggar** ADR-041 (yang
  membatasi ke neutral theme, bukan melarang dark mode Astryx native).
- Sidebar footer adalah lokasi paling konsisten untuk kontrol yang berlaku
  lintas seluruh workspace (sejalan dengan pola user account dropdown yang
  sudah ada di lokasi yang sama).
- Menunda keputusan persistensi lintas reload menghindari risiko flash tema
  salah (light→dark atau sebaliknya) sebelum ada mekanisme resmi
  (localStorage/cookie + SSR-safe hydration) yang dipikirkan matang.

### Alternatives Considered

- **Toggle sebagai alat banding internal saja (tidak masuk produk)** —
  ditolak; King Rezi eksplisit memilih fitur resmi produk saat
  diklarifikasi.
- **Persist pilihan tema lintas reload sejak awal** — ditunda; berisiko
  flash tema salah tanpa mekanisme SSR-safe yang sudah diputuskan; dicatat
  sebagai open question terpisah, bukan diputuskan sekarang.
- **Toggle di tempat lain (header per-halaman, Settings)** — tidak dipilih;
  sidebar footer memberi akses konsisten dari section manapun tanpa
  navigasi tambahan, sejalan pola CTA pinned lain (ADR-053).

### Impact

- Claude Design (project "Social Media Management") — 7 layar KSP (Home,
  Publish Calendar/Queue/Drafts, Engage Inbox, Analyze Dashboard, Settings
  Connected Accounts) + App Prototype sudah mendapat toggle. `draft-editor.html`
  (KSP-05) **dikecualikan** — tidak punya sidebar sama sekali (modal
  fullscreen, ADR-052).
- `apps/web` — `src/app/providers.tsx` (`ThemeModeContext`/`useThemeMode`)
  dan `src/app/[slug]/workspace-side-nav.tsx` (`IconButton` toggle di
  footer, berdampingan user account dropdown).
- Diverifikasi: typecheck/lint/test hijau (26 test); QA end-to-end via
  browser (tunnel ngrok) — golden path toggle lolos, konsistensi tema lintas
  navigasi SPA terjaga, reset ke Light saat reload penuh dikonfirmasi
  working as intended (bukan bug), tidak ada regresi sidebar. Review
  arsitektur (Ridwan) lolos tanpa temuan — client component murni, tidak
  ada import domain/Prisma/Supabase/Outstand, pola context konsisten dengan
  `DraftEditorContext` yang sudah ada.
- **Belum selesai:** update `components/navigation.html` (dokumen referensi
  komponen AppShell+SideNav di Claude Design) masih tertunda — terblokir
  karena tool `DesignSync` sempat nonaktif di sesi kerja desain. File hasil
  edit sudah disiapkan lengkap di scratchpad, tinggal di-push saat
  `DesignSync` aktif kembali. Lihat Next Tasks di `PROJECT_STATE.md`.
- **Belum diputuskan:** persistensi tema lintas reload (localStorage/cookie)
  — sengaja ditunda, dicatat sebagai open question/next task terpisah.

---
