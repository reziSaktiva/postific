import type {
  ConnectedAccountId,
  InvitationId,
  InvitationStatus,
  MemberId,
  MemberRole,
  MemberStatus,
  SocialPlatform,
  UserId,
  WorkspaceId,
} from "@postific/shared";

export interface WorkspaceRecord {
  id: WorkspaceId;
  name: string;
  slug: string;
  /**
   * Transfer Ownership dua langkah (ADR-050, DM-D11). `null` saat tidak ada
   * transfer pending. `undefined` di record yang belum pernah mem-fetch
   * kolom ini (mis. `findDefaultWorkspaceForUser`, yang tidak butuh field
   * ini) — dibedakan dari `null` supaya caller tidak salah asumsi "tidak
   * ada transfer pending" padahal sebenarnya belum pernah dicek.
   */
  pendingOwnerTransferTo?: UserId | null;
}

export interface ConnectedAccountRecord {
  id: ConnectedAccountId;
  workspaceId: WorkspaceId;
  platform: SocialPlatform;
  outstandAccountId: string;
  handle: string;
  status: string;
  reconnectRequired: boolean;
  connectedAt: Date;
  /**
   * Foto profil akun (menutup KI-076, ADR-120) — kolom `avatar_url`
   * (`WorkspaceConnectedAccount`, migrasi
   * `20260926090000_ki076_add_avatar_url_to_workspace_connected_accounts`).
   * `null` berarti Outstand tidak punya/tidak mengembalikan foto untuk akun
   * ini. **Opsional di level TypeScript** (bukan `avatarUrl: string | null`)
   * supaya penambahan field ini tidak memaksa update mekanis di seluruh
   * fixture test lintas domain (publishing/engagement/analytics) yang
   * membangun `ConnectedAccountRecord` tapi tidak peduli avatar sama
   * sekali — implementasi Prisma nyata (`workspace.repository.ts` di
   * `lib/repositories/workspace/`) TETAP SELALU mengisinya (kolom DB selalu
   * ada, `null` atau string), opsional di sini murni kompatibilitas mock.
   */
  avatarUrl?: string | null;
  /**
   * Import Posts dari Social Account (T-090, ADR-093 poin 6) — watermark
   * (`since` untuk trigger periodik/manual berikutnya) dan cooldown
   * (`now() - lastImportRequestedAt < 24 jam` untuk manual). `null` berarti
   * belum pernah ada import yang sukses/direquest sama sekali.
   */
  lastImportedUntil: Date | null;
  lastImportRequestedAt: Date | null;
}

export interface WorkspaceMemberRecord {
  id: MemberId;
  workspaceId: WorkspaceId;
  userId: UserId;
  role: MemberRole;
  status: MemberStatus;
}

/**
 * Satu baris hasil `listWorkspacesForUser` (T-089.2, ADR-088) — workspace +
 * role membership user di dalamnya. `slug` disertakan karena berguna untuk
 * render avatar/link di UI list Workspace Switcher, konsisten dengan
 * `WorkspaceRecord`.
 */
export interface WorkspaceMembershipSummary {
  workspaceId: WorkspaceId;
  name: string;
  slug: string;
  role: MemberRole;
}

export interface WorkspaceInvitationRecord {
  id: InvitationId;
  workspaceId: WorkspaceId;
  email: string;
  role: MemberRole;
  token: string;
  status: InvitationStatus;
  invitedByUserId: UserId;
  expiresAt: Date;
  /**
   * Verifikasi kepemilikan email accept-invite (T-110, KI-053) — HANYA
   * relevan untuk jalur `isExistingUser: false`. `verificationCodeHash`/
   * `verificationCodeExpiresAt` selalu sepasang (`null` kalau tidak ada
   * kode aktif — belum pernah diminta, ATAU sudah dikonfirmasi/single-use).
   * `verificationAttempts` reset ke 0 tiap kode baru (`setInvitationVerificationCode`),
   * increment tiap kode salah (`incrementInvitationVerificationAttempts`).
   * `emailVerifiedAt` diisi SEKALI saat kode dikonfirmasi benar — dipakai
   * `WorkspaceService.acceptInvite` sebagai guard server-side yang tidak
   * percaya klaim dari client.
   */
  verificationCodeHash: string | null;
  verificationCodeExpiresAt: Date | null;
  verificationAttempts: number;
  emailVerifiedAt: Date | null;
}

/** Repository interface — implementation (Prisma) lives in src/lib/repositories/workspace. */
export interface IWorkspaceRepository {
  createWithOwner(input: {
    name: string;
    slug: string;
    ownerId: UserId;
  }): Promise<WorkspaceRecord>;

  /** Membership aktif terlama milik user, dengan WorkspaceRecord lengkap. */
  findDefaultWorkspaceForUser(userId: UserId): Promise<WorkspaceRecord | null>;

