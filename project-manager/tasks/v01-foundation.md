# v0.1 — Foundation

> Bagian dari backlog berjenjang. Indeks + legend status: [`../TASKS.md`](../TASKS.md).

**Tujuan rilis:** Membangun fondasi aplikasi.
**Baseline rilis:** `product-discovery/02-product/release-roadmap.md` → v0.1

---

## Project Setup

### T-001 · Monorepo, tooling, dan CI

`✅ Done` · **ADR** ADR-001, ADR-002, ADR-026, ADR-032, ADR-034, ADR-035

Bun + Next.js 16 + Astryx, workspace `apps/web` + `packages/shared`, ESLint/Prettier, Lefthook + lint-staged, Vitest, GitHub Actions gates.

### T-002 · Prisma schema + migrasi awal

`✅ Done` · **ADR** ADR-014, ADR-027, ADR-031, ADR-033

22 model dengan domain prefix, 4 migrasi. Kode: `apps/web/prisma/schema.prisma`.

> ⚠️ Schema jauh mendahului kode — 15 dari 22 model belum punya repository/service. Ini disengaja (schema-first), bukan utang.

### T-094 · Baseline Rendering Strategy, Code Conventions, Spacing Scale + ESLint Enforcement (ADR-095)

| Field         | Value                                                        |
| ------------- | ------------------------------------------------------------ |
| **Status**    | ✅ Done — baseline dokumentasi (`rendering-strategy.md`, `code-conventions.md`), penguncian Spacing scale di `design-tokens.md`, dan 3 rule ESLint enforcement sudah selesai & terverifikasi (lint/typecheck/test hijau: 0 error, 209 test passed/3 skipped). 1 subtask (cleanup dashboard) sengaja dibiarkan terbuka, tidak memblokir penutupan — di luar scope ADR-095, lihat **KI-036** |
| **Domain**    | platform/tooling (bukan salah satu domain produk)             |
| **ADR**       | ADR-095                                                      |
| **Depends**   | —                                                             |
| **Baca dulu** | `06-engineering/rendering-strategy.md` · `06-engineering/code-conventions.md` · `06-engineering/design-tokens.md` (§ Spacing) · `decisions/ADR-095-baseline-rendering-strategy-code-conventions-spacing-scale-server-actions-mutation-only.md` |

Menuliskan konvensi rendering, error handling, dan spacing yang sudah konsisten dipakai di kode sebagai baseline resmi, sekaligus menegaskan ulang (bukan mengubah) ADR-016 bahwa Server Actions eksklusif untuk mutation. Ditemukan 1 inkonsistensi pra-existing (`app/(app)/page.tsx` dashboard fetch data lewat Server Action) yang sengaja tidak diperbaiki di sesi ini — dicatat sebagai subtask terbuka T-094.4 + **KI-036**.

- [x] **T-094.1** Baseline baru `rendering-strategy.md` dan `code-conventions.md` di `product-discovery/06-engineering/`
- [x] **T-094.2** Kunci section Spacing di `design-tokens.md` (base 1 unit = 4px, skala 0/0.5/1/1.5/2/3/4/5/6/8 = 0–32px, `TBD` sejak ADR-038 dihapus)
- [x] **T-094.3** 3 rule ESLint enforcement di `eslint.config.mjs` (domain import boundary via `no-restricted-imports`, larangan `<div>` mentah via `no-restricted-syntax`, `tailwindcss/no-arbitrary-value: "error"`) — 6 lokasi arbitrary-value token-backed existing (`ChannelsSection.tsx`, `ConnectedAccountsList.tsx`) diberi `eslint-disable-next-line` + komentar alasan
- [ ] **T-094.4** Cleanup `app/(app)/page.tsx` (dashboard) agar fetch data lewat Application Service langsung dari Server Component (RS-D02), bukan `getDashboardSummaryAction` — lihat **KI-036**

---

## Authentication

### T-003 · Better Auth core config

`✅ Done` · **ADR** ADR-024, ADR-030

`prismaAdapter`, email/password, Google social provider, session 7 hari, auth guard di `proxy.ts`. Kode: `apps/web/src/lib/better-auth/`.

### T-004 · Auth screens (login / register / forgot / reset)

`✅ Done` · **ADR** ADR-024

Empat halaman + form fungsional memanggil `authClient`. Kode: `apps/web/src/app/(auth)/`.

> Catatan lama di sini merujuk ke isu tunnel ngrok (salah menyebut "T-017" — seharusnya T-018) yang sudah tidak berlaku sejak ADR-070 (self-hosted Better Auth, testing langsung via `localhost:3000`, tanpa ngrok). Lihat T-018 (⏸️ Deferred) untuk detail.

### T-005 · Email verification flow

| Field         | Value                                                                 |
| ------------- | --------------------------------------------------------------------- |
| **Status**    | 🚫 Blocked                                                             |
| **Domain**    | identity                                                              |
| **ADR**       | —                                                                     |
| **Depends**   | T-003 ✅                                                               |
| **Blocker**   | Transactional email provider belum ditetapkan (AS-D04)                |
| **Baca dulu** | `06-engineering/auth-strategy.md` (AS-D04) · `05-architecture/auth-architecture.md` |

Aktifkan verifikasi email + password reset yang benar-benar mengirim email. Saat ini `sendResetPassword` hanya `console.log` link dan `requireEmailVerification` dinonaktifkan.

- [ ] **T-005.1** Pilih provider (kandidat: Resend, Postmark, AWS SES, SMTP Supabase) → butuh ADR baru
- [ ] **T-005.2** Konfigurasi provider + env var di `environment-management.md`
- [ ] **T-005.3** Implementasi `sendResetPassword` + `sendVerificationEmail` nyata
- [ ] **T-005.4** Halaman `verify-email` + state "menunggu verifikasi"
- [ ] **T-005.5** Aktifkan `requireEmailVerification: true`

---

## Workspace & Members

### T-006 · Workspace creation + onboarding

`✅ Done` · **ADR** ADR-018

`WorkspaceService.createWorkspace` (slugify + retry slug), halaman `/onboarding`, resolve default workspace di root. Kode: `apps/web/src/domains/workspace/`.

### T-007 · Members management (invite / remove / update role)

| Field         | Value                                                              |
| ------------- | ------------------------------------------------------------------ |
| **Status**    | ✅ Done — jalur **Copy Link** tuntas (T-007.1–.6 + T-093); **T-007.8** Pending list ✅; **T-007.7** Kirim via Email ✅ 2026-10-12 memakai Resend yang sudah dipasang untuk T-110 (`RESEND_API_KEY` / `RESEND_FROM_EMAIL`), tanpa menutup T-005 |
| **Domain**    | workspace                                                          |
| **ADR**       | ADR-012 (roles), ADR-049 (konfirmasi Remove Member & Update Role), ADR-072 (tabel `workspace_invitations`), ADR-080 (dua metode invite — Email + Copy Link, amandemen ADR-072) |
| **Depends**   | T-006 ✅, T-005 (soft dependency — hanya memblokir opsi "Kirim via Email", bukan T-007.1 jalur "Copy Link", lihat ADR-080) |
| **Baca dulu** | `02-product/roles-permissions.md` · `05-architecture/application-layer.md` |

Screen Workspace Settings → Members. Disepakati **desain minimal dulu**: cukup daftar anggota + Remove Member, tanpa manajemen anggota lengkap.

**Catatan (2026-08-14, ADR-080):** invite member dipecah jadi dua metode — **Copy Link** (generate invitation + token, dibagikan manual) dan **Kirim via Email** (tetap menunggu T-005, tampil disabled di UI sampai provider siap). Desain UI dialog invite (dialog "Undang Anggota Baru" — Selector Role, 2 opsi metode dengan Copy Link default aktif dan Kirim via Email disabled berbadge "Segera", link readonly + tombol Salin) sudah dibuat di Claude Design (`templates/settings-members.html`) — table anggota + dialog Remove/Update Role yang sudah ada tidak diubah.

> ⚠️ **Copy Link belum jadi alur invite yang utuh** (ditemukan CodeRabbit, review PR #73): halaman `/invite/[token]` (accept-invite — validasi token, buat akun/login dengan email yang sama, insert `workspace_members`) **belum dibuat sama sekali** (ADR-072 "future work" terpisah). Yang sudah selesai di T-007.1/.6 baru **pembuatan invitation + link**, bukan penerimaan undangan sampai jadi member. Link yang dihasilkan hari ini akan 404 kalau dibuka — fitur ini belum bisa dipakai end-to-end sampai halaman accept-invite dibangun (task terpisah, belum ada nomor T-XXX).

**Status implementasi T-007.1/.5/.6 (2026-08-14):** Ketiganya lolos review arsitektur Ridwan (bersih, tanpa temuan) serta QA Najwa (typecheck/lint/test: 126 passed + 3 skip pre-existing). Verifikasi browser yang **benar-benar berhasil**: gating tombol submit (disabled sampai email valid), radio group Copy Link/Kirim via Email tampil sesuai desain, dialog konfirmasi Remove Member/Update Role termount dengan copy yang benar. Verifikasi yang **tidak** berhasil dibuktikan hidup: submit "Buat Link Undangan" gagal karena env `JOB_SECRET` belum diisi (known gap, KI-015) — jadi generate-link-lalu-salin belum pernah dibuktikan visual sukses; Remove Member/Update Role end-to-end juga tidak bisa diuji karena dev DB cuma 1 member. Heading duplikat "Members" yang sempat muncul saat implementasi (akibat `MembersTable` merender heading section-nya sendiri berdampingan dengan heading halaman) sudah diperbaiki lewat slot `headerAction` baru di `MembersTable`.

- [x] **T-007.1** `WorkspaceService.inviteMember` — jalur **Copy Link**: generate invitation email-bound + token (unit test lolos, review arsitektur bersih) — `removeMember`/`updateMemberRole` selesai. **Cakupan hanya pembuatan invitation**, bukan penerimaannya (lihat catatan di atas) — jangan anggap invite-to-membership sudah utuh. **Terkait KI-053** (Security/Bug, Open, 2026-09-07) — kalau email A ditarget tapi link terbuka email B dan A belum punya akun, B bisa membajak identitas A saat submit di `/invite/[token]` (akar masalah KI-001, `requireEmailVerification: false`); belum ada mitigasi.
- [x] **T-007.2** Repository method + migrasi tabel invitation (jika perlu)
- [x] **T-007.3** Server Actions + validasi RBAC di application layer
- [x] **T-007.4** UI daftar anggota di `/settings/members` (Astryx Table)
- [x] **T-007.5** Dialog konfirmasi Remove Member + Update Member Role (ADR-049 Tier 2) — selesai, UI-nya terverifikasi browser; alur end-to-end penuh belum teruji (lihat catatan di atas)
- [x] **T-007.6** UI dialog invite member dengan 2 opsi (Copy Link aktif, Kirim via Email disabled) + field email-bound wajib (ADR-080 poin 6) — UI sesuai desain Claude Design terverifikasi; submit sukses (generate+copy link) belum terbukti hidup karena gap `JOB_SECRET`
- [x] **T-007.7** ✅ Done (2026-10-12) — jalur **Kirim via Email**: `inviteMember` tetap hanya membuat invitation; `sendMemberInvitationEmail` mengirim link yang sama lewat Resend (`IInviteEmailSender.sendMemberInvitation`) setelah invitation dibuat (ADR-080 poin 3). UI radio "Kirim via Email" diaktifkan (badge "Segera" dihapus). Kalau pengiriman gagal, invitation tetap ada dan link ditampilkan supaya bisa disalin manual. **Bukan penutupan T-005** — provider global (reset password, `requireEmailVerification`) tetap terbuka; yang dipakai di sini adalah Resend yang sudah dikunci T-110 dan env-nya sudah diisi King Rezi. **Catatan (2026-09-07, ADR-101 mengamandemen ADR-100):** rencana awal ADR-100 (pre-create baris `workspace_members` berstatus `Pending`) **digantikan** oleh T-007.8.
- [x] **T-007.8** ✅ Done (2026-09-07) — Members list (`/settings/members`) menampilkan undangan pending sebagai baris status **Pending** — **berlaku kedua metode invite** (Copy Link + Kirim via Email), lewat gabungan data `workspace_members` + `WorkspaceInvitation` (`status=pending`, belum expired), pola dikunci **ADR-101** (2026-09-07, mengamandemen ADR-100/menutup KI-046 sisi teknis). Identitas baris virtual pakai `invitation.email`. Aksi hanya **Cancel Invitation** (revoke), bukan Change Role. **Tidak bergantung T-005** — datanya sudah tersedia dari Copy Link (T-007.1 ✅). Depends: T-007.1 ✅. **Implementasi (Prabowo Feature Engineer):** merge presentasi `workspace_members` + `WorkspaceInvitation` pending belum expired di `WorkspaceService`, aksi `revokeInvitation` (RBAC `assertActorCanManageMembers`), tanpa migrasi skema (sesuai ADR-101 poin 4). **Review arsitektur (Ridwan Architecture Reviewer):** 1 temuan race condition di `revokeInvitation` — sudah diperbaiki Prabowo, re-verifikasi bersih (typecheck/lint/test: 269 passed, 5 skipped, 0 error). **QA end-to-end (Najwa QA Engineer, browser real):** golden path invite → baris Pending muncul → cancel → link jadi graceful-invalid (PASS); golden path accept → baris Pending hilang jadi Active (PASS); member existing tidak regresi (PASS); mobile 375px (PASS); RBAC Creator tetap tidak bisa akses `/settings/members` (PASS); invitation expired tidak muncul di list (PASS) — **semua PASS, 0 bug ditemukan**.

### T-093 · Accept Invite page — invite-to-membership utuh + verifikasi RBAC 2-akun

| Field         | Value                                                        |
| ------------- | ------------------------------------------------------------ |
| **Status**    | ✅ Done — 4/4 subtask selesai, verifikasi RBAC end-to-end (Najwa QA Engineer, 3 akun real Owner/Admin/Creator) tuntas 2026-08-31 |
| **Domain**    | workspace                                                    |
| **ADR**       | ADR-012 (roles), ADR-072 (tabel `workspace_invitations`), ADR-080 (dua metode invite), **ADR-096** (pola RLS SECURITY DEFINER + session-variable GUC untuk operasi pra-membership) |
| **Depends**   | T-007.1/.6 ✅ (invitation + role sudah bisa dibuat), T-006 ✅ (workspace creation) |
| **Baca dulu** | `02-product/roles-permissions.md` · `05-architecture/application-layer.md` · `decisions/ADR-080-invite-member-dua-metode-email-copy-link-amandemen-adr-072.md` · `decisions/ADR-096-*.md` |

Ditemukan CodeRabbit saat review PR #73 (2026-08-14): halaman `/invite/[token]` (accept-invite) **belum pernah dibuat sama sekali** — link Copy Link yang dihasilkan T-007.1/.6 hari ini 404 kalau dibuka. Dicatat sebagai "future work terpisah, belum ada nomor T-XXX" di `COMPLETE_TASK.md`/ADR-080 sejak saat itu, baru dikonversi jadi task resmi di sini (2026-08-28, saat menyusun rantai dependency ADR-094 Realtime — Realtime butuh ≥2 akun nyata di satu workspace untuk bisa diuji maupun bermakna dipakai).

**Terkait KI-053** (Security/Bug, Open, 2026-09-07): halaman `/invite/[token]` (`AcceptInviteForm.tsx`) mengunci field email jadi read-only ke email undangan, tapi tidak memverifikasi kepemilikan inbox — kalau email A belum punya akun dan link terbuka email B, B bisa membajak identitas A saat sign-up. Akar masalah KI-001 (`requireEmailVerification: false`). Belum ada mitigasi.

**Update 2026-08-31 — implementasi selesai, lolos review Ridwan (2 temuan security sudah diperbaiki):** UI auto-detect email baru vs sudah terdaftar (bukan pilihan manual, desain final Claude Design `templates/accept-invite.html`), method baru langsung di `WorkspaceService` (bukan use-case terpisah, konsisten pola existing), redirect sukses `router.push("/")` + cookie `active-workspace-id` (bukan `/[slug]`, ADR-076 sudah menghapus dynamic segment). 3 migrasi RLS baru diterapkan ke DB dev (`20260831035427_t093_accept_invite_rls`, `20260831042017_t093_invitation_select_visibility_fix`, `20260831044328_t093_code_review_rls_hardening`) — pola dan rasionalnya dicatat di **ADR-096**. 17 unit test baru (fake repository) + 1 integration test terhadap DB real (`workspace.repository.accept-invitation.test.ts`).

- [x] **T-093.1** Route `/invite/[token]` — validasi token (valid, belum expired/revoked, email undangan cocok) + auto-detect `isExistingUser`
- [x] **T-093.2** Alur buat akun baru **atau** login (kalau email sudah punya akun) via Better Auth — email harus sama persis dengan yang di-invite (email-bound, ADR-080), tidak bisa diedit manual di form
- [x] **T-093.3** Insert `workspace_members` dengan **role diambil langsung dari invitation** (sudah dipilih lewat Selector Role saat invite dibuat, T-007.6) — bukan role kosong/default yang di-assign belakangan, lalu redirect ke workspace
- [x] **T-093.4** Verifikasi/hardening RBAC end-to-end dengan akun real kedua — Owner vs Admin vs Creator (Danger Zone hidden non-Owner, Transfer Ownership 2-akun, Update Role, Remove Member, RBAC assertion lain seperti `assertActorCanCancelSchedule`) yang sejauh ini cuma diverifikasi lewat code review, bukan browser dengan akun berbeda (lihat gap QA T-008); perbaiki di sini kalau ditemukan bug. **Selesai (2026-08-31):** 17 unit test service-level (fake repository) + 1 integration test DB real (`workspace.repository.accept-invitation.test.ts`) — ditambah verifikasi RBAC end-to-end oleh Najwa QA Engineer dengan **3 akun real** (Owner/Admin/Creator) di satu workspace ("Insvire"): Danger Zone hidden non-Owner, target Transfer Ownership eligible (Admin saja, bukan Creator), Update Role, Remove Member (proteksi Owner/diri sendiri) — semua **PASS**. **Bug ditemukan & diperbaiki selama verifikasi (KI-038, resolved):** Creator seharusnya "Tidak ada akses" ke `/settings/members` (`02-product/roles-permissions.md`), tapi halaman sebelumnya tetap terbuka dan mengirim data member+email ke client — `MembersTable` cuma menyembunyikan tombol aksi per baris, tidak pernah mengecek role si pengunjung halaman (information disclosure UI-level; backend `assertActorCanManageMembers` sudah benar sejak awal, tidak ada mutasi tidak sah yang berhasil). **Fix (commit `6fdf272`):** `WorkspaceService.canManageMembers(workspaceId, actorUserId)` — method publik baru reuse `assertActorCanManageMembers` privat; `apps/web/src/app/(app)/settings/members/page.tsx` gate `canManageMembers` dipanggil sebelum `listMembersWithUser`, redirect `/settings` di server kalau `false` (sebelum data member pernah diambil); 5 unit test baru. Diverifikasi ulang live: Raka & Maya tetap akses penuh (tidak regresi), Sinta langsung redirect tanpa data member sempat tampil. Full suite: 229 passed, 4 skipped. **Update 2026-09-04 (KI-045, Resolved):** gap serupa ditemukan lagi meluas ke `/settings` (General) dan `/settings/billing` — root cause dikonfirmasi kedua halaman itu **tidak pernah** punya guard sejak awal (bukan regresi baru dari migrasi T-099 seperti dugaan awal). Ditutup dengan pola yang sama (`canManageWorkspaceSettings`/`assertActorCanManageWorkspaceSettings`), lihat `tasks/v07-astryx-shadcn-migration.md` § T-102, `PROJECT_STATE.md` § KI-045.

### T-110 · Verifikasi kepemilikan email di accept-invite (cegah identity takeover)

| Field         | Value                                                        |
| ------------- | ------------------------------------------------------------ |
| **Status**    | ✅ Done (2026-10-06, commit `bad28cb`) — seluruh implementasi sudah ter-commit & jadi ancestor `staging`; T-110.1–.4 terverifikasi lewat kode/unit test, T-110.5 unit test lengkap tapi verifikasi E2E browser nyata (skenario email A vs B beda orang) belum tercatat buktinya — dicatat sebagai gap terbuka, bukan blocker penutupan (ditemukan via audit dokumentasi 2026-10-12, lihat catatan di bawah) |
| **Domain**    | identity · workspace                                         |
| **ADR**       | — (kandidat ADR baru kalau pola verifikasi ini mau dipakai ulang di alur lain — evaluasi saat implementasi) |
| **Depends**   | T-093 ✅ (Accept Invite page) |
| **Baca dulu** | `PROJECT_STATE.md` § riwayat KI-053 (`COMPLETE_TASK.md` kalau sudah diarsipkan) · `apps/web/src/app/(auth)/invite/[token]/components/AcceptInviteForm.tsx` · `apps/web/src/domains/workspace/services/workspace.service.ts` (`acceptInvite`) · `apps/web/src/lib/better-auth/auth.ts` |
| **Ditemukan** | KI-053 (2026-09-07, King Rezi) — mitigasi & provider dikonfirmasi King Rezi 2026-09-28: verifikasi email **khusus alur accept-invite** (independen dari T-005/`requireEmailVerification` penuh), provider **Resend**. |

**Gap:** kalau invite via Copy Link ditujukan ke email A tapi link dibuka email B, dan email A **belum pernah punya akun** (`isExistingUser: false`), email B bisa langsung mengisi Nama + Password sendiri dan submit — form mengunci field email jadi read-only ke email A, tapi ini cuma memastikan string email cocok, **bukan** membuktikan B benar-benar memegang inbox A. Root cause: `requireEmailVerification: false` di Better Auth (`auth.ts:53`) — tidak ada email konfirmasi kepemilikan inbox saat sign-up. Dampak: B efektif membajak identitas A; kalau A kemudian coba daftar, Better Auth menolak ("email sudah terdaftar") — A terkunci dari identitasnya sendiri. **Scope aman:** kalau email A sudah punya akun (`isExistingUser: true`), skenario ini tidak bisa dieksploitasi (B tetap butuh password A).

**Keputusan implementasi (bukan T-005 penuh):** tambah alur verifikasi terpisah HANYA untuk accept-invite dengan `isExistingUser: false` — tidak menunggu keputusan provider email transactional untuk seluruh app (T-005 tetap open, tidak terhambat oleh task ini, dan task ini tidak menutup T-005).

- [x] **T-110.1** Setup Resend (API key env var + package) — scoped untuk email verifikasi accept-invite, bukan `requireEmailVerification` Better Auth secara global. Package `resend` di `apps/web/package.json`, env var `RESEND_API_KEY`/`RESEND_FROM_EMAIL` di `apps/web/src/lib/env.ts` + `.env.example`, factory `getInviteEmailSender()` di `apps/web/src/lib/adapters/email/index.ts` (pola sama `getOutstandAdapter()`, ADR-119, tanpa fallback Fake di produksi), adapter konkret `createResendInviteEmailSender` di `apps/web/src/lib/adapters/email/resend-invite-email-sender.ts`.
- [x] **T-110.2** Alur baru: saat `isExistingUser: false`, kirim kode/link verifikasi ke email undangan sebelum user diizinkan set password & submit `signUp` — `requestAcceptInviteVerificationAction` di `apps/web/src/app/(auth)/invite/[token]/actions.ts`, dipanggil dari `AcceptInviteForm.tsx` sebelum `authClient.signUp.email()`.
- [x] **T-110.3** Guard server: submit accept-invite untuk akun baru ditolak kalau verifikasi belum dikonfirmasi (bukan cuma guard client) — `WorkspaceService.confirmInviteEmailVerification`/`requestInviteEmailVerification` di `apps/web/src/domains/workspace/services/workspace.service.ts`: kode di-hash sha256, dibandingkan timing-safe, TTL 10 menit, cap 5 attempt, scoped ke invitation (bukan account age, supaya tidak reject akun lama yang accept invite lain). Migration `20260928120000_t110_invite_email_verification` (kolom `verification_code_hash`/`verification_attempts`/`verification_code_expires_at`/`email_verified_at` di `workspace_invitations`) sudah ter-deploy ke DB dev (dikonfirmasi langsung via Supabase MCP 2026-10-12).
- [x] **T-110.4** UI: state "menunggu verifikasi email" di `AcceptInviteForm.tsx` (loading/pending, resend kode, error kadaluarsa) — state baru `pending-verification` (loading/resend/expiry/attempt error), sesuai mockup Claude Design yang sudah dikunci (gate rule 17 AGENTS.md dipenuhi sebelum implementasi, lihat catatan design-prep di atas).
- [x] **T-110.5** Unit test alur verifikasi + verifikasi end-to-end browser (skenario email A vs email B dibuka beda orang) — unit test komprehensif ADA di `apps/web/src/domains/workspace/services/workspace.service.test.ts` (`WorkspaceService.requestInviteEmailVerification (T-110.2, KI-053)` dan `WorkspaceService.confirmInviteEmailVerification (T-110.3, KI-053)`, termasuk race-condition cap attempt). Commit `bad28cb` mencatat full suite 609 passed/6 skipped. **Gap terbuka:** verifikasi end-to-end browser nyata (skenario email A dan email B dibuka oleh dua orang berbeda) tidak ditemukan catatannya di `COMPLETE_TASK.md` — tidak diklaim selesai, perlu dikonfirmasi/dijalankan terpisah kalau King Rezi ingin menutup gap ini.

**Design-prep T-110 (Claude Design, 2026-09-28, belum implementasi kode — status subtask T-110.1–.5 TETAP `⏳ Not Started`):** sesuai gate rule 17 AGENTS.md, dicek dulu ke Claude Design apakah rancangan state "menunggu verifikasi email" sudah ada — **belum ada** (`templates/accept-invite.html` sebelumnya cuma 5 state: `valid-new`/`valid-existing`/`expired`/`invalid`/`success`), jadi implementasi UI sempat di-STOP menunggu rancangan ini. Didelegasikan ke Neymar Product Designer lebih dulu — `DesignSync` gagal termuat di sesi itu (kejadian ke-8, limitasi teknis yang sama tercatat di `.claude/agents/README.md`; Neymar sempat mengidentifikasi 1 fork keputusan produk yang perlu ditanya King Rezi sebelum menggambar: kode OTP vs magic link). King Rezi ditanya via `AskUserQuestion`, dua keputusan: (1) **kode OTP** (bukan magic link — state ini tetap form di halaman yang sama, tidak butuh Route Handler baru untuk callback klik email), (2) izin eksplisit lanjutkan sesi desain langsung di sesi utama.

Hasil: state baru `pending-verification` ditambahkan ke `templates/accept-invite.html` (posisi logis setelah `valid-new` di urutan state-switcher, sebelum `valid-existing`) — reuse 100% pola existing di file yang sama: `.invite-workspace` (identitas workspace), `.invite-locked-email` (tampilkan lagi email tujuan, label diganti "Kode terkirim"), `.invite-form` (form + tombol primary), `.auth-foot` link (pola sama "Lupa password?"/"Undangan berlaku 7 hari" di state lain pada file ini, dipakai untuk "Kirim ulang" — BUKAN tombol `.btn-ghost` terpisah seperti di `auth-forgot-password.html`, supaya konsisten dengan konvensi file ini sendiri). Satu-satunya CSS baru: `.invite-otp-input` — modifier tipografi (center, letter-spacing lebar) di atas `.input` yang sudah ada, bukan komponen baru. State-switcher (tombol prototype di pojok kanan atas) ditambah 1 opsi baru tanpa mengubah default/state existing manapun (ADR-052 scope discipline, dicek via `.claude/skills/claude-design-scope-discipline/SKILL.md`). `readme.md` diupdate: entri `templates/accept-invite.html` ditambahkan ke section Files (sebelumnya gap dokumentasi lama — file ini sudah ada sejak T-093 tapi tidak pernah masuk `readme.md` sama sekali, ditutup sekalian di sesi ini). Dicek ADR-056 (sinkronisasi docs↔Claude Design): tidak ada token warna/spacing baru yang diperkenalkan (murni reuse), dan `product-discovery/04-ux/` tidak pernah menyebut `accept-invite` sama sekali (di-grep, 0 hasil) — jadi tidak ada dokumen lain yang perlu disinkronkan kali ini. Tidak ada perubahan kode di `apps/web`. Menutup blocker gate rule 17 — implementasi T-110.1–.5 siap dimulai.

**Catatan drift dokumentasi (ditemukan & ditutup 2026-10-12):** seluruh implementasi T-110 (T-110.1–.5) ternyata sudah selesai dan ter-commit ke `staging` lewat commit `bad28cb` ("feat(workspace): T-110 email ownership verification at accept-invite (KI-053)", 2026-10-06) — status subtask dan field **Status** di atas sebelumnya masih belum diupdate dari `⏳ Not Started`/`🟡 In Progress` (gap murni dokumentasi, tidak ada kode yang ditulis ulang di sesi ini). Satu gap substansial tetap terbuka: verifikasi end-to-end browser nyata untuk T-110.5 (skenario email A vs email B dibuka beda orang) belum ada buktinya di `COMPLETE_TASK.md` — lihat catatan di T-110.5.

### T-008 · Workspace Settings — General + Danger Zone

| Field         | Value                                                     |
| ------------- | --------------------------------------------------------- |
| **Status**    | 🟡 In Progress — implementasi selesai & lolos QA, menunggu 1 open item desain (lihat catatan di bawah) sebelum ditutup `✅ Done` |
| **Domain**    | workspace                                                 |
| **ADR**       | ADR-049, ADR-050                                          |
| **Depends**   | T-006 ✅, T-007 (transfer butuh daftar anggota)             |
| **Baca dulu** | `05-architecture/application-layer.md` (method sudah lengkap) |

Screen di luar 8 KSP — disepakati **desain minimal**: cukup "Danger Zone" untuk Transfer Ownership + Delete Workspace.

**Status implementasi (2026-08-13):** Seluruh subtask kode (T-008.2–.4) selesai dan lolos review Ridwan Architecture Reviewer (2 temuan, keduanya sudah diperbaiki) + QA Najwa (golden path & edge case inti PASS; 3 item minor tidak diverifikasi live karena limitation environment test, bukan bug — lihat detail di bawah).

- [x] **T-008.1** Sesi desain Claude Design: Workspace Settings → General + Danger Zone — selesai (King Rezi, langsung di Claude Design)
- [x] **T-008.2** `deleteWorkspace` (RBAC Owner) + dialog konfirmasi Tier tertinggi — RBAC Owner-only, cascade delete via `ON DELETE CASCADE`. Ditemukan gap baseline (sejumlah tabel `workspace_id` masih RESTRICT), diperbaiki lewat 2 migration applied ke DB: `20260813085308_t008_workspace_transfer_ownership_delete` (6 tabel) dan `20260813092018_t008_cascade_connected_account_and_engagement_reply` (4 FK tambahan ditemukan Ridwan, termasuk `engagement_replies.inbox_item_id` yang sebelumnya tanpa jalur cascade dari workspaces sama sekali).
- [x] **T-008.3** `transferOwnership` + `acceptOwnershipTransfer` (proses dua langkah, ADR-050) — kolom baru `workspaces.pending_owner_transfer_to`. `transferOwnership` (RBAC Owner, target harus Admin aktif) set pending state + notifikasi `ownership_transfer_requested`; `acceptOwnershipTransfer` (RBAC hanya target) swap role Owner↔Admin dalam satu transaksi + notifikasi `ownership_transfer_resolved`. Ditambah `cancelOwnershipTransfer` (RBAC Owner-only, kebutuhan UI tombol "Batalkan Permintaan", tidak eksplisit di baseline awal tapi konsisten pola). Domain `notification` (scaffold kosong sebelumnya) diisi minimal (`NotificationService.notify`), dipanggil workspace service via port lokal — boundary cross-domain terjaga. Fix review Ridwan #2: logic "siapa eligible jadi target transfer" (Admin + Active) diekstrak dari duplikasi RSC/service jadi satu sumber `WorkspaceService.listTransferEligibleMembers`.
- [x] **T-008.4** UI Danger Zone + rename workspace — `apps/web/src/app/(app)/settings/page.tsx` + `components/WorkspaceGeneralSettings.tsx`. Card General (rename tanpa konfirmasi) + Card Danger Zone (hidden total untuk non-Owner) dengan 2 dialog Tier 1 "ketik nama workspace untuk konfirmasi" (Transfer Ownership, Hapus Workspace), dikomposisi dari Dialog+Field+TextInput Astryx yang sudah ada.

**Open item desain — BELUM dikonfirmasi King Rezi (jangan ditutup sebagai clean-closed sebelum ini selesai):** mockup `templates/settings-general.html` di Claude Design tidak menunjukkan cara memilih Admin target sebelum dialog Transfer Ownership dibuka. Mark UI Engineer menambahkan `Selector` Admin aktif sebagai keputusan implementasi sendiri (bukan sesuai desain final) — perlu konfirmasi/update balik ke Claude Design dari King Rezi sebelum T-008 dianggap 100% selesai. Lihat juga KI-027.

**Catatan QA (Najwa, 2026-08-13):** full suite (typecheck/lint/test: 118 passed + 3 skip pre-existing) hijau. Golden path rename ✅, Danger Zone visible+correct untuk Owner ✅, dialog type-to-confirm (salah→disabled, benar→enabled) ✅, RBAC hidden-by-code untuk non-Owner ✅ (verified via code review, bukan live 2-akun), delete workspace end-to-end nyata berhasil (sekaligus dipakai sebagai test cleanup). 3 item **tidak** diverifikasi live — bukan bug, tapi limitation environment: Selector dengan data Admin sungguhan, RBAC live dengan akun non-Owner, dan alur transfer 2-akun end-to-end, karena fitur invite member (T-007.1) belum selesai sehingga tidak bisa membuat akun Admin kedua di workspace yang sama.

---

## Navigation & App Shell

Turunan `04-ux/navigation-patterns.md` (NP-D01 Persistent Sidebar) dan `04-ux/information-architecture.md`.

### T-009 · App Shell + sidebar navigation

`✅ Done` · **ADR** ADR-041, ADR-046

`AppShell` Astryx + `WorkspaceSideNav` (5 nav item, footer notif/theme/profile dropdown + logout). Kode: `apps/web/src/app/[slug]/`.

### T-010 · Light/Dark mode toggle

`✅ Done` · **ADR** ADR-055 (override "neutral theme selama M8" di ADR-041)

Toggle di sidebar footer + theme provider, persistensi lintas reload via cookie
`theme` (non-httpOnly, `path=/`, `max-age` 1 tahun, `SameSite=Lax`) yang dibaca
RSC di `apps/web/src/app/layout.tsx` sebelum render pertama sehingga tidak ada
flash tema salah. Helper + fallback: `apps/web/src/lib/theme/theme-cookie.ts`.
Sisi desain sudah selaras — toggle ada di `components/navigation.html` Claude
Design, sama seperti yang sudah lebih dulu ada di `templates/`.

Verifikasi: pemeriksaan otomatis (`typecheck`/`lint`/`test`) dan implementasi
server-side (baca cookie di RSC sebelum render) sudah diverifikasi; alur UI
(klik toggle di sidebar footer → cookie tertulis) belum diuji lewat browser
karena butuh login — perlu dicek King Rezi saat login.

### T-011 · Sidebar CTA "+ New Post" (pinned)

`✅ Done` · **ADR** ADR-053

CTA primary full-width di `WorkspaceSideNav`, di slot `topContent` (di bawah Workspace Selector, di atas navigation items), membuka Draft Editor modal dari section manapun — `DraftEditorProvider` + `DraftEditorModal` dinaikkan ke `[slug]/layout.tsx` supaya tidak terikat ke section Publish saja. Redirect aksi terminal (Save as Draft → Drafts, Schedule → Queue, editor ditutup lebih dulu — ADR-054) tertutup 8 unit test (`terminal-destination.test.ts`) dan terverifikasi via browser oleh Najwa QA Engineer: golden path dari section non-publish (Home, Engage) dan edge case "sudah di destinasi" lulus, tanpa regresi navigasi sidebar.

### T-012 · Sidebar section "Channels"

| Field         | Value                                                                  |
| ------------- | ---------------------------------------------------------------------- |
| **Status**    | ✅ Done — seluruh subtask T-012.1–T-012.6 dan T-012.9 selesai; T-012.1/2 diimplementasikan & lolos review Ridwan + QA Najwa (2026-08-12, lihat catatan) |
| **Domain**    | workspace · UI                                                         |
| **ADR**       | ADR-058 (+ addendum drag-handle **shift-on-hover**, mengoverride keputusan awal "no-shift") · ADR-078 (amandemen ADR-018 — pola `ScheduledCountsPort`, T-012.2) |
| **Depends**   | T-009 ✅ · `listConnectedAccounts` ✅ (dari T-028, v0.2)                |
| **Baca dulu** | `04-ux/navigation-patterns.md` · Claude Design → `components/navigation.html` · `06-engineering/dependency-strategy.md` |

Quick-glance daftar akun terhubung di sidebar: avatar bulat + badge logo brand overlay, nama akun, status badge, scheduled count ↔ quick-compose "+" (no-shift/fixed-slot).

**Catatan unblock (2026-08-12):** T-012.1/2 sebelumnya ditandai "deferred, menunggu domain publishing v0.2" — status itu stale. Model `PublishingPost`/`PublishingPostTarget` (schema Prisma, index `[workspaceId, status]`) sudah eksis dan berisi data real sejak **T-028** (Persistensi Schedule via Fake OutstandAdapter) selesai ✅ — jalur real Outstand adapter (T-025/026/027) tidak dibutuhkan untuk query count, hanya untuk publish/webhook/job runner. Kedua subtask ini sekarang bisa dikerjakan.

**Implementasi T-012.1/2 (selesai, 2026-08-12):**

- **T-012.1** (persist reorder channel per user): model Prisma baru `WorkspaceChannelOrder` (per workspace+user+account, full-rewrite position tiap drop), repository method `saveChannelOrder`/`getChannelOrder` di `IWorkspaceRepository`, Server Action `reorderChannelsAction` (`apps/web/src/app/(app)/components/sidebar-channels/actions.ts`), wiring optimistic UI + revert-on-failure di `ChannelsSection.tsx` (helper `mergeChannels` lama dihapus, sudah tidak dipakai).
- **T-012.2** (badge scheduled-count real): method `countScheduledByAccount` (batch `groupBy`, bukan N+1) di public API domain `publishing`, dipanggil dari `WorkspaceService` lewat interface port lokal `ScheduledCountsPort` (bukan import konkret `PublishingService` ke domain layer) — constructor `WorkspaceService` sekarang punya param opsional kedua, wiring konkret `PublishingService` hanya terjadi di composition root (`apps/web/src/app/(app)/layout.tsx`). Preseden pertama di codebase untuk satu domain service memanggil domain service lain secara langsung (AGENTS.md rule #7). Pola ini dikunci di **ADR-078** (amandemen ADR-018).
- Migration Prisma sudah diterapkan ke DB: `20260812032852_add_publishing_post_target_connected_account_index`, `20260812033031_add_workspace_channel_orders`.
- Review arsitektur Ridwan: 1 temuan ringan (`ScheduledCountsPort` bocor dari barrel `domains/workspace/index.ts` via `export *`) sudah diperbaiki (hapus keyword `export` dari interface). QA Najwa: typecheck/lint/test 85/85 PASS, reorder persist terverifikasi lewat DB langsung, badge count exact match query DB, tidak ada regresi UI quick-compose/drag-handle.

- [x] **T-012.1** Skema tabel reorder personal per user (tabel baru + migrasi)
- [x] **T-012.2** Query scheduled-posts count lintas domain (Publishing → Workspace, via public API domain)
- [x] **T-012.3** Konfirmasi `react-icons` (subset **`react-icons/fa6`**) sebagai dependency runtime `apps/web` di `dependency-strategy.md`
- [x] **T-012.4** Render section + avatar bulat + badge logo brand `react-icons/fa6` overlay + status badge
- [x] **T-012.5** Scheduled count ↔ quick-compose "+" dengan fixed-slot (no-shift) — selesai, termasuk data count real (T-012.2)
- [x] **T-012.6** Drag-handle shift-on-hover — seluruh isi baris ikut bergeser — selesai, termasuk persist reorder (T-012.1)

**Temuan review King Rezi di PR #42 (2026-08-05, sebelum merge):**

- [x] **T-012.9 (bug)** Drag-reorder channel tidak konsisten: drop kadang tidak menukar posisi. Root cause terverifikasi via simulasi `DragEvent` langsung di browser (`channels-section.tsx`, `ChannelsSection`/`handleDragStart`/`handleDrop`): `handleDrop` membaca state `draggedId` lewat closure yang dibuat ulang tiap render; kalau browser men-fire native `drop` sebelum React sempat re-render dari `setDraggedId` di `handleDragStart`, closure `handleDrop` masih baca `draggedId` lama (`null`) → guard `if (!draggedId...) return;` membatalkan reorder tanpa error terlihat. Terbukti: simulasi tanpa jeda antar `dragstart`/`dragover`/`drop` → gagal reorder; dengan jeda realistis → berhasil. Race condition murni bug implementasi, bukan dari plan/ADR manapun. **Fix (2026-08-05):** `handleDrop` sekarang membaca `sourceId` dari `e.dataTransfer.getData("text/plain")` alih-alih state `draggedId` yang stale lewat closure; state `draggedId` tetap dipertahankan untuk visual `isDragging`. Review arsitektur Ridwan: 0 pelanggaran. QA statis Najwa: typecheck/lint/test PASS (verifikasi browser di-skip atas keputusan eksplisit King Rezi, tidak ada environment preview).

> 5 temuan lain dari review PR #42 (T-012.7/8/10/11/12) dinilai out-of-scope dari T-012 (code consistency, dokumentasi konvensi, refactor helper, lint tooling) — dipindah ke **Known Issues** di `PROJECT_STATE.md`, bukan bagian task ini.

---

## Social Account Connection

### T-013 · Connect account via Outstand OAuth redirect

| Field         | Value                                                        |
| ------------- | ------------------------------------------------------------ |
| **Status**    | 🟡 In Progress — T-013.1/2/3 selesai (2026-09-11): T-013.1/2 diselesaikan lewat Fake adapter (ADR-105, ADR-059 pattern) tanpa menunggu T-025 (Real OutstandAdapter, kredensial Outstand belum ada), sekaligus menyelesaikan rangkaian T-015 (reconnect flow); T-013.3 (UI Connected Accounts) sudah selesai sebelumnya. Satu-satunya sisa scope: **T-013.4** (operasional BYOK X), murni operasional, belum ada tindakan |
| **Domain**    | workspace · integration                                      |
| **ADR**       | ADR-021, ADR-037 (platform), ADR-040                         |
| **Depends**   | T-006 ✅                                                      |
| **Baca dulu** | `05-architecture/integration-layer.md`                        |

OAuth flow dikelola Outstand; access token tidak disimpan di DB internal. Seed mock `apps/web/prisma/seed-connected-accounts.ts` dihentikan (ADR-119) — script itu sekarang gagal keras dan tidak menulis akun palsu ke database bersama. Akun terhubung lewat OAuth Outstand sungguhan.

- [x] **T-013.1** `OutstandAdapter.connectAccount` — inisiasi redirect flow. Diselesaikan lewat Fake adapter (ADR-105, ADR-059 pattern) tanpa menunggu T-025 (Real OutstandAdapter, kredensial Outstand belum ada) — `WorkspaceService.initiateConnectAccount` memanggil `IOutstandAdapter.connectAccount`, Fake loopback redirect ke callback route kita sendiri.
- [x] **T-013.2** Route Handler callback + persist `WorkspaceConnectedAccount` — `/api/integrations/outstand/callback` (entry point tanpa business logic) memanggil `WorkspaceService.completeAccountConnection`.
- [x] **T-013.3** UI `/settings/connected-accounts` — daftar + tombol Connect per platform
- [ ] **T-013.4** Operasional X: kredensial BYOK dikonfigurasi manual Project Owner di dashboard Outstand — **aplikasi tidak membuat form atau secret store X**

### T-014 · Disconnect account + dialog konfirmasi

| Field         | Value                                            |
| ------------- | ------------------------------------------------ |
| **Status**    | ✅ Done — 3/3 subtask selesai, lolos review Ridwan (0 temuan)     |
| **Domain**    | workspace                                        |
| **ADR**       | ADR-048, ADR-049                                 |
| **Terkait**   | KI-058 (`PROJECT_STATE.md`, 2026-09-11 — UI tidak menyembunyikan aksi Connect/Disconnect/Reconnect untuk role Creator, gap sudah ada sejak task ini) |
| **Depends**   | T-013                                            |
| **Baca dulu** | `04-ux/key-screen-patterns.md` (KSP-08-F07)      |

RBAC Owner/Admin — tidak ada perubahan RBAC, tinggal tambah gate konfirmasi sebelum memanggil service.

- [x] **T-014.1** Dialog konfirmasi di `settings-connected-accounts.html` (App Prototype Claude Design)
- [x] **T-014.2** `disconnectAccount` di kode nyata + RBAC gate. 2 keputusan non-trivial dikonfirmasi King Rezi: (a) disconnect ikut me-reset `reconnectRequired` ke `false` supaya tampilan tidak nyangkut "Perlu Reconnect"; (b) disconnect akun yang sudah `disconnected` ditolak eksplisit dengan `ConflictError` (bukan idempotent) sebagai defense-in-depth — UI real (T-014.3) tetap wajib guard tombol Disconnect hanya untuk akun `active`, sesuai desain (akun disconnected menampilkan tombol Reconnect, bukan Disconnect).
- [x] **T-014.3** UI dialog konfirmasi (KSP-08-F07) — `AlertDialog` shadcn di `ConnectedAccountsList.tsx`, reuse hook `useConfirmAction` (pola sama `QueueScreen.tsx`/`MembersTable.tsx`). Diverifikasi end-to-end browser (Mark UI Engineer) + lolos review arsitektur Ridwan (0 temuan).

### T-015 · Reconnect flow saat token expired

| Field         | Value                                                |
| ------------- | ---------------------------------------------------- |
| **Status**    | ✅ Done — 3/3 subtask selesai, review Ridwan lolos, 1 bug fungsional temuan QA Najwa (toast error dobel di callback route, prefetch/soft-navigation Next.js tanpa `code`/`state`) sudah diperbaiki dan diverifikasi ulang browser (golden path Connect + Reconnect PASS, hanya 1 toast sukses) |
| **Domain**    | workspace · integration                              |
| **ADR**       | ADR-040, ADR-105                                     |
| **Terkait**   | KI-058 (`PROJECT_STATE.md`, 2026-09-11 — UI tidak menyembunyikan aksi Connect/Disconnect/Reconnect untuk role Creator, ditemukan Najwa QA Engineer saat verifikasi task ini) |
| **Depends**   | T-013 · **T-026 (v0.2, ⏳)** webhook `account.token_expired` |
| **Baca dulu** | `05-architecture/integration-layer.md`                |

- [x] **T-015.1** Tandai status akun expired saat webhook `account.token_expired` masuk
- [x] **T-015.2** State visual "perlu reconnect" di Channels (T-012) + Connected Accounts
- [x] **T-015.3** Aksi reconnect (ulangi redirect flow tanpa kehilangan riwayat post) — Fake adapter (ADR-105), `WorkspaceService.initiateConnectAccount`/`completeAccountConnection` dengan `redirectAccountId` terisi → UPDATE `WorkspaceConnectedAccount` existing (`connectedAt` asli dipertahankan, riwayat post tidak hilang), tombol "Reconnect" aktif di `ConnectedAccountsList.tsx`.

**Catatan implementasi (deviasi styling tombol, accepted, bukan bug/KI):** tombol "Reconnect" (`variant=secondary`) dan "Disconnect" (`variant=destructive`) di `ConnectedAccountsList.tsx` berbeda dari mockup Claude Design (`templates/settings-connected-accounts.html`: Reconnect=`btn-primary` filled, Disconnect=`btn` netral). King Rezi eksplisit memutuskan (`AskUserQuestion`) membiarkan kode seperti sekarang — dinilai lebih aman secara UX (Disconnect memang aksi merusak, Reconnect sudah cukup jelas dari badge status di sebelahnya) — bukan mengikuti mockup. Bukan gap yang perlu diperbaiki, tidak dicatat sebagai Known Issue.

### T-109 · Sembunyikan/disable aksi Connect/Disconnect/Reconnect untuk role Creator

| Field         | Value                                                        |
| ------------- | ------------------------------------------------------------ |
| **Status**    | ✅ Done (2026-09-28)                                          |
| **Domain**    | workspace · UI                                               |
| **ADR**       | —                                                             |
| **Depends**   | T-014 ✅, T-015 ✅                                            |
| **Baca dulu** | `apps/web/src/app/(app)/settings/connected-accounts/components/ConnectedAccountsList.tsx` · pola RBAC UI yang sudah ada di Members/General Settings |
| **Ditemukan** | KI-058 (2026-09-11, Najwa QA Engineer, verifikasi T-015) — King Rezi sebelumnya memutuskan tunda perbaikan di sesi T-015, dikonfirmasi ulang 2026-09-28: boleh dikerjakan sekarang. |

**Gap:** RBAC di server sudah benar (`WorkspaceService` menolak mutasi dari role Creator), tapi `ConnectedAccountsList.tsx` tidak menyembunyikan/men-disable tombol Connect/Disconnect/Reconnect untuk role Creator — Creator baru tahu aksinya ditolak setelah klik dan dapat toast error, bukan tombol yang hilang/disabled dari awal seperti pola RBAC UI di halaman lain.

**Implementasi (selesai, 2026-09-28):** `WorkspaceService.canManageConnectedAccounts`
baru (reuse pola `canManageWorkspaceSettings`); `ConnectedAccountsList.tsx`
menyembunyikan **total** (bukan disabled) tombol Connect/Disconnect/
Reconnect untuk role Creator. Najwa QA Engineer verifikasi browser dengan
akun real (Sinta=Creator → tombol hilang; Raka=Owner → tombol tetap ada —
PASS keduanya). Gate T-103.3 sempat gagal di sesi Najwa (`DesignSync`
tidak termuat — kejadian **pertama** untuk sesi Najwa, sebelumnya limitasi
ini hanya tercatat di sesi Neymar Product Designer) — dijalankan ulang di
sesi utama, hasil **PASS** (diff murni membungkus struktur "SYNCED"
`templates/settings-connected-accounts.html` dengan kondisi role, tidak
mengubah markup yang dikunci).

- [x] **T-109.1** Cek role aktif di `ConnectedAccountsList.tsx`, sembunyikan/disable tombol Connect/Disconnect/Reconnect untuk role Creator — pola sama dengan Members/General Settings
- [x] **T-109.2** Verifikasi regresi: RBAC server tetap menolak dengan benar (tidak berubah), role Admin/Owner tetap bisa akses penuh

---

## User Settings

### T-016 · Account & user settings screens

| Field         | Value                                                        |
| ------------- | ------------------------------------------------------------ |
| **Status**    | 🟡 In Progress — T-016.1/2/3/5 selesai (review Ridwan nihil temuan, QA end-to-end Najwa + verifikasi tambahan sesi utama lolos); T-016.4 tetap 🚫 Blocked (T-036, v0.2) |
| **Domain**    | identity                                                     |
| **ADR**       | ADR-046 (routing convention), ADR-071 (perluasan bucket `avatars`) |
| **Depends**   | T-003 ✅, T-009 ✅                                             |
| **Baca dulu** | `04-ux/information-architecture.md`                           |

Semua route `/account/*` dan `/settings/*` sebelumnya masih placeholder "Scaffold — implementasi fitur di M8", dan layout-nya masih shell kosong.

- [x] **T-016.1** Layout `account/` + `settings/` (sidebar/nav internal) — Sesi Claude Design (AI utama) lebih dulu untuk 4 mockup (`templates/account-profile.html`, `templates/account-preferences.html`, kolom Tier 2 di `components/dialog.html`, subnav baru di `templates/settings-connected-accounts.html`). Hasil `astryx build`/`astryx docs layout`: `/account` pakai `AppShell`+`SideNav` (top-level, tanpa workspace context, back-link ke workspace); `/[slug]/settings` pakai `Layout`+`LayoutPanel role="navigation"`+`LayoutContent` (bukan AppShell kedua, karena sudah dibungkus AppShell dari `[slug]/layout.tsx`). File baru: `apps/web/src/app/account/page.tsx` (redirect ke `/account/profile`, menutup celah ADR-046), `apps/web/src/app/account/components/AccountSideNav.tsx`, `apps/web/src/app/[slug]/settings/components/SettingsSideNav.tsx`. Verifikasi: konten existing (Connected Accounts, dll) terbukti identik sebelum/sesudah — cuma dibungkus nav baru.
- [x] **T-016.2** `/account/profile` — edit nama, avatar — Domain `identity` (`apps/web/src/domains/identity/`) diisi pertama kali: `IIdentityRepository`, `IAvatarStorageAdapter` (pola sama `IOutstandAdapter`), `IdentityService` (constructor injection, validasi nama + avatar). Infra: `apps/web/src/lib/repositories/identity/`, `apps/web/src/lib/adapters/avatar-storage/` (Supabase Storage, service-role). Entry point: `apps/web/src/app/account/profile/page.tsx` (Server Component) + `actions.ts` (Server Action) + `components/ProfileForm.tsx`. Scope sengaja hanya nama + avatar — email read-only, belum ada flow ganti email (belum ada infra verifikasi email). Bucket `avatars` diperluas untuk avatar user personal via **ADR-071** (migration idempotent `apps/web/prisma/migrations/20260806120000_extend_avatars_bucket_user_profile/migration.sql`). Verifikasi: golden path (edit nama, upload avatar sungguhan, validasi nama kosong, validasi file bukan gambar, validasi >2MB) semua PASS via browser nyata + `identity_user.image`/`identity_user.name` dicek langsung di DB.
- [x] **T-016.3** `/account/preferences` — Card "Tema Tampilan" dengan toggle Light/Dark, reuse hook `useThemeMode()` existing (tidak ada state/cookie baru) — baseline (`information-architecture.md` § 7) tidak mendefinisikan personal preference lain di luar tema. File: `apps/web/src/app/account/preferences/page.tsx`. Verifikasi: toggle berfungsi, persist lintas section via cookie `theme` existing, tidak ada flash tema salah saat reload langsung di halaman ini.
- [ ] **T-016.4** `/account/notifications` — preferensi notifikasi (butuh **T-036**, v0.2 ⏳) — tetap di luar scope, tidak dikerjakan.
- [x] **T-016.5** Dialog konfirmasi Logout (ADR-049 Tier 2) — Memperbaiki pelanggaran aktif ADR-049/NP-D10 yang ditemukan saat eksplorasi: `handleLogout` di `apps/web/src/app/[slug]/components/WorkspaceSideNav.tsx` sebelumnya dipanggil langsung dari dropdown "Logout" tanpa konfirmasi apapun. Fix: tambah `AlertDialog` (komponen Astryx, konsumen pertama di `apps/web`) — title "Logout dari akun ini?", description mengacu ADR-049/NP-D10, `cancelLabel="Batal"`, `actionLabel="Logout"`. Logic `handleLogout` (signOut + redirect + refresh) tidak berubah, hanya digating di belakang dialog. Verifikasi: Cancel membatalkan tanpa efek, Escape berperilaku sama seperti Cancel, Confirm benar-benar sign-out + redirect `/login`, dites di light & dark mode.

> **Catatan (belum jadi Known Issue formal, lihat `PROJECT_STATE.md` KI-014):** belum ada unit test Vitest baru untuk `IdentityService`/`IIdentityRepository`/`SupabaseAvatarStorageAdapter` (domain `identity` yang baru diisi). Review arsitektur Ridwan sudah cek boundary (bersih), tapi coverage test-nya nihil. Bukan blocker penutupan T-016.1/.2/.3/.5 — semua sudah lolos QA browser end-to-end.

---

## Migrasi Routing & Settings (ADR-076)

### T-039 · Migrasi kode routing workspace ke baseline ADR-076 (route group `(app)`, cookie, Settings gabungan)

| Field         | Value                                                                  |
| ------------- | ----------------------------------------------------------------------- |
| **Status**    | ✅ Done — seluruh subtask T-039.1–.5 selesai (2026-09-08): T-039.4 (onboarding picker workspace) sudah diimplementasikan, lolos review arsitektur Ridwan (tidak ada temuan) dan QA Najwa end-to-end browser (6/6 skenario PASS) — kode sudah di-commit & push, dibuka sebagai PR [#109](https://github.com/reziSaktiva/social-media-management/pull/109) dari branch `feature/t-039-4-onboarding-workspace-picker` (checkout dari `staging`) ke `staging`, **belum di-merge**, menunggu King Rezi |
| **Domain**    | workspace · platform                                                    |
| **ADR**       | ADR-076                                                                  |
| **Terkait**   | KI-023, KI-024 (`PROJECT_STATE.md`) — KI-024 ditemukan saat T-039.5, belum ada task formal |
| **Depends**   | T-009 ✅ (App Shell), T-006 ✅ (Onboarding lama), T-016 🟡 (Account settings) |
| **Baca dulu** | `decisions/ADR-076-workspace-context-via-cookie-hapus-slug-konsolidasi-settings-organization-account.md` · `05-architecture/auth-architecture.md` (Workspace Context Resolution, Middleware Strategy, Onboarding Flow) · `06-engineering/monorepo-setup.md` (App Router Structure, MS-D03) · `04-ux/information-architecture.md` (section Settings) |

ADR-076 hanya mengubah baseline dokumentasi (PR #61) — kode `apps/web` **belum**
dimigrasikan. Struktur route saat ini masih dynamic segment `[slug]` dan
`account/` terpisah dari `settings/`; Middleware/`src/proxy.ts` masih resolve
workspace dari URL, bukan cookie. Task ini menutup gap tersebut (KI-023).

**Catatan tambahan (2026-08-11):** Design System (Claude Design) sudah
disinkronkan ke ADR-076 (Settings konsolidasi Organization+Account, avatar
entry point tunggal, cleanup halaman Account lama) — referensi visual saat
task ini dieksekusi sudah akurat/up-to-date.

- [x] **T-039.1** Hapus dynamic segment `apps/web/src/app/[slug]/...`, pindahkan seluruh route workspace-scoped (Home, Publish, Engage, Analyze, Start Page, Settings) ke route group baru `apps/web/src/app/(app)/...`
- [x] **T-039.2** Gabungkan `apps/web/src/app/account/...` (saat ini terpisah) ke dalam `settings/account/*`, konsisten dengan konsolidasi Settings jadi dua grup "Organization" + "Account" (satu entry point avatar/user menu)
- [x] **T-039.3** Ganti resolusi workspace di Middleware/`src/proxy.ts` dari parsing URL `[slug]` menjadi baca cookie `active-workspace-id` (HTTP-only), tetap divalidasi ulang terhadap `workspace_members` di setiap request
- [x] **T-039.4** Bangun halaman `/onboarding` dengan picker workspace — re-entry point untuk dua skenario: user baru tanpa workspace (buat workspace pertama) dan user existing yang kehilangan cookie workspace aktif (pilih dari daftar workspace)

**Catatan T-039.4 (2026-08-24) — desain selesai, implementasi kode belum dimulai:** Rancangan sudah dibuat di Claude Design (project "Social Media Management") mengikuti gate rule 17 `AGENTS.md` — file baru `templates/onboarding.html` (2 state referensi: "Belum Punya Workspace" — form buat workspace baru; "Pilih Workspace (>1, cookie hilang)" — list `.ws-pick-item` yang bisa diklik, masing-masing langsung set active workspace + redirect ke Home) dan class baru di `styles.css` (`.ws-pick-list`, `.ws-pick-item`, `.ws-pick-avatar`, `.ws-pick-body`, `.ws-pick-name`, `.ws-pick-role`, `.ws-pick-chevron`, mereplikasi pola Astryx `List`+`ListItem`/`Item`). Implementasi kode di `apps/web` **belum dikerjakan sama sekali** — menunggu approval King Rezi atas desain ini sebelum dilanjutkan. Branch `feature/t039-4-onboarding-workspace-picker` sudah dibuat (checkout dari `staging`), belum ada commit. Detail lengkap proses & keputusan: `COMPLETE_TASK.md`.

**Catatan eksekusi T-039.4 (2026-09-08) — implementasi selesai, lolos review + QA:** Setelah desain disetujui, diimplementasikan di `apps/web/src/app/onboarding/page.tsx` — diubah dari "cek 1 default workspace, kalau tidak ada tampilkan form" menjadi memanggil `WorkspaceService.listWorkspacesForUser(userId)` dan branching 3 skenario: 0 workspace → render `CreateWorkspaceForm` (state lama, tidak berubah); 1 workspace → tetap `redirect("/onboarding/resume")` (Route Handler existing dari T-039.3, tidak berubah); >1 workspace → render `WorkspacePicker` (baru) — menutup gap lama di mana `onboarding/resume` auto-pick diam-diam workspace tertua tanpa menanyakan user. File baru: `apps/web/src/app/onboarding/components/WorkspacePicker.tsx` (Client Component, list workspace pakai `Item`/`ItemGroup` shadcn — pola sama `WorkspacesSettingsView.tsx` T-089 — tanpa `AlertDialog` konfirmasi karena belum ada "workspace aktif" untuk ditinggalkan di titik re-entry ini, klik baris langsung memanggil Server Action). `apps/web/src/app/onboarding/components/actions.ts` ditambah `selectWorkspaceAction(workspaceId)` — validasi membership aktif lewat reuse `WorkspaceService.switchWorkspace`, set cookie `active-workspace-id`, redirect Home; error (bukan anggota aktif) → `{error}` lewat `toActionError`, tanpa redirect. Test baru `apps/web/src/app/onboarding/components/actions.test.ts` menutup gap coverage untuk `selectWorkspaceAction` (3 skenario: unauthenticated → redirect login; sukses → set cookie + redirect home; gagal membership → return `{error}` tanpa redirect/cookie).

Review arsitektur Ridwan: **LOLOS, tidak ada temuan** (entry point tanpa business logic, domain tidak import Prisma langsung, reuse `switchWorkspace` untuk skenario "belum ada workspace aktif" dinilai semantically tepat, bukan penyalahgunaan API).

QA Najwa end-to-end browser (localhost): **PASS 6/6 skenario** — (1) 1 workspace + cookie hilang auto-redirect Home tanpa picker; (2) >1 workspace + cookie hilang tampil picker, klik pilih → redirect Home + cookie ter-set benar (dites akun Raka, 4 workspace); (3) 0 workspace → form create workspace lama tidak regresi; (4) error membership invalid → alert error muncul tanpa crash/redirect; (5) visual "Pilih Workspace" cocok Claude Design (title, subtitle, avatar+nama+role+chevron, klik langsung tanpa dialog); (6) regresi Settings → Account → Workspaces tetap normal. Data test QA (`qa-onboarding-t0394@kopiselasar.com` + workspace-nya) sudah dibersihkan sendiri oleh Najwa via Danger Zone.

Verifikasi: `bun run typecheck`/`lint` bersih, `bun run test` (root) 272 pass (naik dari 269, dari `actions.test.ts` baru)/5 skip.

**Sudah di-commit & push, belum di-merge** — kode dibuka sebagai PR [#109](https://github.com/reziSaktiva/social-media-management/pull/109) dari branch `feature/t-039-4-onboarding-workspace-picker` (checkout dari `staging`) ke `staging`, menunggu King Rezi me-review/merge (rule 13 AGENTS.md). Dengan ini seluruh subtask T-039.1–.5 selesai, menutup sisa scope KI-023 (lihat catatan update KI-023 di `PROJECT_STATE.md`).

- [x] **T-039.5** (ADR-077) Migrasi kode pola sidebar Settings dari secondary nav ke sidebar tunggal pola Buffer: (a) `sideNav` di `AppShell` (`apps/web/src/app/(app)/layout.tsx`) jadi kondisional per-route — `WorkspaceSideNav` di luar `/settings`, `SettingsSideNav` di dalam `/settings`; (b) hapus `Layout`+`LayoutPanel role="navigation"` secondary nav di `apps/web/src/app/(app)/settings/layout.tsx`, content jadi full-width; (c) tambah header back-navigation ("← Settings" → Home) di `SettingsSideNav.tsx`; referensi visual sudah ada di readme.md Claude Design (`.settings-sidebar`)

**Catatan eksekusi T-039.1–.3 (2026-08-11):** Dikerjakan 5 track paralel
(proxy.ts+onboarding, app shell+draft editor, publish, engage/analyze/
start-page/home, konsolidasi settings) → review arsitektur Ridwan (2 temuan,
sudah diperbaiki) → QA Najwa (1 bug blocking, sudah diperbaiki) → semua
verifikasi hijau (typecheck bersih, lint bersih, 80 test pass termasuk
`proxy.test.ts` baru).

- Ringkasan implementasi: seluruh route `[slug]/*` dipindah ke `(app)/*`,
  `account/*` digabung ke `(app)/settings/account/*` (dua grup sidebar
  Organization/Account), `proxy.ts` sekarang resolve workspace dari cookie
  `active-workspace-id` + validasi `workspace_members` + inject header
  `x-workspace-id`/`x-workspace-role` (runtime Node.js, bukan Edge — karena
  Prisma pakai adapter `pg`).
- Keputusan dikonfirmasi King Rezi saat eksekusi: label avatar menu
  "Profile" diganti jadi **"Settings"** (mengarah `/settings/account`),
  karena avatar menu sekarang satu-satunya entry point ke seluruh Settings.
- Temuan review Ridwan yang sudah diperbaiki: (a) dead code
  `getWorkspaceBySlug`/`findBySlug` dihapus dari `WorkspaceService`/
  `IWorkspaceRepository`/implementasi Prisma (sudah tidak ada caller
  produksi pasca migrasi); (b) hardening — header `x-workspace-id`/
  `x-workspace-role` di-strip di jalur bypass (`/api/auth`, `/api/jobs`,
  `/api/health`) dan `/onboarding` sebelum Batch 7, supaya tidak ada jalur
  client bisa memalsukan header ini (`stripWorkspaceHeaders` dipanggil di
  semua `NextResponse.next()`).
- **Bug blocking dari QA Najwa (sudah diperbaiki sebelum task ditutup):**
  versi awal `proxy.ts` menyebabkan infinite redirect loop di `/login`,
  `/register`, `/forgot-password`, `/reset-password` untuk SEMUA user tanpa
  session (root cause: hilang early-return untuk kombinasi
  `!hasSessionCookie && isPublicAuthPage` setelah refactor redirect logic)
  — sudah diperbaiki + ditambah test regresi di `proxy.test.ts`.
- Sentuhan teknis di luar 3 subtask literal tapi wajib untuk migrasi tidak
  merusak app: hapus `apps/web/src/app/page.tsx` (root, konflik routing
  dengan `(app)/page.tsx` karena route group tidak menambah segmen URL),
  tambah Route Handler `apps/web/src/app/onboarding/resume/route.ts` (set
  cookie untuk user existing yang kehilangan cookie tapi sudah punya
  workspace — bagian dari T-039.3, BUKAN picker T-039.4 yang menangani user
  dengan >1 workspace).
- Verifikasi visual: Claude Design (sudah disinkron ke ADR-076 sebelumnya)
  dicek cocok dengan hasil implementasi `SettingsSideNav` (grouping
  Organization/Account, urutan & label item) — tidak ada perubahan di
  Claude Design, cuma jadi referensi.

**Update (2026-09-08) — T-039.4 sudah diimplementasikan, lihat catatan
eksekusi T-039.4 di atas.** Sebelumnya `onboarding/resume/route.ts` otomatis
memilih salah satu workspace lewat `getDefaultWorkspaceForUser` untuk kasus
>1 workspace (bukan bug, batasan scope sementara) — sekarang skenario itu
sudah ditangani `WorkspacePicker` yang menanyakan pilihan user secara
eksplisit.

**Catatan eksekusi T-039.5 (2026-08-11, ADR-077):** Dikerjakan Mark UI
Engineer → review arsitektur Ridwan (lolos, tidak ada temuan) → QA Najwa
end-to-end browser (PASS semua golden path: typecheck bersih, lint bersih,
79/79 test pass, sidebar Settings menggantikan total main sidebar dengan
header back-navigation berfungsi, taksonomi Organization/Account tidak
berubah, tidak ada regresi di halaman lain, dark mode konsisten, reload
langsung juga benar).

- Diubah: `apps/web/src/app/(app)/layout.tsx` (`sideNav` `AppShell` jadi
  kondisional per-route lewat komponen baru di bawah), dan
  `apps/web/src/app/(app)/settings/components/SettingsSideNav.tsx`
  (tambah header back-navigation "← Settings" → Home).
- Ditambah: `apps/web/src/app/(app)/components/AppSideNav.tsx` (Client
  Component baru — `usePathname()` memilih render `SettingsSideNav` di
  bawah `/settings`, atau `WorkspaceSideNav` di luar itu).
- Dihapus total: `apps/web/src/app/(app)/settings/layout.tsx` (wrapper
  `LayoutPanel` secondary nav tidak diperlukan lagi — content Settings
  sekarang full-width dengan sidebar tunggal).

T-039.5 menutup sisa gap render sidebar Settings di KI-023 (bersama ADR-077).
**Update (2026-09-08):** T-039.4 (onboarding picker workspace) juga sudah
selesai diimplementasikan (lihat catatan eksekusi T-039.4 di atas) — seluruh
scope KI-023/T-039 sekarang tuntas, tidak ada sisa subtask terbuka.

**Catatan spin-off (2026-08-24):** Setelah T-039.4 didesain, King Rezi
menemukan gap terpisah — tidak ada cara *sengaja* pindah workspace setelah
user pernah memilih satu (picker T-039.4 cuma re-entry saat cookie hilang).
Gap ini diamandemen lewat **ADR-088** dan dipecah jadi task baru
**T-089** (bukan subtask T-039.6) karena scope-nya fitur produk baru
(switcher), bukan bagian migrasi routing/Settings lama. Lihat § T-089 di
bawah untuk detail.

---

## Workspace Switcher (ADR-088)

### T-089 · Workspace Switcher deliberate — Settings → Account → Workspaces

| Field         | Value                                                                  |
| ------------- | ----------------------------------------------------------------------- |
| **Status**    | ✅ Done — seluruh subtask T-089.1–.6 selesai (2026-08-24): T-089.2/.3/.4 (kode `apps/web`) lolos review arsitektur Ridwan (tidak ada temuan) dan QA Najwa (58/58 unit test + full suite 157 passed/3 skipped/0 gagal + golden path browser end-to-end); T-089.6 (dialog konfirmasi Tier 2, ADR-089) juga sudah lolos QA formal Najwa retest (2026-08-24) — unit test + full suite 157 passed/3 skipped/0 gagal + golden path browser end-to-end, tidak ada bug baru — **KI-034 closed (Resolved)** |
| **Domain**    | workspace · UI                                                          |
| **ADR**       | ADR-088 (amandemen ADR-076 poin 4), ADR-089 (amandemen ADR-088 — dialog konfirmasi Tier 2 sebelum switch) |
| **Terkait**   | T-039 (reuse mekanisme cookie `active-workspace-id`), KI-023 (`PROJECT_STATE.md`, catatan update 2026-08-24), KI-033 (`PROJECT_STATE.md`, 2 workspace test tersisa dari QA sesi ini), KI-034 (`PROJECT_STATE.md`, QA Najwa retest golden path switch dengan dialog konfirmasi baru — Resolved 2026-08-24) |
| **Depends**   | T-039 🟡 (cookie `active-workspace-id` + validasi ulang `workspace_members`), T-006 ✅ (`WorkspaceService.createWorkspace` existing, dipakai ulang dialog "Buat Workspace Baru") |
| **Baca dulu** | `decisions/ADR-088-amandemen-adr-076-workspace-switcher-deliberate-via-settings-account-workspaces.md` · `decisions/ADR-076-workspace-context-via-cookie-hapus-slug-konsolidasi-settings-organization-account.md` · `05-architecture/auth-architecture.md` (Workspace Context Resolution, Onboarding Flow, AU-D03) · `05-architecture/application-layer.md` (kontrak `switchWorkspace` baru di `WorkspaceService`) · `04-ux/information-architecture.md` (Settings → Account → Workspaces) |

**Gap yang melahirkan task ini:** ADR-076 poin 4 (versi awal) menjadikan
`/onboarding` picker (T-039.4) sebagai satu-satunya jalur "pilih workspace"
— hanya muncul saat cookie hilang, bukan mekanisme switch kapan saja
setelah user sudah punya workspace aktif. King Rezi menyadari tidak ada
cara sengaja pindah workspace di luar skenario itu. **ADR-088**
mengamandemen poin ini: halaman baru **Settings → Account → Workspaces**
(posisi teratas grup Account, di atas Profile) — list seluruh workspace
milik user (workspace aktif = chip "Aktif" non-interactive, lainnya = row
klik yang membuka dialog konfirmasi Tier 2 sebelum switch — lihat
**ADR-089**, T-089.6 — reuse `.ws-pick-item` dari `templates/onboarding.html`)
+ tombol "Buat Workspace Baru" (dialog form sederhana, non-destruktif,
kolom ke-5 baru di `components/dialog.html`).

**Koreksi mekanisme (penting, jangan disalahpahami sebagai "hapus cookie
dulu"):** switch yang disengaja ini **overwrite** cookie
`active-workspace-id` ke workspace baru (setelah validasi ulang
membership terhadap `workspace_members`), lalu redirect ke Home — **tidak
ada** langkah delete cookie atau alur ulang lewat `/onboarding`. **Update
2026-08-24 (ADR-089):** overwrite ini sekarang digating di belakang
dialog konfirmasi Tier 2 (`AlertDialog`, ADR-049) yang terbuka begitu row
workspace diklik — bukan langsung tereksekusi seperti versi awal ADR-088;
lihat T-089.6.

**Scope MVP sengaja narrow (ADR-088):** hanya (a) switch active workspace
antar membership yang sudah ada, (b) create workspace tambahan dari
halaman ini. **Bukan** bagian scope: multi-workspace management penuh
(bulk actions, billing gabungan, shared views) — tetap Out of Scope sesuai
`mvp-definition.md`.

**Status desain (2026-08-24):** Sudah dieksekusi di Claude Design (AI
utama, langsung via `DesignSync` — bukan subagent Neymar, mengikuti pola
delegasi T-039.4 di sesi yang sama): file baru `templates/settings-workspaces.html`,
6 halaman `settings-*.html` lain ditambah link nav "Workspaces", kolom
ke-5 baru di `components/dialog.html`, modifier `.ws-pick-item.is-active`
di `styles.css`, `readme.md` diupdate. **Belum diwire** ke
`templates/app-prototype/AppPrototype.dc.html` (interactive runner) —
sengaja dibiarkan sebagai follow-up terbuka (T-089.5), bukan oversight.
Detail lengkap: `COMPLETE_TASK.md`.

**Update (2026-08-24) — 2 bug fix pasca-review, dikerjakan King Rezi sendiri
langsung di Claude Design (bukan AI/subagent):** (1) dialog "Buat Workspace
Baru" langsung terbuka & tidak bisa ditutup — root cause CSS
`.dialog-backdrop.hidden{ display:none; }` lupa disalin ke `<style>` lokal
`templates/settings-workspaces.html` saat T-089.1; King Rezi menambahkan
baris CSS itu, plus peningkatan kecil di luar scope bug report: script
halaman sekarang benar-benar memindahkan chip "Aktif" ke row yang diklik.
(2) nav "Workspaces" di App Prototype error "belum ada di scope" — halaman
belum diwire (T-089.5); King Rezi menambahkan entry `{ key:
'settings-workspaces', file: 'settings-workspaces.html', code: 'SETTINGS',
title: 'Settings → Account → Workspaces', menu: 'Settings · Account ·
Workspaces' }` ke array `SCREENS` di `AppPrototype.dc.html` + scope
Templates list. Keduanya terverifikasi via `DesignSync get_file`/grep.

- [x] **T-089.1** Desain Claude Design — halaman `settings-workspaces.html` (list workspace + switch) dan kolom dialog "Buat Workspace Baru" di `components/dialog.html`. **Catatan (2026-08-24):** fix CSS `.dialog-backdrop.hidden` yang kelupaan saat desain awal (bug dialog langsung terbuka/tidak bisa ditutup) sudah diperbaiki King Rezi sendiri — lihat detail di atas.
- [x] **T-089.2** `WorkspaceService.switchWorkspace` — validasi membership user ke workspace target, overwrite cookie `active-workspace-id`, redirect Home
- [x] **T-089.3** UI halaman `/settings/account/workspaces` — list workspace (chip "Aktif" untuk current, row klik pada workspace lain membuka dialog konfirmasi Tier 2 — lihat T-089.6 — baru melanjutkan switch setelah dikonfirmasi)
- [x] **T-089.4** Dialog "Buat Workspace Baru" di halaman ini — reuse `WorkspaceService.createWorkspace` (T-006) yang sudah ada
- [x] **T-089.5** Wire halaman baru ke `templates/app-prototype/AppPrototype.dc.html` (interactive runner Claude Design) — selesai (2026-08-24), dikerjakan King Rezi sendiri, entry `SCREENS` terverifikasi ada
- [x] **T-089.6** Dialog konfirmasi Tier 2 sebelum switch workspace (ADR-089, amandemen ADR-088) — King Rezi mengubah rancangan di Claude Design (`components/dialog.html`, dicatat sebagai reuse pola AlertDialog Tier 2 di `templates/settings-workspaces.html`); kode `WorkspacesSettingsView.tsx` diselaraskan: klik row workspace membuka `AlertDialog` Astryx (pola sama Logout/Remove Member, lihat `apps/web/src/app/(app)/components/WorkspaceSideNav.tsx:142-159`) — title dinamis "Pindah ke workspace [nama]?", description "Anda akan keluar dari workspace saat ini dan berpindah konteks kerja.", `actionVariant="primary"` (non-destruktif, bukan destructive) — switch baru dijalankan setelah user klik "Pindah". Diverifikasi end-to-end browser oleh AI utama (Batal & Pindah keduanya bekerja benar, redirect Home sukses), lalu diretest formal oleh Najwa QA Engineer (2026-08-24) — `bun run typecheck`/`lint`/`test` PASS (157 passed, 3 skipped, 0 gagal), golden path browser 6 langkah PASS, 2 edge case tambahan (Escape saat switch in-flight, refresh saat dialog terbuka) tidak reproducible sebagai bug, tidak ada bug baru ditemukan. **KI-034 closed (Resolved)** — detail lengkap di `COMPLETE_TASK.md`.

**Catatan eksekusi T-089.2/.3/.4 (2026-08-24):** Dikerjakan 2 track paralel
— Prabowo Feature Engineer (T-089.2: `WorkspaceService.switchWorkspace`
dengan validasi membership aktif via `AuthorizationError` kalau bukan
member aktif, tanpa cookie/redirect di dalam service; `listWorkspacesForUser`
di service & repository, `IWorkspaceRepository.listWorkspacesForUser`
implementasi Prisma pakai `withCurrentUser`) dan Mark UI Engineer (T-089.3:
route `apps/web/src/app/(app)/settings/account/workspaces/` — `page.tsx`,
`actions.ts` dengan `switchWorkspaceAction`, komponen
`WorkspacesSettingsView.tsx` pakai Astryx List/ListItem/Badge/StatusDot/
Dialog; nav sidebar `SettingsSideNav.tsx` ditambah item "Workspaces" di
posisi pertama grup Account; T-089.4: dialog "Buat Workspace Baru" dengan
`createWorkspaceAction` reuse penuh `WorkspaceService.createWorkspace`
T-006 tanpa modifikasi method itu sendiri) → review arsitektur **Ridwan**
(8 file, tidak ada temuan pelanggaran — entry point bersih dari business
logic, domain tidak import Prisma langsung, RLS/`withCurrentUser`
konsisten, error handling via `toActionError`, reuse T-006 terkonfirmasi)
→ QA **Najwa** (unit test 58/58 lulus `workspace.service.test.ts`, full
suite project 157 passed/3 skipped/0 gagal, golden path browser
end-to-end lulus semua — list, switch, create dialog, nav ordering — edge
case refresh & konsistensi state lulus, tidak ada regresi di `/settings`
dan `/settings/account`, **tidak ada bug**).

**Catatan sisa (bukan bug, lihat KI-033 di `PROJECT_STATE.md`):** selama QA
Najwa membuat workspace test **"Najwa QA Test Workspace"** (sengaja, untuk
uji `createWorkspaceAction`) yang sengaja tidak dihapus setelahnya karena
hapus workspace bersifat ireversibel dan di luar wewenang eksekusi otonom
Najwa; ditemukan juga **"QA Queue Test"**, sisa sesi QA sebelumnya (bukan
dari sesi ini). Keduanya perlu dibersihkan manual oleh King Rezi via
Settings → General → Danger Zone kalau perlu.

**Update T-089.6 (2026-08-24, ADR-089) — dialog konfirmasi Tier 2 sebelum
switch:** King Rezi mengubah rancangan `settings-workspaces.html` di
Claude Design setelah T-089.1–.5 ditutup `✅ Done` — klik row workspace
sekarang membuka dialog konfirmasi (`components/dialog.html`, kolom
Tier 2/AlertDialog yang sama dipakai ulang untuk Switch Workspace) alih-
alih langsung overwrite cookie. Kode `WorkspacesSettingsView.tsx`
diselaraskan mengikuti pola `AlertDialog` yang sudah ada (Logout/Remove
Member) — lihat detail di checklist T-089.6 di atas. Diikuti perubahan
visual kecil di luar scope keputusan material: `Density` List halaman ini
diubah `balanced` → `spacious` (murni spacing antar item, tidak berdampak
behavior, tidak butuh ADR). Diverifikasi end-to-end browser oleh AI utama
(bukan proses QA Najwa formal) — sempat tercatat sebagai gap retest QA di
**KI-034**.

**Update 2026-08-24 — QA formal Najwa: lolos, KI-034 closed.** Retest
formal (unit test + full suite 157 passed/3 skipped/0 gagal + golden path
browser end-to-end + 2 edge case tambahan) selesai tanpa bug baru — lihat
`COMPLETE_TASK.md` untuk detail lengkap.

---

## Security & Platform Hygiene

### T-017 · RLS SQL policies

| Field         | Value                                              |
| ------------- | -------------------------------------------------- |
| **Status**    | 🟡 In Progress — adopsi `withCurrentUser` ke seluruh repository (sebelumnya sengaja ditunda) sedang dikerjakan (2026-08-13) |
| **Domain**    | platform                                           |
| **ADR**       | ADR-015, ADR-033                                   |
| **Depends**   | T-002 ✅                                            |
| **Baca dulu** | `06-engineering/database-orm.md` (DO-D06) · `05-architecture/database-strategy.md` |

RLS policy sudah digenerate dan **applied ke database nyata** — bukan draft. Helper `withCurrentUser(userId, callback)` (`apps/web/src/lib/prisma/with-current-user.ts`) membungkus `prisma.$transaction` + `set_config('app.current_user_id', $1, true)` (tagged-template, aman dari SQL injection). Migration `20260813045625_t017_add_rls_policies` (`apps/web/prisma/migrations/`) berisi `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY` untuk 16 tabel: 12 dengan `workspace_id` langsung, 4 varian EXISTS-join ke parent (`publishing_post_targets`, `ai_results`, `engagement_replies`, `start_page_links`), plus `analytics_post_metrics` (subquery via `publishing_posts.post_id`, terverifikasi memang tidak punya `workspace_id` langsung). Adopsi contoh: `WorkspaceRepository.getMember` sudah jalan lewat `withCurrentUser` (adopsi penuh ke semua repository sengaja ditunda — bukan bagian scope T-017 ini).

**Koreksi baseline (2026-08-13):** contoh SQL asli di `database-strategy.md`/`database-orm.md` memakai cast `current_setting(...)::uuid` untuk `app.current_user_id`, tapi `identity_user.id` (Better Auth) adalah `cuid()` text, bukan UUID — cast itu akan gagal runtime. Sudah dikoreksi (perbandingan `user_id` sebagai text; `workspace_id` tetap `::uuid`) langsung di kedua dokumen tersebut dengan catatan bertanggal (bukan ADR baru — koreksi tipe pada contoh, bukan perubahan keputusan RLS).

**Gap ditemukan saat verifikasi, RESOLVED 2026-08-13 (bekas KI-026):** role Postgres (`postgres`) yang dipakai `DATABASE_URL`/`DIRECT_URL` punya `BYPASSRLS = true` (default Supabase) — RLS sempat **tidak efektif secara runtime** meski policy-nya benar secara desain. Authorization 100% bergantung Application Service (RBAC) selama gap ini terbuka, sesuai desain DB-D05 — bukan regresi.

Resolusi (King Rezi + AI, sesi 2026-08-13): King Rezi membuat role Postgres baru `app_runtime` (tanpa `BYPASSRLS`) via Supabase SQL Editor, grant CRUD ke semua tabel `public` + default privileges tabel baru, lalu `DATABASE_URL` dipindah ke role itu (`DIRECT_URL` sengaja **tetap** `postgres` — butuh privilege DDL untuk `prisma migrate deploy`, keputusan sadar bukan oversight). Begitu RLS benar-benar aktif, ditemukan 2 bug desain policy yang sebelumnya tersembunyi karena BYPASSRLS:

1. **Infinite recursion** pada `workspace_members_workspace_isolation` — policy tabel `workspace_members` melakukan subquery ke tabel itu sendiri, memicu error Postgres "infinite recursion detected in policy". Fix: migration `20260813073556_t017_fix_workspace_members_rls_recursion` — pecah subquery jadi function `SECURITY DEFINER` `current_user_workspace_ids()` (dimiliki role `postgres`/BYPASSRLS sehingga tidak memicu ulang RLS saat dipanggil dari dalam function).
2. **INSERT bootstrap gap** — policy asli pakai `FOR ALL` (WITH CHECK = USING), sehingga insert membership pertama (owner baru bikin workspace) gagal karena user itu belum terdaftar jadi member aktif manapun (chicken-and-egg), diperparah Prisma yang selalu `INSERT ... RETURNING` (SELECT-policy ikut dicek ke baris yang baru diinsert). Fix 2 migration:
   - `20260813073842_t017_split_workspace_members_insert_policy` — pisah `FOR ALL` jadi `FOR SELECT/UPDATE/DELETE` (tetap strict, pakai function di atas) + `FOR INSERT WITH CHECK (true)` terpisah (aman karena authorization utama tetap di Application Service/RBAC per DB-D05 — insert ke `workspace_members` cuma dipanggil dari `WorkspaceRepository.createWithOwner`, sudah divalidasi di service layer).
   - `20260813074306_t017_allow_self_visibility_workspace_members` — tambah klausa `OR user_id = current_setting('app.current_user_id', true)` langsung (tanpa subquery) di SELECT policy, supaya baris yang baru diinsert bisa langsung "melihat dirinya sendiri" tanpa query ulang tabel.

Fix kode aplikasi: `apps/web/src/lib/repositories/workspace/workspace.repository.ts` method `createWithOwner` sekarang set `app.current_user_id = ownerId` (via `tx.$executeRaw` `set_config`) di awal transaksi, sebelum insert workspace + membership pertama, supaya SELECT-policy self-visibility di atas match.

Ketiga migration di atas sudah **applied ke database Supabase nyata** (`bunx prisma migrate deploy`), bukan cuma file lokal.

- [x] **T-017.1** Implementasi jalur server set `app.current_user_id` per request — `withCurrentUser` helper
- [x] **T-017.2** Generate RLS policy per tabel domain — migration applied ke DB nyata (termasuk 3 migration perbaikan gap runtime di atas)
- [x] **T-017.3** Test negatif — `with-current-user.test.ts`, integration test nyata ke Supabase (auto-skip tanpa `DATABASE_URL`); 2 assertion yang sebelumnya berlabel "KNOWN GAP" (mendokumentasikan bug BYPASSRLS) sudah **dibalik jadi assertion positif** (2026-08-13) — cross-workspace row tidak terlihat, default-deny tanpa `SET LOCAL` benar-benar terjadi. Full suite: 14 file test, 105 passed + 1 skipped (skip disengaja untuk environment tanpa DB); `tsc --noEmit` bersih, tidak ada regresi di test lain yang menyentuh `workspace_members`/`workspaces`.

### T-018 · Investigasi hydration gagal lewat tunnel ngrok

| Field         | Value                                                        |
| ------------- | ------------------------------------------------------------ |
| **Status**    | ⏸️ Deferred — superseded oleh ADR-070 (2026-08-13)             |
| **Domain**    | platform · DX                                                |
| **ADR**       | ADR-070                                                       |
| **Depends**   | —                                                            |
| **Baca dulu** | `06-engineering/dx-tooling.md`                                |

Saat halaman auth diakses lewat tunnel ngrok (dipakai untuk `BETTER_AUTH_URL`), **seluruh** halaman tidak ter-hydrate — tidak ada React fiber di elemen manapun meski `window.next` termuat tanpa error console; klik submit jatuh ke native HTML form-submit. Dugaan awal: isu HMR/WebSocket Turbopack lewat ngrok. Backend/API sendiri terverifikasi benar via raw `fetch()`.

**Ditunda — bukan diselesaikan sesuai definisi awal.** ADR-070 menemukan bahwa requirement ngrok itu sendiri berasal dari constraint **Better Auth Cloud** (Base URL wajib publik), bukan keterbatasan Better Auth self-hosted maupun bug Turbopack. Setelah kembali ke self-hosted, `http://localhost:3000` dipakai langsung untuk dev/testing — ngrok tidak lagi diperlukan, sehingga skenario reproduksi T-018.1/.2 tidak lagi berlaku. Bug hydration spesifik lewat tunnel ngrok itu sendiri sengaja tidak ditelusuri lebih lanjut (lihat ADR-070 § Catatan implementasi). `QA_TEST_ACCOUNTS.md` sudah diperbarui dengan alur `localhost` langsung.

- [x] ~~**T-018.1** Konfirmasi apakah reproduksi juga terjadi pada production build~~ — tidak relevan lagi, ngrok tidak dipakai
- [x] ~~**T-018.2** Tentukan solusi: konfigurasi ngrok/allowedDevOrigins, atau ganti mekanisme tunnel~~ — solusi aktual: berhenti pakai Better Auth Cloud (ADR-070), bukan konfigurasi tunnel
- [ ] **T-018.3** Dokumentasikan cara uji browser lewat tunnel di `dx-tooling.md` — tidak dilanjutkan, sudah tidak ada tunnel untuk didokumentasikan

> Awalnya memblokir uji interaksi form penuh di browser lewat ngrok. Sudah tidak relevan sejak ADR-070 — testing browser kini langsung lewat `localhost:3000`.

### T-019 · Skema API mobile `/api/v1` + Better Auth Bearer plugin

| Field         | Value                                                        |
| ------------- | ------------------------------------------------------------ |
| **Status**    | ✅ Done (2026-08-13)                                          |
| **Domain**    | platform · identity                                          |
| **ADR**       | ADR-043                                                      |
| **Depends**   | T-003 ✅                                                      |
| **Baca dulu** | `05-architecture/application-layer.md` · `06-engineering/auth-strategy.md` |

**Dikerjakan lebih awal secara sengaja — mendahului M8 web berjalan jauh.** Yang disiapkan sekarang hanya **skema route + konfigurasi auth**, bukan endpoint mobile aktualnya (endpoint aktual dikerjakan setelah MVP web selesai, dan bukan bagian MVP — lihat `mvp-definition.md` → Out of Scope "Public API"/"Mobile Application").

Alasan urgensinya: kalau jalur Bearer token baru dipasang setelah kode web matang, konfigurasi auth harus di-retrofit ke atas sesuatu yang sudah jalan — persis yang ADR-043 ingin dihindari.

- [x] **T-019.1** Struktur folder `apps/web/src/app/api/v1/health/route.ts` — endpoint skema (bukan bisnis): validasi session (cookie web **atau** Bearer mobile) via `auth.api.getSession`, membuktikan wiring bekerja tanpa mengekspos domain apa pun
- [x] **T-019.2** Bearer plugin aktif tanpa syarat di `apps/web/src/lib/better-auth/auth.ts` (`bearer()`, selalu di-include di array `plugins` bareng `dash` kondisional); `trustedOrigins` dibaca dari `BETTER_AUTH_TRUSTED_ORIGINS` (comma-separated, opsional — kosong untuk sekarang karena scheme mobile/Expo belum ada, didaftarkan nanti begitu mobile app benar-benar mulai, sesuai ADR-043 §7)
- [x] **T-019.3** `rateLimit.customRules` untuk `/sign-in/email` (window 60s, max 5) dan `/sign-up/email` (window 60s, max 3) — diperketat dari default umum Better Auth (3 req/10s) karena `/api/v1` memperluas attack surface (ADR-043 §7)
- [x] **T-019.4** `apps/web/src/proxy.ts` — `/api/v1` ditambahkan ke `BYPASS_PREFIXES` supaya request Bearer (tanpa session cookie) tidak lagi kena redirect `/login`; auth divalidasi di dalam handler masing-masing endpoint, bukan di proxy

**Verifikasi:** `typecheck`/`lint`/`test` (103 test) lolos. Uji manual `curl` end-to-end (Bearer token asli → `/api/v1/health`) belum dilakukan — butuh akun test + token nyata, bisa dicek King Rezi kapan saja.

**Catatan syarat yang masih terbuka (ADR-043 §7, bukan blocker fondasi ini):** sebelum endpoint mobile pertama benar-benar dirilis (bukan sekarang) masih perlu: (a) keputusan eksplisit durasi session mobile (tetap 7 hari atau lebih pendek + refresh), (b) `trustedOrigins` diisi scheme mobile nyata (mis. Expo) begitu platform mobile dipilih, (c) requirement secure storage token di sisi mobile client (di luar kendali repo ini). Dicatat di sini supaya tidak terlewat saat endpoint mobile pertama mulai dikerjakan Post-MVP.

---

## Catatan Rilis

* Nomor kosong v0.1 sudah terpakai semua (T-019 diisi task API mobile). Task v0.1 baru berikutnya memakai nomor global berikutnya yang belum pernah dipakai — jangan menggeser ID yang sudah ada. **T-039** (Migrasi Routing & Settings, ADR-076) memakai nomor ini: ID global berikutnya yang belum pernah dipakai, dipinjam dari ruang kosong yang sebelumnya dicadangkan untuk pertumbuhan v0.2 (lihat Catatan Rilis `tasks/v02-publishing-mvp.md`) — task tetap ditempatkan di file v0.1 karena scope-nya (Workspace/Settings routing) sejalan dengan T-009/T-016, bukan v0.2 Publishing. **T-089** (Workspace Switcher, ADR-088, 2026-08-24) juga memakai pola yang sama: ID global berikutnya yang belum pernah dipakai sama sekali (bukan dipinjam dari cadangan release manapun, karena seluruh rentang T-080–T-088 v1.0 sudah terisi) — ditempatkan di file v0.1 karena lahir sebagai amandemen ADR-076/T-039 (Workspace context & Settings), bukan task baru terpisah dari rumpun ini. **T-093** (Accept Invite page, 2026-08-28) memakai pola yang sama lagi — ID global berikutnya setelah T-092 (v0.2, ADR-094) — menutup gap yang sudah dicatat sejak ADR-080 (2026-08-14, halaman `/invite/[token]` belum pernah dibuat) tapi baru diberi nomor sekarang, saat King Rezi mengoreksi rantai dependency Realtime Calendar (invite-to-membership harus utuh dulu sebelum T-036/T-092 bisa diverifikasi dengan ≥2 akun nyata). **T-109**/**T-110** (ditambah 2026-09-28, promosi dari Known Issues KI-058/KI-053 setelah audit aplikasi menyeluruh dan keputusan mitigasi King Rezi) memakai ID global berikutnya setelah T-108 (v0.2, `tasks/v02-publishing-mvp.md`) — ditempatkan di file ini karena domain `workspace`/`identity`, masing-masing kelanjutan langsung T-015 dan T-093.
* **Definisi "Foundation selesai":** semua task di rilis ini `✅ Done` **kecuali** yang secara sadar ditunda dengan alasan tercatat — dan **kecuali tiga task yang menunggu v0.2** (lihat di bawah). **T-012** (Sidebar Channels) sebelumnya termasuk daftar ini tapi sudah ✅ Done (2026-08-12) — T-012.2 (scheduled count) ternyata tidak perlu menunggu real Outstand adapter, cukup data `PublishingPost`/`PublishingPostTarget` yang sudah ada sejak T-028.
* **Task v0.1 yang tidak bisa ditutup sebelum v0.2 berjalan** (dependency lintas rilis, disengaja dan diketahui):
  * **T-013** Connect account — sisa T-013.4 (operasional BYOK X) murni operasional, bukan dependency v0.2. T-013.1/2/3 sudah selesai (2026-09-11), diselesaikan lewat Fake adapter (ADR-105, ADR-059 pattern) tanpa menunggu T-025 (Real OutstandAdapter, v0.2, kredensial belum ada).
  * **T-016** Account settings — subtask T-016.4 butuh T-036 (notification, v0.2).

  **Update (2026-09-11):** **T-015** (Reconnect flow) sudah ✅ Done — daftar di atas sebelumnya menganggapnya butuh T-026 (webhook, v0.2), ternyata bisa diselesaikan lewat Fake adapter (ADR-105) tanpa menunggu jalur real, sama seperti T-013.1/2. Konsekuensinya: v0.1 dan v0.2 **tidak sepenuhnya sekuensial** — sisa v0.1 di atas selesai berbarengan atau setelah v0.2. Kalau di kemudian hari pemisahan ini terasa menyesatkan, pilihan yang lebih bersih adalah memindahkan Connect Account + Channels/CTA ke v0.2 lewat ADR baru (indeks release di `TASKS.md` adalah turunan `release-roadmap.md`, jadi perubahan ruang lingkup rilis wajib lewat ADR).