  /**
   * Seluruh workspace dengan membership AKTIF milik satu user, beserta
   * role-nya (T-089.2, ADR-088 — Workspace Switcher). Beda dengan
   * `findDefaultWorkspaceForUser` (cuma 1 hasil, membership terlama) —
   * method ini dipakai untuk render list "Settings → Account → Workspaces"
   * (semua workspace yang bisa di-switch user, bukan cuma default-nya).
   * Urutan tidak dispesifikasikan oleh domain (bebas bagi implementasi),
   * `WorkspaceService.listWorkspacesForUser` sekadar meneruskan.
   */
  listWorkspacesForUser(userId: UserId): Promise<WorkspaceMembershipSummary[]>;

  /**
   * Dipakai `getWorkspaceContext()` (ADR-076) — resolve workspace by cookie
   * id. Menyertakan `pendingOwnerTransferTo` (T-008.3, ADR-050) supaya
   * caller (mis. `WorkspaceService.acceptOwnershipTransfer`) tidak perlu
   * query terpisah.
   */
  findById(workspaceId: WorkspaceId): Promise<WorkspaceRecord | null>;

  /**
   * Ordered by `connectedAt` ascending. `userId` (RLS, KI-026 follow-up) —
   * acting user whose session sets `app.current_user_id` for this query;
   * NOT a filter on the result set (semua akun aktif workspace tetap
   * dikembalikan, bukan cuma milik user itu).
   */
  listConnectedAccounts(
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<ConnectedAccountRecord[]>;

  /**
   * Count-only variant of `listConnectedAccounts` filtered to
   * `status: "active"` (T-042.2). `userId` (RLS, KI-026 follow-up) — acting
   * user, sama seperti `listConnectedAccounts`.
   */
  countActiveConnectedAccounts(
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<number>;

  /**
   * Ordered by `joinedAt` ascending — dipakai UI daftar anggota (T-007.4).
   * `actingUserId` (RLS, KI-026 follow-up) — user yang memicu query ini
   * (bukan filter hasil).
   */
  listMembers(
    workspaceId: WorkspaceId,
    actingUserId: UserId,
  ): Promise<WorkspaceMemberRecord[]>;

  /**
   * Batch lookup nama/email user by id. `WorkspaceMember.userId` tidak
   * punya relasi FK Prisma ke `User` (kemungkinan disengaja, beda bounded
   * context), jadi join dilakukan manual di service layer lewat method ini
   * — bukan Prisma `include`. Dipakai `WorkspaceService.listMembersWithUser`.
   */
  findUsersByIds(
    userIds: UserId[],
  ): Promise<{ id: UserId; name: string; email: string }[]>;

  /** Lookup membership by user — dipakai RBAC untuk resolve role actor. */
  getMember(
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<WorkspaceMemberRecord | null>;

  /**
   * Lookup membership by row id — dipakai untuk resolve target member.
   * `actingUserId` (RLS, KI-026 follow-up) — user yang memicu query ini.
   */
  findMemberById(
    workspaceId: WorkspaceId,
    memberId: MemberId,
    actingUserId: UserId,
  ): Promise<WorkspaceMemberRecord | null>;

  /**
   * Hard delete (DB-D03) — bukan soft-delete. `actingUserId` (RLS, KI-026
   * follow-up) — user yang memicu mutasi ini.
   */
  removeMember(
    workspaceId: WorkspaceId,
    memberId: MemberId,
    actingUserId: UserId,
  ): Promise<void>;

  /** `actingUserId` (RLS, KI-026 follow-up) — user yang memicu mutasi ini. */
  updateMemberRole(
    workspaceId: WorkspaceId,
    memberId: MemberId,
    role: MemberRole,
    actingUserId: UserId,
  ): Promise<void>;

  createInvitation(input: {
    workspaceId: WorkspaceId;
    email: string;
    role: MemberRole;
    invitedByUserId: UserId;
    token: string;
    expiresAt: Date;
  }): Promise<WorkspaceInvitationRecord>;

  /**
   * Baris undangan untuk pasangan workspace + email (unik di database),
   * status apa pun. `actingUserId` untuk RLS. `null` kalau belum pernah
   * ada undangan untuk email itu.
   */
  findInvitationByWorkspaceEmail(
    workspaceId: WorkspaceId,
    email: string,
    actingUserId: UserId,
  ): Promise<WorkspaceInvitationRecord | null>;

  /**
   * Ganti undangan yang sudah tidak pending aktif (accepted, revoked,
   * expired, atau pending yang sudah lewat `expiresAt`) dengan token,
   * role, dan masa berlaku baru. Unik `(workspaceId, email)` tetap satu
   * baris. Compare-and-swap: pending yang masih berlaku tidak ditimpa.
   */
  reissueInvitation(input: {
    workspaceId: WorkspaceId;
    invitationId: InvitationId;
    actingUserId: UserId;
    email: string;
    role: MemberRole;
    token: string;
    expiresAt: Date;
  }): Promise<WorkspaceInvitationRecord>;

  /**
   * Belum dipakai service manapun — disiapkan untuk acceptInvite (task lain).
   * SENGAJA TIDAK dibungkus `withCurrentUser` (KI-026 follow-up, code review
   * PR #71) — invitee yang lookup token ini belum jadi member workspace
   * tujuan (chicken-and-egg struktural, sama seperti bootstrap INSERT
   * `workspace_members` di `createWithOwner`), jadi tidak ada `userId` valid
   * yang bisa memenuhi RLS policy `workspace_invitations_workspace_isolation`.
   * Butuh RLS policy exception (mis. trusted self-select by validated token)
   * — keputusan desain terpisah, di luar scope task ini.
   */
  findInvitationByToken(
    token: string,
  ): Promise<WorkspaceInvitationRecord | null>;

  /**
   * T-005.5 — fix CRITICAL finding (Ridwan Architecture Reviewer,
   * 2026-10-14): versi awal (`hasVerifiedPendingInvitationForEmail`, SELECT
   * murni) membiarkan sinyal "OTP sudah dikonfirmasi" (`emailVerifiedAt`)
   * dipakai ulang kapan saja sebelum invitation itu sendiri expired (sampai
   * 7 hari) — kalau Alice konfirmasi OTP lalu tab-nya crash SEBELUM
   * `signUp.email()` selesai, siapa pun yang tahu/menebak emailnya bisa
   * memanggil `/api/auth/sign-up/email` langsung (bypass UI+OTP total) dan
   * ikut lolos ditandai `emailVerified: true` dari sinyal milik Alice —
   * identity takeover penuh. Ada juga TOCTOU race lebih sempit: baca
   * (SELECT) dan pakai sinyal itu dua operasi terpisah, tidak atomic.
   *
   * Fix (dua lapis, method ini MENGGANTI `hasVerifiedPendingInvitationForEmail`
   * total — bukan ditambah di sampingnya):
   * 1. **Single-use** — SATU statement UPDATE yang membaca DAN langsung
   *    menandai `betterAuthEmailVerifiedConsumedAt` baris yang cocok,
   *    bukan SELECT lalu UPDATE terpisah. Percobaan kedua (replay, atau 2
   *    request konkuren) untuk email yang sama tidak akan pernah
   *    menemukan sinyal itu lagi — row-level locking Postgres di dalam
   *    satu UPDATE membuat ini aman di bawah concurrency juga (tidak ada
   *    jeda check-then-act untuk di-race). **Field yang ditandai SENGAJA
   *    bukan `emailVerifiedAt` sendiri** — fix regresi yang ditemukan
   *    lewat verifikasi end-to-end browser (bukan dugaan): `emailVerifiedAt`
   *    juga dibaca `WorkspaceService.acceptInvite` (jalan SETELAH
   *    signUp/signIn) sebagai bukti OTP sudah dikonfirmasi untuk token ini
   *    — kalau method ini meng-clear kolom yang sama, `acceptInvite` yang
   *    jalan belakangan salah simpul OTP belum pernah dikonfirmasi. Lihat
   *    migrasi `20261014150000_t005_5_separate_better_auth_consume_signal`
   *    dan doc comment kolom di `schema.prisma`.
   * 2. **TTL pendek independen dari `expiresAt` invitation** — 5 menit,
   *    dikunci DI DALAM RLS policy itu sendiri (migrasi
   *    `20261014130000_t005_5_accept_invite_signal_single_use_ttl`) — RLS
   *    adalah enforcement boundary yang SEBENARNYA; query Prisma di
   *    implementasi method ini menduplikasi angka yang sama persis sebagai
   *    defense-in-depth kedua, BUKAN constant yang di-share lintas layer
   *    (lihat komentar di implementasi Prisma-nya). Alur UI nyata
   *    (`AcceptInviteForm.tsx`) memanggil `signUp.email()` SEGERA setelah
   *    `confirmAcceptInviteVerificationAction` resolve (selisih beberapa
   *    round-trip network, bukan menit), jadi 5 menit longgar untuk jalur
   *    sah tapi menutup nyaris total jendela "OTP terkonfirmasi, tab
   *    ditinggal berjam-jam/berhari-hari".
   *
   * Dipakai Better Auth `databaseHooks.user.create.before`
   * (`lib/better-auth/auth.ts`). Anonim (tidak ada `app.current_user_id` —
   * hook berjalan sebelum user dibuat, pola sama
   * `findInvitationByToken`/`findUserByEmail` di atas), RLS
   * `workspace_invitations` digeser pakai GUC `app.invite_lookup_email`
   * (`setInviteLookupEmail`) — BUKAN flag boolean dari body request client,
   * yang bisa dipalsukan siapa pun yang memanggil `/api/auth/sign-up/email`
   * langsung. Return `true` HANYA kalau baris benar-benar berhasil
   * di-consume (UPDATE match ≥1 baris) — panggilan kedua untuk email yang
   * sama SELALU `false` sampai ada konfirmasi OTP baru yang menerbitkan
   * `emailVerifiedAt` baru DAN hash rahasia baru. Konfirmasi OTP ulang
   * mengosongkan `betterAuthEmailVerifiedConsumedAt`, jadi sinyal yang
   * sempat terpakai (sign-up gagal setelah consume) bisa dipakai lagi
   * hanya oleh browser yang memegang rahasia baru.
   *
   * `proofHash` wajib. Kosong → `false` tanpa menulis. Hash itu harus
   * sama dengan `betterAuthEmailProofHash` yang disimpan saat OTP
   * dikonfirmasi. Mengetahui email saja tidak cukup.
   */
  consumeVerifiedPendingInvitationForEmail(
    email: string,
    proofHash: string,
  ): Promise<boolean>;

  /**
   * Lookup Better Auth `User` by email (T-093.1) — dipakai untuk auto-detect
   * `isExistingUser` di halaman accept-invite (`/invite/[token]`): kalau
   * email invitation sudah punya akun, tampilkan form "Masuk"; kalau belum,
   * tampilkan form "Buat Akun Baru". Query langsung ke tabel `identity_user`
   * lewat Prisma — konsisten dengan precedent `findUsersByIds` di atas
   * (bounded context `workspace` sengaja boleh membaca `User` langsung,
   * tidak ada relasi FK, dua bounded context berbeda tapi satu database).
   * TIDAK dibungkus `withCurrentUser` — pemanggil (invitee) belum jadi
   * member workspace mana pun, sama seperti alasan `findInvitationByToken`
   * di atas tidak memakai RLS context.
   *
   * `createdAt` (T-110, KI-053) — dipakai `WorkspaceService.acceptInvite`
   * untuk guard "akun baru dibuat tanpa verifikasi email" (bandingkan
   * terhadap window waktu wajar sebelum request `acceptInvite` ini).
   */
  findUserByEmail(
    email: string,
  ): Promise<{ id: UserId; createdAt: Date } | null>;

  /**
   * Terima invitation (T-093.3) — SATU transaksi atomik: (1) flip
   * `WorkspaceInvitation.status` dari `pending` ke `accepted` + set
   * `acceptedAt` HANYA kalau status saat ini masih `pending` (guard
   * race/replay — token yang sudah dipakai tidak bisa dipakai ulang), (2)
   * upsert `WorkspaceMember` dengan `role` yang diteruskan APA ADANYA dari
   * `invitation.role` (bukan default) dan `status: active`. Implementasi
   * WAJIB set `app.current_user_id` ke `userId` (RLS chicken-and-egg) —
   * pola sama seperti `createWithOwner`, karena membership baru ini belum
   * ada saat insert dieksekusi. Melempar `ConflictError` bila invitation
   * sudah tidak `pending` lagi (accepted/revoked/expired) saat transaksi
   * dieksekusi.
   */
  acceptInvitation(input: {
    workspaceId: WorkspaceId;
    invitationId: InvitationId;
    userId: UserId;
    role: MemberRole;
  }): Promise<WorkspaceMemberRecord>;

  /**
   * Persist kode verifikasi baru (T-110.2, KI-053) — dipanggil
   * `WorkspaceService.requestInviteEmailVerification`. Reset
   * `verificationAttempts` ke 0 (kode baru = jatah percobaan baru). Compare-
   * and-swap: hanya berhasil kalau invitation masih `pending` (guard race
   * yang sama seperti `acceptInvitation`/`revokeInvitation`) — melempar
   * `ConflictError` bila tidak. Implementasi anonim (token-based, pola sama
   * `findInvitationByToken` — invitee belum punya akun sama sekali di jalur
   * `isExistingUser: false`, jadi TIDAK ADA `app.current_user_id`).
   */
  setInvitationVerificationCode(
    token: string,
    input: { codeHash: string; expiresAt: Date },
  ): Promise<void>;

  /**
   * Tandai email invitation terverifikasi (T-110.3, KI-053) — single-use:
   * set `emailVerifiedAt` DAN clear `verificationCodeHash`/
   * `verificationCodeExpiresAt` sekaligus supaya kode yang sama tidak bisa
   * dipakai ulang. Dipanggil `WorkspaceService.confirmInviteEmailVerification`
   * SETELAH kode dicocokkan benar. Compare-and-swap sama seperti
   * `setInvitationVerificationCode`.
   */
  markInvitationEmailVerified(token: string, proofHash: string): Promise<void>;

  /**
   * Reservasi SATU slot percobaan verifikasi kode secara atomic, capped di
   * `maxAttempts` (T-110.3, anti brute-force — code-review PR #142 finding:
   * pengecekan+increment yang dulu terpisah dua round-trip punya celah race
   * condition, N request konkuren bisa lolos cap yang sama). `UPDATE ...
   * WHERE verification_attempts < maxAttempts` membuat Postgres
   * men-serialize baris ini — hanya `maxAttempts` reservasi yang bisa
   * pernah berhasil berapa pun banyaknya request konkuren. Return jumlah
   * percobaan SETELAH increment, ATAU `maxAttempts + 1` sebagai sentinel
   * kalau reservasi gagal karena cap sudah tercapai (termasuk race dengan
   * request lain yang baru saja mengisi slot terakhir) — caller
   * membedakan via `attempts > maxAttempts`.
   */
  incrementInvitationVerificationAttempts(
    token: string,
    maxAttempts: number,
  ): Promise<number>;

  /**
   * Undangan `pending` yang belum melewati `expiresAt` (T-007.8, ADR-101) —
   * sumber baris virtual "Pending" di `/settings/members`, berlaku untuk
   * invitation yang dibuat lewat metode manapun (Copy Link maupun Kirim via
   * Email — keduanya sama-sama tabel `WorkspaceInvitation`, ADR-101 poin 3).
   * Sengaja TIDAK menyertakan invitation yang sudah `accepted`/`revoked`
   * atau sudah lewat `expiresAt` — baris itu tidak lagi relevan ditampilkan
   * sebagai "menunggu respons". `actingUserId` (RLS, KI-026 follow-up) —
   * member aktif workspace ini yang memicu query (bukan filter hasil).
   */
  listPendingInvitations(
    workspaceId: WorkspaceId,
    actingUserId: UserId,
  ): Promise<WorkspaceInvitationRecord[]>;

  /**
   * Batalkan undangan pending (Cancel Invitation, T-007.8, ADR-101 poin 5) —
   * set `WorkspaceInvitation.status` jadi `revoked`. Compare-and-swap
   * (`updateMany` dengan guard `status: pending` DAN `expiresAt` belum lewat)
   * — kalau tidak ada baris yang match (tidak ditemukan di workspace ini,
   * statusnya sudah bukan `pending` lagi, atau sudah lewat `expiresAt`),
   * melempar `ConflictError` generik (satu error, tanpa query kedua untuk
   * membedakan alasannya — race guard, pola sama seperti `acceptInvitation`).
   * `actingUserId` (RLS, KI-026 follow-up) — RBAC (Owner/Admin,
   * `assertActorCanManageMembers`) sudah diverifikasi di
   * `WorkspaceService.cancelInvitation` sebelum method ini dipanggil.
   */
  revokeInvitation(
    workspaceId: WorkspaceId,
    invitationId: InvitationId,
    actingUserId: UserId,
  ): Promise<void>;

  /**
   * Persist urutan channel sidebar personal user (T-012.1). Full rewrite
   * (delete+createMany) — caller (`WorkspaceService.saveChannelOrder`)
   * sudah memfilter `orderedConnectedAccountIds` supaya hanya berisi id
   * milik `workspaceId` ini (anti-IDOR); implementasi TIDAK perlu
   * re-verifikasi ownership.
   */
  saveChannelOrder(input: {
    workspaceId: WorkspaceId;
    userId: UserId;
    orderedConnectedAccountIds: ConnectedAccountId[];
  }): Promise<void>;

  /** Ordered by `position` ascending — urutan tersimpan milik satu user. */
  getChannelOrder(
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<ConnectedAccountId[]>;

  /**
   * Hapus workspace beserta seluruh data terkait — mengandalkan
   * `ON DELETE CASCADE` per `workspace_id` (T-008.2, ADR-050,
   * `database-strategy.md`). `actingUserId` (RLS, KI-026 follow-up) — user
   * yang memicu mutasi ini; RBAC (Owner-only) sudah diverifikasi di
   * `WorkspaceService.deleteWorkspace` sebelum method ini dipanggil.
   */
  deleteWorkspace(
    workspaceId: WorkspaceId,
    actingUserId: UserId,
  ): Promise<void>;

  /**
   * Set `Workspace.pendingOwnerTransferTo` (T-008.3, ADR-050) — langkah
   * pertama Transfer Ownership. `actingUserId` (RLS) adalah Owner yang
   * memicu, `targetUserId` adalah Admin yang dituju.
   */
  setPendingOwnerTransfer(
    workspaceId: WorkspaceId,
    targetUserId: UserId,
    actingUserId: UserId,
  ): Promise<void>;

  /**
   * Kosongkan `Workspace.pendingOwnerTransferTo` tanpa menukar role —
   * dipakai `WorkspaceService.cancelOwnershipTransfer` (method tambahan,
   * dibutuhkan UI banner pending — tidak disebut eksplisit di
   * `application-layer.md`/ADR-050, tapi konsisten dengan pola method
   * lain: Owner-only, no-op sederhana).
   */
  clearPendingOwnerTransfer(
    workspaceId: WorkspaceId,
    actingUserId: UserId,
  ): Promise<void>;

  /**
   * Terima Transfer Ownership (T-008.3, ADR-050) — dalam SATU transaksi:
   * role Owner lama diturunkan jadi Admin, role target dinaikkan jadi
   * Owner, `Workspace.ownerId` diupdate ke `newOwnerUserId` (field ini
   * merepresentasikan Owner aktual — domain-model.md BC-02), dan
   * `pendingOwnerTransferTo` dikosongkan. `actingUserId` (RLS) adalah
   * `newOwnerUserId` — user yang menerima transfer dan memicu mutasi ini.
   */
  acceptOwnershipTransfer(input: {
    workspaceId: WorkspaceId;
    currentOwnerMemberId: MemberId;
    targetMemberId: MemberId;
    newOwnerUserId: UserId;
  }): Promise<void>;

  /**
   * Ubah `Workspace.name` (T-008.4) — reversible, low-stakes, tanpa
   * konfirmasi (beda dengan Danger Zone). `actingUserId` (RLS, KI-026
   * follow-up) — user yang memicu mutasi ini; RBAC (member aktif) sudah
   * diverifikasi di `WorkspaceService.renameWorkspace` sebelum method ini
   * dipanggil. Slug TIDAK ikut berubah — hanya nama tampilan.
   */
  renameWorkspace(
    workspaceId: WorkspaceId,
    name: string,
    actingUserId: UserId,
  ): Promise<WorkspaceRecord>;

  /**
   * Webhook Outstand `account.token_expired` (T-026.5, T-015) — tandai
   * `WorkspaceConnectedAccount.reconnectRequired = true` by external
   * `outstandAccountId` (payload webhook membawa id Outstand, bukan id
   * internal kita). Returns `null` kalau tidak ada akun dengan
   * `outstandAccountId` itu.
   *
   * **TIDAK menerima `actingUserId`** — sama alasan dengan
   * `IPublishingRepository.findPostTargetsByOutstandPostId` (T-026): webhook
   * route tidak punya session, jadi tidak ada acting user sebelum akun ini
   * ditemukan. Implementasi Prisma resolve `workspace.ownerId` (kolom tanpa
   * RLS di tabel `workspaces`) lewat SECURITY DEFINER SQL function (migration
   * `20260907120000_t026_outstand_webhook_system_lookups`) untuk BACA lintas
   * akun, lalu memakai Owner itu sendiri sebagai `actingUserId` untuk
   * MENULIS `reconnectRequired` lewat `withCurrentUser` yang sudah ada
   * (Owner workspace dijamin member aktif di workspace-nya sendiri, jadi RLS
   * tetap terpenuhi untuk langkah tulis). `ownerUserId` dikembalikan supaya
   * `WebhookProcessor` bisa langsung memakainya untuk trigger notifikasi
   * (T-026.5) tanpa query terpisah.
   */
  markAccountReconnectRequired(outstandAccountId: string): Promise<{
    workspaceId: WorkspaceId;
    connectedAccountId: ConnectedAccountId;
    ownerUserId: UserId;
  } | null>;

  /**
   * Read-only variant of `markAccountReconnectRequired`'s lookup (T-051,
   * JOB-03 Engagement Sync) — reuses the SAME SECURITY DEFINER SQL function
   * (`webhook_find_account_owner_by_outstand_account_id`, migration
   * `20260907120000_t026_outstand_webhook_system_lookups`), no write.
   *
   * **Why `engagement` needs this:** JOB-03's periodic sync job has no
   * Better Auth session (same chicken-and-egg as T-026's webhook route),
   * so it has no legitimate `userId` to pass into `withCurrentUser` for
   * `EngagementInboxItem` writes until it resolves ONE. The job payload
   * already carries `outstandAccountId` (`background-jobs.md` § JOB-03),
   * so resolving the workspace Owner here — guaranteed an active member of
   * their own workspace — gives `EngagementSyncJobHandler` a safe acting
   * user, exactly the same pattern `markAccountReconnectRequired` already
   * established for T-026.5. Returns `null` kalau tidak ada akun dengan
   * `outstandAccountId` itu (job handler menganggap ini anomali — retry
   * lewat job runner, TIDAK self-reschedule).
   *
   * **`handle` (redesain KI-068/ADR-113)** — ditambahkan supaya
   * `EngagementSyncJobHandler` bisa menyuplai `accountUsername` ke
   * `SyncCommentsUseCase.sync` tanpa lookup terpisah (API resmi Outstand
   * butuh username untuk `fetchComments`/disambiguasi multi-akun — lihat
   * `outstand-adapter.ts`). Diimplementasikan lewat kolom baru pada fungsi
   * SQL yang sama, migration `20260924090000_ki068_add_handle_to_account_owner_lookup`.
   */
  findAccountOwnerByOutstandAccountId(outstandAccountId: string): Promise<{
    workspaceId: WorkspaceId;
    connectedAccountId: ConnectedAccountId;
    ownerUserId: UserId;
    handle: string;
  } | null>;

  /**
   * Fan-out JOB-04 (T-048) — seluruh ConnectedAccount `active` yang tidak
   * `reconnectRequired`, lintas workspace. Tidak butuh acting user: query
   * lewat SECURITY DEFINER `analytics_list_active_connected_accounts`
   * karena cron tidak punya sesi. Dipakai `EnqueueAnalyticsSyncUseCase`,
   * bukan UI.
   */
  listActiveConnectedAccountsForSync(): Promise<
    {
      workspaceId: WorkspaceId;
      connectedAccountId: ConnectedAccountId;
      outstandAccountId: string;
    }[]
  >;

  /**
   * Disconnect akun (T-014.2, ADR-048/ADR-049) — set
   * `WorkspaceConnectedAccount.status` jadi `"disconnected"` DAN
   * `reconnectRequired` jadi `false` (state "perlu reconnect" tidak relevan
   * lagi setelah disconnect manual — supaya `resolveConnectionDisplayStatus`
   * langsung menampilkan "Disconnected", bukan "Perlu Reconnect" yang stale).
   * TIDAK menghapus baris, TIDAK memanggil Outstand API — OAuth/token
   * dikelola Outstand di luar DB internal (catatan T-013), cukup update
   * status DB. TIDAK menyentuh `PublishingPostTarget` mana pun — post yang
   * sudah terjadwal untuk akun ini SENGAJA tetap di antrean (KSP-D09), tidak
   * otomatis dibatalkan. `actingUserId` (RLS, KI-026 follow-up) — RBAC
   * (Owner/Admin) sudah diverifikasi di `WorkspaceService.disconnectAccount`
   * sebelum method ini dipanggil. Melempar `ConflictError` generik bila
   * `updateMany` tidak match — baik karena `connectedAccountId` tidak
   * ditemukan di `workspaceId` ini maupun karena akun sudah berstatus
   * `"disconnected"` (defense-in-depth — UI real tidak menampilkan tombol
   * Disconnect untuk akun yang sudah disconnected, tapi backend tetap
   * menolak eksplisit). Tidak dibedakan lagi NotFound vs Conflict lewat
   * query kedua — sama pola seperti `revokeInvitation`, round-trip
   * tambahan untuk pesan yang lebih presisi tidak sepadan di jalur
   * double-click ini.
   */
  disconnectAccount(
    workspaceId: WorkspaceId,
    connectedAccountId: ConnectedAccountId,
    actingUserId: UserId,
  ): Promise<void>;

  /**
   * Lookup satu akun by id (T-013.1/T-015.3, ADR-105) — dipakai
   * `WorkspaceService.initiateConnectAccount`/`completeAccountConnection`
   * untuk memvalidasi `redirectAccountId` (reconnect) benar-benar milik
   * `workspaceId` ini SEBELUM redirect diminta maupun SEBELUM update
   * dieksekusi — defense-in-depth terhadap `redirectAccountId` yang
   * ditamper di client/query-param `state` (round-trip lewat browser,
   * public). `actingUserId` (RLS, KI-026 follow-up). Returns `null` kalau
   * tidak ditemukan di workspace ini.
   */
  findConnectedAccountById(
    workspaceId: WorkspaceId,
    connectedAccountId: ConnectedAccountId,
    actingUserId: UserId,
  ): Promise<ConnectedAccountRecord | null>;

  /**
   * Lookup satu akun by `outstandAccountId` di dalam `workspaceId` ini
   * (KI-079) — dipakai `WorkspaceService.completeAccountConnection` untuk
   * membedakan double-submit genuine (request susulan Next.js untuk akun
   * yang BARU SAJA dibuat, lihat docstring Route Handler callback) dari
   * percobaan Connect ke akun yang SUDAH terhubung dari alur/waktu yang
   * berbeda, setelah `createConnectedAccount` melempar `ConflictError`
   * (unique constraint `[workspaceId, outstandAccountId]`). Returns
   * `null` kalau tidak ditemukan di workspace ini.
   */
  findConnectedAccountByOutstandId(
    workspaceId: WorkspaceId,
    outstandAccountId: string,
    actingUserId: UserId,
  ): Promise<ConnectedAccountRecord | null>;

  /**
   * Cek apakah `connectedAt` baris ini masih di dalam `windowMs` terakhir
   * — dipakai `WorkspaceService.createOrRecoverConnectedAccount` (KI-079)
   * untuk keputusan double-submit-recovery yang SAMA seperti
   * `findConnectedAccountByOutstandId` di atas, tapi perbandingan waktu
   * dilakukan di sisi Postgres (`now() - connected_at`), BUKAN
   * `Date.now()` di Node (code review PR #139) — kalau jam app-server
   * (Railway) drift dari jam database (Supabase), perbandingan lintas-jam
   * bisa salah klasifikasi genuine double-submit sebagai percobaan
   * terpisah, atau sebaliknya. Domain (`WorkspaceService`) tidak boleh
   * mengimpor Prisma (rule 6 `AGENTS.md`), jadi perbandingan waktu ini
   * WAJIB di lapisan repository, bukan dihitung dari `connectedAt` yang
   * sudah di-fetch ke Node. Returns `false` kalau baris tidak ditemukan.
   */
  isConnectedAccountWithinWindow(
    connectedAccountId: ConnectedAccountId,
    windowMs: number,
    actingUserId: UserId,
  ): Promise<boolean>;

  /**
   * CREATE `WorkspaceConnectedAccount` baru (T-013.1/T-013.2, Connect
   * Account, ADR-105) — dipanggil `WorkspaceService.completeAccountConnection`
   * saat `redirectAccountId` kosong (bukan reconnect). `connectedAt`
   * default `now()` (koneksi baru). Melempar `ConflictError` kalau
   * `outstandAccountId` ini sudah terhubung di `workspaceId` ini (unique
   * constraint `[workspaceId, outstandAccountId]`). `actingUserId` (RLS,
   * KI-026 follow-up) — RBAC (Owner/Admin) sudah diverifikasi
   * `WorkspaceService` sebelum method ini dipanggil.
   */
  createConnectedAccount(input: {
    workspaceId: WorkspaceId;
    platform: SocialPlatform;
    outstandAccountId: string;
    handle: string;
    /** KI-076/ADR-120 — lihat docstring `ConnectedAccountRecord.avatarUrl`. */
    avatarUrl?: string | null;
    actingUserId: UserId;
  }): Promise<ConnectedAccountRecord>;

  /**
   * CREATE beberapa `WorkspaceConnectedAccount` dalam SATU transaksi.
   * Akun yang `outstandAccountId`-nya sudah ada di workspace ini di-skip
   * (idempoten). Kegagalan di tengah membatalkan seluruh batch, bukan
   * menyisakan sebagian Page.
   */
  createConnectedAccounts(input: {
    workspaceId: WorkspaceId;
    actingUserId: UserId;
    accounts: {
      platform: SocialPlatform;
      outstandAccountId: string;
      handle: string;
      /** KI-076/ADR-120 — lihat docstring `ConnectedAccountRecord.avatarUrl`. */
      avatarUrl?: string | null;
    }[];
  }): Promise<ConnectedAccountRecord[]>;

  /**
   * UPDATE akun existing (T-015.3, Reconnect, ADR-105, redesain ADR-112)
   * — refresh `outstandAccountId`/`handle` dari hasil
   * `resolveConnectCallback` terbaru,
   * set `status: "active"` dan `reconnectRequired: false`. `connectedAt`
   * TIDAK direset — reconnect bukan re-create, riwayat
   * `PublishingPostTarget`/`EngagementInboxItem` yang merujuk row
   * `connectedAccountId` yang sama tetap utuh (requirement T-015.3 "tanpa
   * kehilangan riwayat post"). Melempar `NotFoundError` kalau
   * `connectedAccountId` tidak ditemukan di `workspaceId` ini.
   * `actingUserId` (RLS, KI-026 follow-up) — RBAC + ownership
   * (`findConnectedAccountById`) sudah diverifikasi `WorkspaceService`
   * sebelum method ini dipanggil.
   */
  reconnectAccount(input: {
    workspaceId: WorkspaceId;
    connectedAccountId: ConnectedAccountId;
    outstandAccountId: string;
    handle: string;
    /**
     * KI-076/ADR-120 — refresh foto profil sekalian saat reconnect (foto
     * lama bisa sudah berubah/berbeda dari akun yang di-reconnect-kan).
     * Lihat docstring `ConnectedAccountRecord.avatarUrl`.
     */
    avatarUrl?: string | null;
    actingUserId: UserId;
  }): Promise<ConnectedAccountRecord>;

  /**
   * Import Posts dari Social Account (T-090.3, ADR-093 poin 6) — update
   * salah satu/kedua watermark import. Dipanggil lewat
   * `ConnectedAccountWatermarkPort` (`ImportPostsTriggerUseCase`, domain
   * `publishing`) — composition root yang menyambungkan port itu ke method
   * ini, domain `publishing` sendiri TIDAK mengimpor `IWorkspaceRepository`
   * (AGENTS.md #7). Hanya field yang diisi (non-`undefined`) yang
   * di-update — caller mengisi SALAH SATU (`lastImportRequestedAt` saja
   * saat request dimulai, `lastImportedUntil` saja saat sukses selesai)
   * atau keduanya, tidak pernah mengirim dua-duanya `undefined`.
   *
   * **`actingUserId` WAJIB ada (koreksi 2026-10-08, bug ditemukan testing
   * end-to-end DB nyata T-090.3)** — docstring versi sebelumnya mengklaim
   * method ini aman tanpa `actingUserId`/RLS karena "write murni field
   * watermark tidak membocorkan data lintas tenant". Klaim itu SALAH:
   * `workspace_connected_accounts` dijaga RLS policy `FOR ALL` (migration
   * `20260813045625_t017_add_rls_policies`), dan `FOR ALL` tanpa
   * `WITH CHECK` terpisah berarti `USING` berlaku juga untuk `UPDATE` — tanpa
   * `app.current_user_id` di-set, `updateMany` match 0 baris SELALU, secara
   * senyap (watermark tidak pernah persisten, cooldown manual ADR-093 poin 9
   * jadi non-fungsional). Implementasi Prisma WAJIB `withCurrentUser`, sama
   * pola `reconnectAccount` di atas. Semua caller (`triggerAuto`/
   * `triggerPeriodicForAccounts`/`triggerManual`) sudah punya `actingUserId`
   * di input masing-masing — termasuk jalur periodik (cron, KI-088 resolved
   * 2026-10-15), yang me-resolve-nya SENDIRI lewat
   * `findAccountOwnerByOutstandAccountId` di bawah (pola sama JOB-04/JOB-03),
   * BUKAN `Workspace.ownerId` langsung.
   *
   * Silent no-op kalau `connectedAccountId` tidak ditemukan ATAU acting user
   * bukan member aktif workspace tersebut (best effort, sama pola
   * `cancelScheduledPost` — kegagalan update watermark tidak boleh
   * menggagalkan import yang sudah berhasil diproses).
   */
  updateImportWatermark(input: {
    connectedAccountId: ConnectedAccountId;
    lastImportedUntil?: Date;
    lastImportRequestedAt?: Date;
    actingUserId: UserId;
  }): Promise<void>;
}
