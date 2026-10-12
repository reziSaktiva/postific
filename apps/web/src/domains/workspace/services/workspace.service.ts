import { createHash, randomBytes, randomInt } from "node:crypto";
import {
  EMAIL_PATTERN,
  InvitationStatus,
  MemberRole,
  MemberStatus,
  NotificationType,
  OWNER_OR_ADMIN_ROLES,
  SocialPlatform,
} from "@postific/shared";
import type {
  ConnectedAccountId,
  FacebookPendingPage,
  IOutstandAdapter,
  InvitationId,
  MemberId,
  PinterestBoard,
  UserId,
  WorkspaceId,
} from "@postific/shared";
import {
  AlreadyConnectedError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/utils/errors";
import { timingSafeEqualString } from "@/lib/utils/timing-safe-equal-string";
import { slugify } from "../value-objects/slugify";
import type {
  ConnectedAccountRecord,
  IWorkspaceRepository,
  WorkspaceInvitationRecord,
  WorkspaceMemberRecord,
  WorkspaceMembershipSummary,
  WorkspaceRecord,
} from "../repositories/workspace.repository";
import type {
  MemberListRow,
  SidebarChannelAccount,
  WorkspaceInviteAcceptView,
  WorkspaceMemberWithUser,
} from "../types";

const MAX_NAME_LENGTH = 100;
const MAX_SLUG_ATTEMPTS = 6;
/**
 * KI-079 — jendela toleransi untuk membedakan double-submit genuine (request
 * susulan Next.js untuk akun yang BARU SAJA dibuat, lihat docstring Route
 * Handler callback `/api/integrations/outstand/callback`) dari percobaan
 * Connect ke akun yang sudah terhubung dari alur/waktu yang berbeda. Request
 * susulan yang didokumentasikan terjadi nyaris seketika (prefetch/revalidasi
 * bawaan Next.js) — 15 detik memberi headroom besar untuk itu tanpa
 * menyamarkan percobaan connect genuinely terpisah (menit/jam/hari
 * kemudian) sebagai "aman diabaikan".
 */
const DOUBLE_SUBMIT_RECOVERY_WINDOW_MS = 15_000;
/** ADR-072 & ADR-080 — copy "Undangan berlaku 7 hari" di dialog Claude Design. */
const INVITATION_EXPIRY_DAYS = 7;
/**
 * T-110 (KI-053) — verifikasi kepemilikan email accept-invite, HANYA jalur
 * `isExistingUser: false`. Kode 6 digit, TTL 10 menit (desain Claude Design
 * dikunci, lihat task doc), maks 5 percobaan salah (ruang 1 juta kombinasi
 * / window 10 menit — cukup ketat untuk anti brute-force tanpa terlalu
 * ketat untuk salah ketik wajar).
 */
const INVITE_VERIFICATION_CODE_LENGTH = 6;
const INVITE_VERIFICATION_CODE_TTL_MINUTES = 10;
const INVITE_VERIFICATION_MAX_ATTEMPTS = 5;
/**
 * Port lokal untuk cross-domain `publishing` → `workspace` (T-012.2,
 * AGENTS.md #7) — implementation detail `WorkspaceService`, bukan kontrak
 * publik domain `workspace`. Sengaja TIDAK `export` (bukan cuma "tidak
 * diekspor dari barrel") — `index.ts` memakai `export *` per file, jadi
 * kalau interface ini di-export dari sini, dia otomatis ikut ke-export
 * ulang lewat barrel juga (tidak ada cara meng-exclude satu named export
 * dari `export *`). Constructor param di bawah cukup memakai tipe ini
 * secara lokal (structural typing) — caller (`layout.tsx`, dan fake port
 * di `workspace.service.test.ts`) tidak perlu mengimpor tipe ini sama
 * sekali, cukup passing object literal yang bentuknya cocok.
 * `PublishingService` konkret TIDAK boleh diimport ke file ini; import
 * cross-domain hanya terjadi di composition root (`app/(app)/layout.tsx`),
 * yang menyuplai instance ini lewat constructor.
 */
interface ScheduledCountsPort {
  countScheduledByAccount(
    workspaceId: WorkspaceId,
    connectedAccountIds: ConnectedAccountId[],
    userId: UserId,
  ): Promise<Map<ConnectedAccountId, number>>;
}

/**
 * Port lokal untuk cross-domain `workspace` → `notification` (T-008.3,
 * ADR-050, AGENTS.md #7) — pola sama seperti `ScheduledCountsPort` di atas.
 * `NotificationService` konkret TIDAK boleh diimport ke file ini; composition
 * root (Server Action) menyuplai instance lewat constructor. Opsional (bisa
 * `undefined`, mis. di test) supaya caller lama tanpa notifikasi tidak perlu
 * berubah — tapi wajib disuplai di composition root produksi untuk
 * `transferOwnership`/`acceptOwnershipTransfer` supaya notifikasi
 * benar-benar terkirim (ADR-050).
 */
interface NotificationPort {
  notify(input: {
    workspaceId: WorkspaceId;
    userId: UserId;
    type: NotificationType;
    title: string;
    body: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }): Promise<unknown>;
}

/**
 * Port lokal untuk cross-domain `workspace` → `publishing` (T-090.3,
 * ADR-093 poin 7, AGENTS.md #7) — pola sama `ScheduledCountsPort` di atas.
 * `ImportPostsTriggerUseCase` (domain `publishing`) TIDAK boleh diimport
 * konkret ke file ini; composition root
 * (`createWorkspaceServiceWithOutstandAdapter`) menyuplai instance lewat
 * constructor. Opsional (bisa `undefined`, mis. caller lama/test yang
 * tidak butuh auto-trigger import) — dipanggil BEST-EFFORT
 * (`completeAccountConnection` tidak boleh gagal hanya karena trigger
 * import gagal/Outstand down) dari `completeAccountConnection`, HANYA pada
 * jalur CREATE akun baru (bukan reconnect — `lastImportedUntil` akun baru
 * dijamin kosong, ADR-093 poin 7 "since = 90 hari (lastImportedUntil masih
 * kosong)"; akun reconnect existing mungkin sudah pernah di-import
 * sebelumnya, tidak diasumsikan perlu re-trigger otomatis di sini).
 */
interface ImportPostsAutoTriggerPort {
  triggerAuto(input: {
    workspaceId: WorkspaceId;
    connectedAccountId: ConnectedAccountId;
    outstandAccountId: string;
    platform: SocialPlatform;
    actingUserId: UserId;
  }): Promise<unknown>;
}

/**
 * Port lokal untuk cross-domain `workspace` → `engagement` (Temuan #1
 * review Ridwan Architecture Reviewer, T-051, `background-jobs.md` §
 * "Workspace BC → Background Job": "ConnectedAccount created/activated →
 * JobScheduler.scheduleEngagementSync(connectedAccount)"). Sebelum
 * perbaikan ini, JOB-03 pertama untuk sebuah `ConnectedAccount` TIDAK
 * PERNAH dibuat — `EngagementSyncJobHandler` hanya self-reschedule
 * SETELAH sebuah job sudah ada, tidak ada apa pun yang men-seed job
 * pertama, sehingga siklus sync 30 menit tidak pernah mulai berjalan
 * sendiri.
 *
 * `workspace` TIDAK BOLEH mengimpor apa pun dari domain `engagement`
 * (dependency terdokumentasi HANYA satu arah: `engagement` → `workspace`,
 * `application-layer.md` § "Peta Dependency Antar Domain") — pola sama
 * `ScheduledCountsPort`/`NotificationPort` di atas: `WorkspaceService`
 * hanya tahu "akun ini baru terhubung/reconnect, panggil hook ini",
 * TIDAK tahu apa pun soal tipe job/`ENGAGEMENT_SYNC_JOB_TYPE`. Composition
 * root (`createWorkspaceServiceWithOutstandAdapter`) menyuplai
 * implementasi konkret yang mengimpor `ENGAGEMENT_SYNC_JOB_TYPE` dari
 * `@/domains/engagement` dan meng-enqueue lewat `IJobScheduler`. Opsional
 * (`undefined` di test/caller lama) — kalau tidak disuplai, seeding
 * di-skip diam-diam (pola sama `NotificationPort`), bukan throw.
 */
interface EngagementSyncSeederPort {
  onAccountConnected(input: {
    workspaceId: WorkspaceId;
    connectedAccountId: ConnectedAccountId;
    outstandAccountId: string;
  }): Promise<void>;
}

/**
 * Port lokal untuk cross-domain/infra `workspace` → email transactional
 * (T-110, KI-053, AGENTS.md #6) — `WorkspaceService` TIDAK BOLEH mengimpor
 * Resend SDK/HTTP client langsung. Implementasi konkret ada di
 * `apps/web/src/lib/adapters/email/` (pola factory sama
 * `getOutstandAdapter()`, ADR-119 — wajib env var, tidak ada fallback Fake
 * di produksi), disuplai composition root
 * (`createWorkspaceServiceWithInviteEmailSender`,
 * `lib/workspace/invite-email-workspace-service.ts`) lewat constructor.
 * Opsional (`undefined` di caller lama/test yang tidak menyentuh
 * `requestInviteEmailVerification`) — lihat `requireInviteEmailSender()`.
 */
interface InviteEmailSenderPort {
  sendInviteVerificationCode(input: {
    email: string;
    code: string;
    workspaceName: string;
  }): Promise<void>;
}

/** T-110 — kode OTP 6 digit, `crypto.randomInt` (uniform, tidak predictable/sequential). */
function generateInviteVerificationCode(): string {
  return randomInt(0, 10 ** INVITE_VERIFICATION_CODE_LENGTH)
    .toString()
    .padStart(INVITE_VERIFICATION_CODE_LENGTH, "0");
}

/**
 * T-110 — kode disimpan HANYA sebagai hash (sha256), tidak pernah
 * plaintext. Tanpa salt: ruang kombinasi 6 digit (1 juta) sudah cukup
 * kecil sehingga salt per-baris tidak menambah biaya brute-force yang
 * berarti (kalau DB bocor, attacker brute-force sha256 tanpa salt untuk 1
 * juta kombinasi dalam hitungan detik terlepas ada/tidaknya salt) —
 * pertahanan sesungguhnya ada di TTL 10 menit + maks 5 percobaan
 * (`WorkspaceService.confirmInviteEmailVerification`), bukan di hash-nya.
 * Precedent hash sha256 sudah dipakai `parse-webhook-payload.ts` untuk
 * kasus serupa (bukan pola baru di codebase ini). Diekspor (pola sama
 * `fingerprintRawBody` di `parse-webhook-payload.ts`) supaya
 * `workspace.service.test.ts` bisa menyusun hash "kode benar" tanpa
 * duplikasi algoritma di file test.
 */
export function hashInviteVerificationCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/**
 * Timing-safe compare (hindari timing attack pada perbandingan hash) —
 * code-review PR #142 finding: reuse `timingSafeEqualString` yang sudah
 * ada (dipakai juga `/api/jobs/run/route.ts`) alih-alih menulis ulang
 * decode-hex + `timingSafeEqual` sendiri. Kedua hex digest sha256 sama
 * panjang (64 char), jadi membandingkannya sebagai string tetap
 * constant-time — tidak perlu decode ke `Buffer` byte mentah lebih dulu.
 */
function matchesInviteVerificationCode(code: string, hash: string): boolean {
  return timingSafeEqualString(hashInviteVerificationCode(code), hash);
}

export class WorkspaceService {
  constructor(
    private readonly repository: IWorkspaceRepository,
    private readonly scheduledCounts?: ScheduledCountsPort,
    private readonly notifications?: NotificationPort,
    /**
     * Connect/Reconnect Account (T-013.1/T-013.2, T-015.3, ADR-105) —
     * `IOutstandAdapter` sudah jadi kontrak publik `@postific/shared` (T-041),
     * jadi diimpor langsung sebagai TIPE di sini (bukan pelanggaran
     * AGENTS.md #6 — itu larangan mengimpor implementasi/HTTP client
     * konkret, bukan interface ACL-nya sendiri; pola sama seperti
     * `IOutstandAdapter` di constructor use-case domain `publishing`).
     * Opsional (bisa `undefined`, mis. di caller lama yang tidak butuh
     * Connect Account) — composition root (Server Action/Route Handler)
     * WAJIB menyuplai `getOutstandAdapter()` untuk
     * `initiateConnectAccount`/`completeAccountConnection`, lihat
     * `requireOutstandAdapter()`.
     */
    private readonly outstandAdapter?: IOutstandAdapter,
    /**
     * Seed JOB-03 pertama saat `ConnectedAccount` created/activated
     * (Temuan #1 review Ridwan, T-051) — lihat docstring
     * `EngagementSyncSeederPort`. Opsional, sama pola `scheduledCounts`/
     * `notifications` — caller lama (Server Action yang tidak menyentuh
     * `completeAccountConnection`, mis. `disconnectAccount`) tidak perlu
     * berubah.
     */
    private readonly engagementSyncSeeder?: EngagementSyncSeederPort,
    /**
     * Kirim kode verifikasi accept-invite (T-110, KI-053) — lihat
     * docstring `InviteEmailSenderPort`. Opsional (`undefined` di
     * caller/test yang tidak menyentuh `requestInviteEmailVerification`) —
     * composition root produksi WAJIB menyuplai
     * `createWorkspaceServiceWithInviteEmailSender()` untuk Server Action
     * `requestAcceptInviteVerificationAction`, lihat `requireInviteEmailSender()`.
     */
    private readonly inviteEmailSender?: InviteEmailSenderPort,
    /**
     * Import Posts dari Social Account (T-090.3, ADR-093 poin 7) — lihat
     * docstring `ImportPostsAutoTriggerPort`. Opsional, composition root
     * produksi (`createWorkspaceServiceWithOutstandAdapter`) WAJIB
     * menyuplainya supaya auto-trigger on-connect benar-benar berjalan.
     */
    private readonly importPostsTrigger?: ImportPostsAutoTriggerPort,
  ) {}

  async createWorkspace(input: {
    userId: UserId;
    name: string;
  }): Promise<WorkspaceRecord> {
    const name = input.name.trim();

    if (!name) {
      throw new ValidationError("Nama workspace wajib diisi.");
    }
    if (name.length > MAX_NAME_LENGTH) {
      throw new ValidationError(
        `Nama workspace maksimal ${MAX_NAME_LENGTH} karakter.`,
      );
    }

    const baseSlug = slugify(name);
    if (!baseSlug) {
      throw new ValidationError("Nama workspace tidak valid.");
    }

    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      const candidateSlug =
        attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;

      try {
        return await this.repository.createWithOwner({
          name,
          slug: candidateSlug,
          ownerId: input.userId,
        });
      } catch (error) {
        const isLastAttempt = attempt === MAX_SLUG_ATTEMPTS - 1;
        if (error instanceof ConflictError && !isLastAttempt) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictError(
      "Gagal membuat slug workspace yang unik. Coba nama lain.",
    );
  }

  async getDefaultWorkspaceForUser(
    userId: UserId,
  ): Promise<WorkspaceRecord | null> {
    return this.repository.findDefaultWorkspaceForUser(userId);
  }

  /**
   * Seluruh workspace dengan membership aktif milik user (T-089.2,
   * ADR-088) — dipakai halaman `settings/account/workspaces` untuk render
   * list Workspace Switcher. Method tipis, meneruskan langsung ke
   * repository (tidak ada business logic tambahan di sini).
   */
  async listWorkspacesForUser(
    userId: UserId,
  ): Promise<WorkspaceMembershipSummary[]> {
    return this.repository.listWorkspacesForUser(userId);
  }

  /**
   * Validasi Workspace Switcher (T-089.2, ADR-088) — memastikan user
   * benar-benar anggota AKTIF dari `targetWorkspaceId` sebelum caller
   * (Server Action `switchWorkspaceAction`) mengizinkan overwrite cookie
   * `active-workspace-id` dan redirect. **Sengaja TIDAK** menyentuh
   * cookie/redirect di sini — itu concern Entry Point (Server Action),
   * bukan Application Service (AGENTS.md #5), pola sama seperti
   * `createWorkspaceAction` di alur onboarding. Melempar
   * `AuthorizationError` (pesan sama seperti `assertActiveMembership`) bila
   * user bukan anggota aktif workspace target — mis. dihapus dari
   * workspace di tab lain, atau id yang di-tamper dari client.
   */
  async switchWorkspace(input: {
    userId: UserId;
    targetWorkspaceId: WorkspaceId;
  }): Promise<WorkspaceMemberRecord> {
    return this.assertActiveMembership(input.targetWorkspaceId, input.userId);
  }

  /** Dipakai `getWorkspaceContext()` (ADR-076) — resolve workspace by cookie id. */
  async getWorkspaceById(
    workspaceId: WorkspaceId,
  ): Promise<WorkspaceRecord | null> {
    return this.repository.findById(workspaceId);
  }

  /**
   * Lookup membership by user — satu-satunya membership-check di codebase
   * ini, dipakai `assertActorCanManageMembers` (dedup, bukan pola baru).
   */
  async getMembership(
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<WorkspaceMemberRecord | null> {
    return this.repository.getMember(workspaceId, userId);
  }

  async listConnectedAccounts(
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<ConnectedAccountRecord[]> {
    return this.repository.listConnectedAccounts(workspaceId, userId);
  }

  /**
   * Lookup satu akun terhubung by id (dipakai `syncNowAction`, T-090.3,
   * code review Ridwan) — method tipis, reuse langsung
   * `findConnectedAccountById` tanpa logic tambahan, pola sama seperti
   * `getWorkspaceById`/`getMembership`. Entry point (Server Action) TIDAK
   * boleh mengimpor repository langsung (AGENTS.md #5) — ini satu-satunya
   * jalur yang boleh dipakai untuk kebutuhan itu.
   */
  async getConnectedAccountById(
    workspaceId: WorkspaceId,
    connectedAccountId: ConnectedAccountId,
    actorId: UserId,
  ): Promise<ConnectedAccountRecord | null> {
    return this.repository.findConnectedAccountById(
      workspaceId,
      connectedAccountId,
      actorId,
    );
  }

  /**
   * Jumlah akun terhubung berstatus "active" (T-042.2, dikonsumsi
   * `AnalyticsService.getDashboardSummary` via `ActiveAccountsPort` —
   * `WorkspaceService` cocok secara struktural, tidak perlu wrapper
   * terpisah). "active" adalah default `WorkspaceConnectedAccount.status`
   * (schema.prisma) — akun dengan status lain (mis. hasil disconnect)
   * sengaja tidak dihitung, konsisten dengan `reconnectRequired` sebagai
   * sinyal degradasi terpisah di `listSidebarChannels`.
   */
  async countActiveConnectedAccounts(
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<number> {
    return this.repository.countActiveConnectedAccounts(workspaceId, userId);
  }

  /**
   * Returns connected accounts shaped for sidebar rendering (T-012,
   * ADR-058), diurutkan sesuai posisi tersimpan personal user (T-012.1).
   * Channel yang belum punya posisi tersimpan (baru terhubung) di-append
   * di akhir sesuai urutan `connectedAt` asli dari repository.
   */
  async listSidebarChannels(
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<SidebarChannelAccount[]> {
    const accounts = await this.repository.listConnectedAccounts(
      workspaceId,
      userId,
    );
    const counts =
      (await this.scheduledCounts?.countScheduledByAccount(
        workspaceId,
        accounts.map((account) => account.id),
        userId,
      )) ?? new Map<ConnectedAccountId, number>();

    const storedOrder = await this.repository.getChannelOrder(
      workspaceId,
      userId,
    );
    const positionById = new Map(
      storedOrder.map((connectedAccountId, index) => [
        connectedAccountId,
        index,
      ]),
    );
    const orderedAccounts = [...accounts].sort((a, b) => {
      const posA = positionById.get(a.id);
      const posB = positionById.get(b.id);
      if (posA === undefined && posB === undefined) {
        return 0;
      }
      if (posA === undefined) {
        return 1;
      }
      if (posB === undefined) {
        return -1;
      }
      return posA - posB;
    });

    return orderedAccounts.map((account) => ({
      id: account.id,
      platform: account.platform,
      handle: account.handle,
      status: account.status,
      reconnectRequired: account.reconnectRequired,
      scheduledCount: counts.get(account.id) ?? 0,
      // KI-076/ADR-120 — `ConnectedAccountRecord.avatarUrl` opsional (lihat
      // docstring-nya), `SidebarChannelAccount.avatarUrl` WAJIB (UI butuh
      // field yang selalu ada) — `?? null` menormalkan `undefined` (mock
      // lama di domain lain yang belum mengisinya) jadi `null`.
      avatarUrl: account.avatarUrl ?? null,
    }));
  }

  /**
   * Persist urutan channel sidebar personal user (T-012.1). Defensif
   * anti-IDOR: intersect `orderedConnectedAccountIds` dengan akun yang
   * benar-benar milik `workspaceId` ini sebelum persist — id yang tidak
   * valid di-drop diam-diam, pola sama seperti `listMembersWithUser`.
   */
  async saveChannelOrder(
    workspaceId: WorkspaceId,
    userId: UserId,
    orderedConnectedAccountIds: ConnectedAccountId[],
  ): Promise<void> {
    const accounts = await this.repository.listConnectedAccounts(
      workspaceId,
      userId,
    );
    const ownedIds = new Set(accounts.map((account) => account.id));
    const validOrderedIds = Array.from(
      new Set(orderedConnectedAccountIds.filter((id) => ownedIds.has(id))),
    );

    await this.repository.saveChannelOrder({
      workspaceId,
      userId,
      orderedConnectedAccountIds: validOrderedIds,
    });
  }

  /**
   * Daftar anggota workspace tergabung dengan nama/email (T-007.4). Join
   * dilakukan manual (bukan Prisma `include`) karena `WorkspaceMember.userId`
   * tidak punya relasi FK ke `User` — lihat catatan di
   * `IWorkspaceRepository.findUsersByIds`. Anggota yang usernya tidak
   * ditemukan (data korup) dilewati diam-diam, bukan throw — konsisten
   * dengan gaya defensif `listSidebarChannels`.
   */
  async listMembersWithUser(
    workspaceId: WorkspaceId,
    actingUserId: UserId,
  ): Promise<WorkspaceMemberWithUser[]> {
    const members = await this.repository.listMembers(
      workspaceId,
      actingUserId,
    );
    const users = await this.repository.findUsersByIds(
      members.map((member) => member.userId),
    );
    const userById = new Map(users.map((user) => [user.id, user]));

    const result: WorkspaceMemberWithUser[] = [];
    for (const member of members) {
      const user = userById.get(member.userId);
      if (!user) {
        continue;
      }
      result.push({
        id: member.id,
        userId: member.userId,
        name: user.name,
        email: user.email,
        role: member.role,
        status: member.status,
      });
    }
    return result;
  }

  /**
   * Gabungan member asli + undangan pending, siap-render untuk
   * `/settings/members` (T-007.8, ADR-101). Dua sumber digabung sebagai
   * `MemberListRow[]` (union eksplisit, lihat catatan di `types.ts`) — BUKAN
   * invitation dipaksa ke shape `WorkspaceMemberWithUser`. Anggota asli
   * (Active/Removed) ditampilkan lebih dulu, diikuti undangan pending —
   * urutan masing-masing kelompok mengikuti urutan repository-nya sendiri
   * (`joinedAt`/`createdAt` ascending), tidak di-interleave berdasar waktu.
   */
  async listMembersAndPendingInvitations(
    workspaceId: WorkspaceId,
    actingUserId: UserId,
  ): Promise<MemberListRow[]> {
    const [members, pendingInvitations] = await Promise.all([
      this.listMembersWithUser(workspaceId, actingUserId),
      this.repository.listPendingInvitations(workspaceId, actingUserId),
    ]);

    // Dua query di atas tidak atomik (race dengan acceptInvitation) — kalau
    // invitee accept persis di antara kedua read, invitation itu bisa masih
    // kebaca `pending` padahal member Active-nya sudah ada. De-dup by email
    // supaya orang yang sama tidak dobel muncul sebagai member + invitation.
    const activeMemberEmails = new Set(
      members.map((member) => member.email.toLowerCase()),
    );

    return [
      ...members.map((member): MemberListRow => ({ kind: "member", member })),
      ...pendingInvitations
        .filter(
          (invitation) =>
            !activeMemberEmails.has(invitation.email.toLowerCase()),
        )
        .map((invitation): MemberListRow => ({
          kind: "pending-invitation",
          invitation,
        })),
    ];
  }

  /**
   * Batalkan undangan pending (Cancel Invitation, T-007.8, ADR-101 poin 5) —
   * satu-satunya aksi untuk baris virtual Pending (tidak ada "Change Role"
   * untuk baris ini, belum ada member sungguhan untuk diubah rolenya). RBAC
   * SAMA dengan `removeMember`/`inviteMember`, reuse
   * `assertActorCanManageMembers` — bukan RBAC baru.
   */
  async cancelInvitation(
    workspaceId: WorkspaceId,
    actorUserId: UserId,
    invitationId: InvitationId,
  ): Promise<void> {
    await this.assertActorCanManageMembers(
      workspaceId,
      actorUserId,
      "Hanya Owner atau Admin yang bisa membatalkan undangan.",
    );

    await this.repository.revokeInvitation(
      workspaceId,
      invitationId,
      actorUserId,
    );
  }

  /**
   * Gate akses halaman Members (Server Component) — true untuk Owner/Admin
   * aktif, false untuk selainnya (termasuk Creator, yang menurut matrix
   * `roles-permissions.md` "Tidak ada akses" ke Members sama sekali, bukan
   * cuma tombol aksi disembunyikan). Reuse `canActorManageMembers` (core
   * boolean, tanpa exception) supaya tidak perlu try/catch + sentinel
   * string untuk pesan error yang tidak pernah dipakai di jalur ini.
   */
  async canManageMembers(
    workspaceId: WorkspaceId,
    actorUserId: UserId,
  ): Promise<boolean> {
    return this.canActorManageMembers(workspaceId, actorUserId);
  }

  /**
   * Code-review PR #140 finding #5 — satu-satunya sumber kebenaran untuk
   * kondisi "Owner/Admin aktif", dipakai oleh SEMUA gate boolean (`can*`)
   * maupun throwing (`assert*Role`) di bawah. Sebelumnya kondisi yang sama
   * persis (`!!actor && actor.status === Active && (Owner || Admin)`)
   * diduplikasi independen di `canActorManageMembers`,
   * `canManageWorkspaceSettings`, dan `canManageConnectedAccounts` — risiko
   * salah satu lupa diupdate kalau matrix role berubah (mis. role elevated
   * baru ditambah). Pure function, operasi di atas membership yang SUDAH
   * di-fetch caller — tidak melakukan query sendiri.
   *
   * Himpunan role ini (`OWNER_OR_ADMIN_ROLES`, `packages/shared`) adalah
   * satu sumber kebenaran bersama dengan
   * `publishing/rbac.ts#assertActorCanTriggerManualImportSync` (code review
   * PR #148) — sebelumnya dua `Set`/kondisi literal terpisah yang hanya
   * dijaga identik lewat komentar.
   */
  private isOwnerOrAdminActive(actor: WorkspaceMemberRecord | null): boolean {
    return (
      !!actor &&
      actor.status === MemberStatus.Active &&
      OWNER_OR_ADMIN_ROLES.has(actor.role)
    );
  }

  /** Core boolean check — Owner/Admin aktif. Dipakai `canManageMembers` (public, tanpa pesan error) dan `assertActorCanManageMembers` (throwing wrapper, dengan pesan error spesifik per kasus). */
  private async canActorManageMembers(
    workspaceId: WorkspaceId,
    actorUserId: UserId,
  ): Promise<boolean> {
    const actor = await this.getMembership(workspaceId, actorUserId);
    return this.isOwnerOrAdminActive(actor);
  }

  /** Owner/Admin only; dipakai removeMember & updateMemberRole. Reuse `assertActorHasOwnerOrAdminRole` (dedup, bukan gate RBAC baru — code-review PR #140 finding #5). */
  private async assertActorCanManageMembers(
    workspaceId: WorkspaceId,
    actorUserId: UserId,
    actionErrorMessage: string,
  ): Promise<void> {
    await this.assertActorHasOwnerOrAdminRole(
      workspaceId,
      actorUserId,
      actionErrorMessage,
    );
  }

  /**
   * Gate akses halaman Settings General (Server Component) — true untuk
   * Owner/Admin aktif, false untuk selainnya (termasuk Creator, yang menurut
   * matrix `roles-permissions.md` "Tidak ada akses" ke Organization
   * Settings). Pola sama seperti `canManageMembers` (KI-045).
   */
  async canManageWorkspaceSettings(
    workspaceId: WorkspaceId,
    actorUserId: UserId,
  ): Promise<boolean> {
    const actor = await this.getMembership(workspaceId, actorUserId);
    return this.isOwnerOrAdminActive(actor);
  }

  /**
   * Owner/Admin only — gate bersama untuk `assertActorCanManageWorkspaceSettings`
   * (renameWorkspace, Settings General, KI-045) dan
   * `assertActorCanManageConnectedAccounts` (disconnectAccount, T-014.2).
   * Kondisi role-nya identik di kedua area fitur; pesan error tetap
   * spesifik per caller lewat `actionErrorMessage`. Reuse `isOwnerOrAdminActive`
   * supaya kondisi role sama dengan varian boolean (`can*`) — satu sumber
   * kebenaran (code-review PR #140 finding #5).
   */
  private async assertActorHasOwnerOrAdminRole(
    workspaceId: WorkspaceId,
    actorUserId: UserId,
    actionErrorMessage: string,
  ): Promise<void> {
    const actor = await this.assertActiveMembership(workspaceId, actorUserId);
    if (!this.isOwnerOrAdminActive(actor)) {
      throw new AuthorizationError(actionErrorMessage);
    }
  }

  /** Owner/Admin only; dipakai renameWorkspace (Settings General, KI-045). */
  private async assertActorCanManageWorkspaceSettings(
    workspaceId: WorkspaceId,
    actorUserId: UserId,
    actionErrorMessage: string,
  ): Promise<void> {
    await this.assertActorHasOwnerOrAdminRole(
      workspaceId,
      actorUserId,
      actionErrorMessage,
    );
  }

  /** Owner tidak bisa jadi target; dipakai removeMember & updateMemberRole. */
  private async getManageableTarget(
    workspaceId: WorkspaceId,
    targetMemberId: MemberId,
    actingUserId: UserId,
    ownerErrorMessage: string,
  ): Promise<WorkspaceMemberRecord> {
    const target = await this.repository.findMemberById(
      workspaceId,
      targetMemberId,
      actingUserId,
    );
    if (!target) {
      throw new NotFoundError("Anggota tidak ditemukan.");
    }
    if (target.role === MemberRole.Owner) {
      throw new AuthorizationError(ownerErrorMessage);
    }
    return target;
  }

  async removeMember(
    workspaceId: WorkspaceId,
    actorUserId: UserId,
    targetMemberId: MemberId,
  ): Promise<void> {
    await this.assertActorCanManageMembers(
      workspaceId,
      actorUserId,
      "Hanya Owner atau Admin yang bisa menghapus anggota.",
    );
    await this.getManageableTarget(
      workspaceId,
      targetMemberId,
      actorUserId,
      "Owner tidak bisa dihapus dari workspace.",
    );

    await this.repository.removeMember(
      workspaceId,
      targetMemberId,
      actorUserId,
    );
  }

  async updateMemberRole(
    workspaceId: WorkspaceId,
    actorUserId: UserId,
    targetMemberId: MemberId,
    newRole: MemberRole,
  ): Promise<void> {
    if (newRole === MemberRole.Owner) {
      throw new ValidationError(
        "Gunakan alur Transfer Ownership untuk menjadikan anggota sebagai Owner.",
      );
    }

    await this.assertActorCanManageMembers(
      workspaceId,
      actorUserId,
      "Hanya Owner atau Admin yang bisa mengubah role anggota.",
    );
    await this.getManageableTarget(
      workspaceId,
      targetMemberId,
      actorUserId,
      "Role Owner tidak bisa diubah lewat sini.",
    );

    await this.repository.updateMemberRole(
      workspaceId,
      targetMemberId,
      newRole,
      actorUserId,
    );
  }

  /**
   * Jalur **Copy Link** invite member (T-007.1, ADR-080 poin 1 & 3) — generate
   * invitation email-bound + token, TIDAK bergantung pada T-005 (email
   * provider). RBAC sama seperti `removeMember`/`updateMemberRole` (Owner/
   * Admin only, reuse `assertActorCanManageMembers`); role `Owner` ditolak
   * sama seperti `updateMemberRole` (Transfer Ownership adalah alur
   * terpisah). Pengiriman email untuk metode "Kirim via Email" adalah
   * langkah opsional TERPISAH (T-007.7, blocked T-005) yang dipanggil
   * composition root setelah invitation ini dibuat — tidak ada percabangan
   * logic RBAC/token/expiry di sini (ADR-080 poin 3).
   */
  async inviteMember(
    workspaceId: WorkspaceId,
    actorUserId: UserId,
    input: { email: string; role: MemberRole },
  ): Promise<WorkspaceInvitationRecord> {
    if (input.role === MemberRole.Owner) {
      throw new ValidationError(
        "Gunakan alur Transfer Ownership untuk menjadikan anggota sebagai Owner.",
      );
    }

    const email = input.email.trim().toLowerCase();
    if (!email) {
      throw new ValidationError("Email wajib diisi.");
    }
    if (!EMAIL_PATTERN.test(email)) {
      throw new ValidationError("Format email tidak valid.");
    }

    await this.assertActorCanManageMembers(
      workspaceId,
      actorUserId,
      "Hanya Owner atau Admin yang bisa mengundang anggota.",
    );

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(
      Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );

    return this.repository.createInvitation({
      workspaceId,
      email,
      role: input.role,
      invitedByUserId: actorUserId,
      token,
      expiresAt,
    });
  }

  /**
   * Validasi token undangan untuk halaman `/invite/[token]` (T-093.1, ADR-080
   * poin 1 & 6) — dipanggil dari Server Component (RSC boleh memanggil
   * Application Service langsung, AGENTS.md #5), TANPA RBAC actor (invitee
   * belum login/belum jadi member). 3 kondisi invalid/expired/valid:
   * - Token tidak ditemukan, ATAU statusnya bukan lagi `pending`
   *   (sudah `accepted`/`revoked`) → `invalid` (link rusak/dipakai/dibatalkan).
   * - Statusnya masih `pending` tapi `expiresAt` sudah lewat (ADR-072, 7
   *   hari) → `expired`.
   * - Sisanya → `valid`, lengkap dengan nama workspace, nama pengundang, role
   *   (langsung dari invitation, bukan default), email (terkunci di UI), dan
   *   `isExistingUser` (auto-detect via `findUserByEmail` — menentukan form
   *   "Buat Akun Baru" vs "Masuk" yang ditampilkan UI).
   */
  async getInviteToAccept(token: string): Promise<WorkspaceInviteAcceptView> {
    const invitation = await this.repository.findInvitationByToken(token);
    if (!invitation || invitation.status !== InvitationStatus.Pending) {
      return { state: "invalid" };
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      return { state: "expired" };
    }

    // Ketiganya independen — hanya bergantung pada `invitation` yang sudah
    // resolve di atas, bukan satu sama lain — dijalankan paralel (code
    // review PR #95) daripada sequential.
    const [workspace, [inviter], existingUser] = await Promise.all([
      this.repository.findById(invitation.workspaceId),
      this.repository.findUsersByIds([invitation.invitedByUserId]),
      this.repository.findUserByEmail(invitation.email),
    ]);
    if (!workspace) {
      // Data korup (workspace terhapus tapi invitation masih ada) — tidak
      // seharusnya terjadi (cascade delete, database-strategy.md), tapi
      // diperlakukan sebagai link tidak valid daripada melempar 500.
      return { state: "invalid" };
    }

    return {
      state: "valid",
      details: {
        workspaceName: workspace.name,
        invitedByName: inviter?.name ?? "Anggota tim",
        role: invitation.role,
        email: invitation.email,
        isExistingUser: Boolean(existingUser),
      },
    };
  }

  /**
   * Request kode verifikasi OTP untuk accept-invite (T-110.2, KI-053) —
   * HANYA jalur `isExistingUser: false`. Dipanggil `AcceptInviteForm`
   * SEBELUM `authClient.signUp.email` (akun BELUM dibuat di titik ini —
   * beda dari `acceptInvite`, yang selalu dipanggil SETELAH sign-up/in
   * sukses). Re-validasi invitation dari awal (pola sama `acceptInvite`) —
   * token bisa sudah expired/dipakai/dibatalkan di antara render halaman
   * dan submit form Nama+Password.
   *
   * Race condition (dijaga eksplisit sesuai desain task) — kalau email
   * invitation SUDAH punya akun di titik ini (mis. dua tab: satu accept
   * lewat jalur lain, atau orang lain mendaftar duluan dengan email yang
   * sama di antara `getInviteToAccept` dan submit form ini), kode OTP
   * TIDAK dikirim — `isExistingUser` seharusnya sudah `true` dan UI
   * seharusnya menampilkan form Masuk, bukan form ini; kalau tetap
   * sampai di sini berarti state UI stale, ditolak eksplisit dengan pesan
   * jelas daripada diam-diam mengirim kode yang tidak relevan.
   */
  async requestInviteEmailVerification(token: string): Promise<void> {
    const invitation = await this.repository.findInvitationByToken(token);
    if (!invitation || invitation.status !== InvitationStatus.Pending) {
      throw new NotFoundError(
        "Undangan tidak ditemukan atau sudah tidak berlaku.",
      );
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new ValidationError("Undangan ini sudah kedaluwarsa.");
    }

    const existingUser = await this.repository.findUserByEmail(
      invitation.email,
    );
    if (existingUser) {
      throw new ConflictError(
        "Email ini sudah punya akun. Muat ulang halaman dan gunakan alur Masuk.",
      );
    }

    const workspace = await this.repository.findById(invitation.workspaceId);

    const code = generateInviteVerificationCode();
    const expiresAt = new Date(
      Date.now() + INVITE_VERIFICATION_CODE_TTL_MINUTES * 60 * 1000,
    );

    await this.repository.setInvitationVerificationCode(token, {
      codeHash: hashInviteVerificationCode(code),
      expiresAt,
    });

    await this.requireInviteEmailSender().sendInviteVerificationCode({
      email: invitation.email,
      code,
      workspaceName: workspace?.name ?? "workspace ini",
    });
  }

  /**
   * Konfirmasi kode verifikasi OTP untuk accept-invite (T-110.3, KI-053).
   * Guard urutan sebelum mencocokkan kode: invitation masih pending &
   * belum expired (pola sama method lain), lalu ADA kode aktif
   * (`verificationCodeHash`/`verificationCodeExpiresAt` terisi — kalau
   * tidak, invitee belum pernah/tidak sedang meminta kode), belum melebihi
   * batas percobaan, dan kodenya sendiri belum expired. Percobaan SALAH
   * meng-increment `verificationAttempts` (anti brute-force) — percobaan
   * yang sudah diblokir batas TIDAK ikut increment lagi (sudah mentok).
   */
  async confirmInviteEmailVerification(
    token: string,
    code: string,
  ): Promise<void> {
    const invitation = await this.repository.findInvitationByToken(token);
    if (!invitation || invitation.status !== InvitationStatus.Pending) {
      throw new NotFoundError(
        "Undangan tidak ditemukan atau sudah tidak berlaku.",
      );
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new ValidationError("Undangan ini sudah kedaluwarsa.");
    }
    if (
      !invitation.verificationCodeHash ||
      !invitation.verificationCodeExpiresAt
    ) {
      throw new ValidationError(
        'Belum ada kode verifikasi aktif. Klik "Kirim ulang" untuk meminta kode baru.',
      );
    }
    if (invitation.verificationAttempts >= INVITE_VERIFICATION_MAX_ATTEMPTS) {
      throw new ValidationError(
        'Batas percobaan verifikasi tercapai. Klik "Kirim ulang" untuk kode baru.',
      );
    }
    if (invitation.verificationCodeExpiresAt.getTime() < Date.now()) {
      throw new ValidationError(
        'Kode verifikasi sudah kedaluwarsa. Klik "Kirim ulang" untuk kode baru.',
      );
    }

    // Code-review PR #142 finding — reservasi slot percobaan atomic DULU,
    // SEBELUM membandingkan kode (bukan increment belakangan cuma kalau
    // salah seperti sebelumnya). Pengecekan `verificationAttempts` di atas
    // tetap fast-path (hindari round-trip kalau sudah jelas mentok dari
    // baca awal), tapi penegakan SESUNGGUHNYA ada di repository
    // (`UPDATE ... WHERE verification_attempts < max`, atomic) — supaya N
    // request konkuren tidak bisa sama-sama lolos cap dari baca yang sudah
    // basi (race condition yang diperbaiki di sini).
    const attempts =
      await this.repository.incrementInvitationVerificationAttempts(
        token,
        INVITE_VERIFICATION_MAX_ATTEMPTS,
      );
    if (attempts > INVITE_VERIFICATION_MAX_ATTEMPTS) {
      throw new ValidationError(
        'Batas percobaan verifikasi tercapai. Klik "Kirim ulang" untuk kode baru.',
      );
    }

    if (!matchesInviteVerificationCode(code, invitation.verificationCodeHash)) {
      const remaining = Math.max(
        INVITE_VERIFICATION_MAX_ATTEMPTS - attempts,
        0,
      );
      throw new ValidationError(
        remaining > 0
          ? `Kode salah. Sisa ${remaining} percobaan.`
          : 'Kode salah. Batas percobaan tercapai — klik "Kirim ulang" untuk kode baru.',
      );
    }

    await this.repository.markInvitationEmailVerified(token);
  }

  /**
   * Finalisasi accept-invite (T-093.2/.3, ADR-080 poin 6) — dipanggil
   * SETELAH sign-up/sign-in Better Auth berhasil di client (composition
   * root: Server Action `acceptInviteAction`). Re-validasi token dari awal
   * (bukan percaya state yang sudah dibaca `getInviteToAccept` sebelumnya —
   * bisa sudah expired/dipakai orang lain di antara render halaman dan
   * submit) DAN memastikan email akun yang baru sign-up/sign-in **sama
   * persis** dengan `invitation.email` (email-bound, ADR-080 poin 6) —
   * pertahanan defensif kalau composition root suatu saat salah pasang
   * actor email (mis. lewat sesi lain yang aktif di tab yang sama).
   */
  async acceptInvite(input: {
    token: string;
    actorUserId: UserId;
    actorEmail: string;
  }): Promise<{ workspaceId: WorkspaceId; role: MemberRole }> {
    const invitation = await this.repository.findInvitationByToken(input.token);
    if (!invitation) {
      throw new NotFoundError("Undangan tidak ditemukan.");
    }
    if (invitation.status !== InvitationStatus.Pending) {
      throw new ConflictError(
        "Undangan ini sudah pernah dipakai atau dibatalkan.",
      );
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new ValidationError("Undangan ini sudah kedaluwarsa.");
    }
    if (input.actorEmail.trim().toLowerCase() !== invitation.email) {
      throw new AuthorizationError(
        "Email akun Anda tidak cocok dengan email undangan ini.",
      );
    }

    // T-110.3/KI-053 — guard server-side yang TIDAK percaya klaim apa pun
    // dari client (mis. boolean "sudah verifikasi" di body request bisa
    // dipalsukan kalau Server Action dipanggil langsung, bypass UI).
    // `invitation.emailVerifiedAt` murni dari state tersimpan di DB (diisi
    // `confirmInviteEmailVerification` setelah kode OTP benar).
    //
    // Kalau BELUM ada `emailVerifiedAt`, TIDAK otomatis berarti ditolak —
    // jalur existing-user (sign-in, `isExistingUser: true` di
    // `getInviteToAccept`) TIDAK PERNAH melalui OTP sama sekali (KI-053
    // "Scope aman": B tetap butuh password A, gap ini hanya berlaku untuk
    // akun yang belum pernah ada) dan perilakunya SENGAJA tidak diperketat
    // di sini.
    //
    // Sinyal pembeda dipilih SCOPED KE INVITATION INI, BUKAN umur akun
    // (revisi 2026-09-28 — versi awal pakai window umur akun 30 menit,
    // ternyata salah blokir sign-in SAH: user yang baru saja daftar lewat
    // `/register` normal, lalu accept invite LAIN yang tidak terkait dalam
    // 30 menit pertama, ikut tertolak padahal sudah membuktikan
    // kepemilikan lewat password — ditemukan Najwa QA Engineer, T-110 QA).
    //
    // `verificationCodeHash`/`verificationAttempts` pada invitation ini
    // hanya pernah terisi kalau `requestInviteEmailVerification` PERNAH
    // dipanggil untuk token ini secara spesifik — dan UI SELALU memanggil
    // itu sebelum `authClient.signUp.email()` untuk jalur `isExistingUser:
    // false` (lihat `AcceptInviteForm.tsx`). Jadi: kalau invitation ini
    // TIDAK PERNAH tersentuh alur OTP sama sekali, berarti acceptor
    // memakai jalur sign-in yang sah untuk TOKEN INI — diizinkan, apa pun
    // umur akunnya. Kalau alur OTP PERNAH dimulai untuk token ini
    // (hash/attempts pernah terisi) tapi belum pernah dikonfirmasi
    // (`emailVerifiedAt` masih kosong), ini pola serangan KI-053 (coba
    // buat akun baru untuk email undangan, sengaja skip/gagal verifikasi)
    // — ditolak.
    //
    // Residual risk yang SADAR diterima (dikonfirmasi King Rezi): kalau
    // penyerang memanggil Better Auth `signUp` API langsung (bypass total
    // UI ini, TIDAK PERNAH menyentuh `requestInviteEmailVerification` sama
    // sekali untuk token ini), guard ini tidak punya sinyal untuk
    // mendeteksinya. Ini butuh Better Auth hook (`databaseHooks.user
    // .create.before`) untuk ditutup 100% — di luar scope T-110 (kandidat
    // ADR terpisah kalau pola ini mau dipakai ulang). Diterima sebagai
    // trade-off: menutup jalur realistis (siapa pun yang benar-benar
    // memakai UI ini) tanpa false-positive ke user sah, dengan konsekuensi
    // celah sempit untuk penyerang yang secara sengaja meng-craft request
    // API mentah.
    if (
      !invitation.emailVerifiedAt &&
      (invitation.verificationCodeHash !== null ||
        invitation.verificationAttempts > 0)
    ) {
      throw new AuthorizationError(
        "Verifikasi email diperlukan sebelum bergabung ke workspace ini. " +
          "Selesaikan verifikasi kode terlebih dahulu.",
      );
    }

    const member = await this.repository.acceptInvitation({
      workspaceId: invitation.workspaceId,
      invitationId: invitation.id,
      userId: input.actorUserId,
      role: invitation.role,
    });

    return { workspaceId: invitation.workspaceId, role: member.role };
  }

  /**
   * Actor harus member aktif workspace ini, atau lempar `AuthorizationError`.
   * Dipakai `assertActorIsOwner`, `acceptOwnershipTransfer`, dan
   * `renameWorkspace` — satu tempat untuk aturan "aktif" ini, bukan
   * terduplikasi di tiap method.
   */
  private async assertActiveMembership(
    workspaceId: WorkspaceId,
    actorUserId: UserId,
  ): Promise<WorkspaceMemberRecord> {
    const actor = await this.getMembership(workspaceId, actorUserId);
    if (!actor || actor.status !== MemberStatus.Active) {
      throw new AuthorizationError("Anda bukan anggota aktif workspace ini.");
    }
    return actor;
  }

  /** Owner-only, dipakai deleteWorkspace & transferOwnership. */
  private async assertActorIsOwner(
    workspaceId: WorkspaceId,
    actorUserId: UserId,
    actionErrorMessage: string,
  ): Promise<void> {
    const actor = await this.assertActiveMembership(workspaceId, actorUserId);
    if (actor.role !== MemberRole.Owner) {
      throw new AuthorizationError(actionErrorMessage);
    }
  }

  /**
   * Hapus workspace beserta seluruh data terkait (T-008.2, ADR-050). RBAC:
   * Owner saja. Tidak ada state "pending" — satu langkah setelah konfirmasi
   * Tier 1 di sisi UI (beda dengan Transfer Ownership). Cascade mengikuti
   * `ON DELETE CASCADE` per `workspace_id` (`database-strategy.md`) —
   * service ini TIDAK menghapus baris per tabel secara manual.
   */
  async deleteWorkspace(
    workspaceId: WorkspaceId,
    actorUserId: UserId,
  ): Promise<void> {
    await this.assertActorIsOwner(
      workspaceId,
      actorUserId,
      "Hanya Owner yang bisa menghapus workspace.",
    );

    await this.repository.deleteWorkspace(workspaceId, actorUserId);
  }

  /**
   * Single source of truth untuk "siapa yang eligible jadi target Transfer
   * Ownership" (ADR-050: Admin aktif) — dipakai `transferOwnership` untuk
   * validasi DAN `listTransferEligibleMembers` untuk render pilihan di RSC.
   * Sebelumnya aturan ini sempat terduplikasi inline di
   * `(app)/settings/page.tsx`; diekstrak ke sini supaya hanya ada satu
   * tempat yang mendefinisikan kriterianya (code review Ridwan).
   */
  private isTransferEligible(member: {
    role: MemberRole;
    status: MemberStatus;
  }): boolean {
    return (
      member.role === MemberRole.Admin && member.status === MemberStatus.Active
    );
  }

  /**
   * Daftar anggota yang eligible jadi target Transfer Ownership (Admin
   * aktif) — dipakai RSC (`(app)/settings/page.tsx`) untuk render pilihan
   * Selector Danger Zone. Kriteria eligibility sama persis dengan yang
   * divalidasi `transferOwnership` lewat `isTransferEligible`.
   */
  async listTransferEligibleMembers(
    workspaceId: WorkspaceId,
    actorUserId: UserId,
  ): Promise<WorkspaceMemberWithUser[]> {
    const members = await this.listMembersWithUser(workspaceId, actorUserId);
    return members.filter((member) => this.isTransferEligible(member));
  }

  /**
   * Langkah 1 Transfer Ownership (T-008.3, ADR-050) — Owner memicu, target
   * harus Admin aktif di workspace yang sama. Mengisi
   * `pendingOwnerTransferTo`, kirim notifikasi `ownership_transfer_requested`
   * ke target. **Tidak** langsung menukar role.
   */
  async transferOwnership(
    workspaceId: WorkspaceId,
    actorUserId: UserId,
    targetMemberId: MemberId,
  ): Promise<void> {
    await this.assertActorIsOwner(
      workspaceId,
      actorUserId,
      "Hanya Owner yang bisa memulai Transfer Ownership.",
    );

    const target = await this.repository.findMemberById(
      workspaceId,
      targetMemberId,
      actorUserId,
    );
    if (!target) {
      throw new NotFoundError("Anggota tidak ditemukan.");
    }
    if (!this.isTransferEligible(target)) {
      throw new ValidationError(
        "Transfer Ownership hanya bisa ditujukan ke Admin aktif.",
      );
    }

    await this.repository.setPendingOwnerTransfer(
      workspaceId,
      target.userId,
      actorUserId,
    );

    await this.notifications?.notify({
      workspaceId,
      userId: target.userId,
      type: NotificationType.OwnershipTransferRequested,
      title: "Permintaan Transfer Ownership",
      body: "Anda diminta menerima transfer kepemilikan workspace ini.",
      relatedEntityType: "member",
      relatedEntityId: targetMemberId,
    });
  }

  /**
   * Batalkan Transfer Ownership yang masih pending (dibutuhkan UI banner
   * pending — tidak disebut eksplisit sebagai method di
   * `application-layer.md`/ADR-050, ditambahkan konsisten dengan pola
   * method lain: RBAC Owner saja, reset `pendingOwnerTransferTo`).
   */
  async cancelOwnershipTransfer(
    workspaceId: WorkspaceId,
    actorUserId: UserId,
  ): Promise<void> {
    await this.assertActorIsOwner(
      workspaceId,
      actorUserId,
      "Hanya Owner yang bisa membatalkan Transfer Ownership.",
    );

    await this.repository.clearPendingOwnerTransfer(workspaceId, actorUserId);
  }

  /**
   * Langkah 2 Transfer Ownership (T-008.3, ADR-050) — Admin target
   * menerima. RBAC: hanya user yang cocok dengan `pendingOwnerTransferTo`.
   * Role Owner lama dan Admin target bertukar dalam satu transaksi;
   * `pendingOwnerTransferTo` dikosongkan; notifikasi
   * `ownership_transfer_resolved` ke Owner lama.
   */
  async acceptOwnershipTransfer(
    workspaceId: WorkspaceId,
    actorUserId: UserId,
  ): Promise<void> {
    const workspace = await this.repository.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundError("Workspace tidak ditemukan.");
    }
    if (
      !workspace.pendingOwnerTransferTo ||
      workspace.pendingOwnerTransferTo !== actorUserId
    ) {
      throw new AuthorizationError(
        "Tidak ada Transfer Ownership yang ditujukan untuk Anda.",
      );
    }

    const targetMember = await this.assertActiveMembership(
      workspaceId,
      actorUserId,
    );

    const currentOwnerMember = await this.repository.listMembers(
      workspaceId,
      actorUserId,
    );
    const oldOwner = currentOwnerMember.find(
      (candidate) => candidate.role === MemberRole.Owner,
    );
    if (!oldOwner) {
      throw new NotFoundError("Owner saat ini tidak ditemukan.");
    }

    await this.repository.acceptOwnershipTransfer({
      workspaceId,
      currentOwnerMemberId: oldOwner.id,
      targetMemberId: targetMember.id,
      newOwnerUserId: actorUserId,
    });

    await this.notifications?.notify({
      workspaceId,
      userId: oldOwner.userId,
      type: NotificationType.OwnershipTransferResolved,
      title: "Transfer Ownership diterima",
      body: "Kepemilikan workspace ini telah berpindah tangan.",
      relatedEntityType: "member",
      relatedEntityId: targetMember.id,
    });
  }

  /**
   * Disconnect akun terhubung (T-014.2, ADR-048/ADR-049). RBAC: Owner/Admin
   * aktif saja — `roles-permissions.md` § Connected Accounts ("Tambah,
   * hapus, kelola semua akun media sosial" untuk Owner/Admin, "Baca saja"
   * untuk Creator), TIDAK ada perubahan RBAC baru (ADR-048 poin 4), reuse
   * gate Owner/Admin yang sama pola-nya dengan
   * `assertActorCanManageWorkspaceSettings`/`assertActorCanManageMembers`.
   * Dialog konfirmasi Tier 2 (ADR-049, KSP-08-F07) adalah tanggung jawab UI
   * (T-014.3, subtask terpisah, belum dikerjakan sesi ini) — method ini
   * HANYA gate RBAC + eksekusi, dipanggil setelah user mengonfirmasi di
   * client. TIDAK memanggil `OutstandAdapter` — OAuth/access token dikelola
   * Outstand di luar DB internal (catatan T-013), disconnect cukup update
   * status `WorkspaceConnectedAccount` (lihat `IWorkspaceRepository.disconnectAccount`).
   * Post yang sudah terjadwal untuk akun ini SENGAJA tidak disentuh
   * (KSP-D09) — repository method yang dipanggil di sini hanya meng-update
   * tabel `workspace_connected_accounts`, tidak ada cascade ke publishing.
   */
  async disconnectAccount(
    workspaceId: WorkspaceId,
    actorUserId: UserId,
    connectedAccountId: ConnectedAccountId,
  ): Promise<void> {
    await this.assertActorCanManageConnectedAccounts(
      workspaceId,
      actorUserId,
      "Hanya Owner atau Admin yang bisa memutuskan koneksi akun.",
    );

    await this.repository.disconnectAccount(
      workspaceId,
      connectedAccountId,
      actorUserId,
    );
  }

  /**
   * Gate UI aksi mutasi Connect/Disconnect/Reconnect di halaman Connected
   * Accounts (T-109, KI-058) — true untuk Owner/Admin aktif, false untuk
   * Creator. Kondisi role sama dengan `canManageWorkspaceSettings`/
   * `canManageMembers` — ketiganya reuse `isOwnerOrAdminActive` (code-review
   * PR #140 finding #5, sebelumnya diduplikasi independen di tiga tempat),
   * tapi method ini SENGAJA tidak dipakai untuk redirect seluruh halaman
   * seperti dua method itu — matrix
   * `roles-permissions.md` § Connected Accounts memberi Creator "Baca saja"
   * (read-only), bukan "Tidak ada akses" sama sekali. Dipakai Server
   * Component (`connected-accounts/page.tsx`) untuk menentukan apakah
   * tombol Connect/Disconnect/Reconnect dirender di `ConnectedAccountsList`
   * (Client Component) — bukan gate baru, murni mengekspos kondisi yang
   * sudah ditegakkan `assertActorCanManageConnectedAccounts` di bawah
   * sebagai boolean non-throwing supaya bisa dipakai untuk kontrol render.
   */
  async canManageConnectedAccounts(
    workspaceId: WorkspaceId,
    actorUserId: UserId,
  ): Promise<boolean> {
    const actor = await this.getMembership(workspaceId, actorUserId);
    return this.isOwnerOrAdminActive(actor);
  }

  /** Owner/Admin only; dipakai disconnectAccount. Reuse `assertActorHasOwnerOrAdminRole` (dedup, bukan gate RBAC baru). */
  private async assertActorCanManageConnectedAccounts(
    workspaceId: WorkspaceId,
    actorUserId: UserId,
    actionErrorMessage: string,
  ): Promise<void> {
    await this.assertActorHasOwnerOrAdminRole(
      workspaceId,
      actorUserId,
      actionErrorMessage,
    );
  }

  /** Dipakai `initiateConnectAccount`/`completeAccountConnection` — throw jelas kalau composition root lupa menyuplai adapter (pola sama seperti `getOutstandAdapter()` throw-loud ADR-059, bukan silent no-op). */
  private requireOutstandAdapter(): IOutstandAdapter {
    if (!this.outstandAdapter) {
      throw new Error(
        "WorkspaceService: IOutstandAdapter tidak disuplai ke constructor — " +
          "wajib untuk initiateConnectAccount/completeAccountConnection " +
          "(composition root harus memanggil getOutstandAdapter()).",
      );
    }
    return this.outstandAdapter;
  }

  /** Dipakai `requestInviteEmailVerification` — throw jelas kalau composition root lupa menyuplai `InviteEmailSenderPort` (pola sama `requireOutstandAdapter()`). */
  private requireInviteEmailSender(): InviteEmailSenderPort {
    if (!this.inviteEmailSender) {
      throw new Error(
        "WorkspaceService: InviteEmailSenderPort tidak disuplai ke constructor — " +
          "wajib untuk requestInviteEmailVerification (composition root harus " +
          "memanggil createWorkspaceServiceWithInviteEmailSender()).",
      );
    }
    return this.inviteEmailSender;
  }

  /**
   * Connect Account (T-013.1/T-013.2) / Reconnect (T-015.3) — langkah 1
   * (ADR-105): minta `redirectUrl` OAuth dari `OutstandAdapter.connectAccount`.
   * Dipanggil Server Action saat user klik "Connect Account" (`platform`
   * baru, `redirectAccountId` kosong) atau "Reconnect" (`redirectAccountId`
   * diisi — akun `reconnect-required`/`disconnected` existing). RBAC
   * Owner/Admin, reuse gate yang sama dengan `disconnectAccount`
   * (`roles-permissions.md` § Connected Accounts, bukan RBAC baru).
   *
   * Kalau `redirectAccountId` diisi: validasi akun itu memang milik
   * `workspaceId` ini SEBELUM redirect diminta — mencegah user meng-inisiasi
   * "reconnect" untuk id akun workspace LAIN lewat id yang ditebak/ditamper
   * di client (IDOR). Tidak membuat/mengubah `ConnectedAccount` apa pun di
   * sini — itu baru terjadi di `completeAccountConnection` setelah callback.
   */
  async initiateConnectAccount(input: {
    workspaceId: WorkspaceId;
    actorId: UserId;
    platform: SocialPlatform;
    redirectAccountId?: ConnectedAccountId;
  }): Promise<{ redirectUrl: string }> {
    await this.assertActorCanManageConnectedAccounts(
      input.workspaceId,
      input.actorId,
      "Hanya Owner atau Admin yang bisa menghubungkan akun.",
    );

    if (input.redirectAccountId) {
      const existing = await this.repository.findConnectedAccountById(
        input.workspaceId,
        input.redirectAccountId,
        input.actorId,
      );
      if (!existing) {
        throw new NotFoundError("Akun terhubung tidak ditemukan.");
      }
      if (existing.platform !== input.platform) {
        throw new ValidationError(
          "Platform akun tidak cocok dengan akun yang direconnect.",
        );
      }
    }

    return this.requireOutstandAdapter().connectAccount({
      workspaceId: input.workspaceId,
      platform: input.platform,
      redirectAccountId: input.redirectAccountId,
    });
  }

  /**
   * Connect Account (T-013.1/T-013.2) / Reconnect (T-015.3) — langkah 2
   * (ADR-105, redesain ADR-112), dipanggil Route Handler
   * `/api/integrations/outstand/callback` setelah user diarahkan balik
   * dengan `accountId`/`username`/`state` (ADR-112 — Outstand tidak
   * mengirim `code` untuk single-page account, lihat KI-070 untuk
   * Facebook Pages di luar scope).
   *
   * **Keputusan desain CREATE vs UPDATE (Prabowo, T-015.3/T-013.1/2):**
   * `ConnectedAccountData` hasil `resolveConnectCallback` (kontrak
   * ADR-105/ADR-112, TIDAK membawa `redirectAccountId`) — Route Handler
   * yang men-decode `state` (`lib/adapters/outstand/connect-state.ts`,
   * detail wire-format adapter) dan meneruskan `redirectAccountId` di sini
   * sebagai parameter EKSPLISIT, supaya method ini sendiri tetap tidak
   * bergantung pada bentuk `state` (ACL boundary, AGENTS.md #6 — lihat
   * docstring lengkap di `connect-state.ts`).
   *
   * RBAC Owner/Admin ditegakkan LAGI di sini (bukan cuma di
   * `initiateConnectAccount`) — `accountId`/`username`/`state`/
   * `redirectAccountId` round-trip lewat browser (query param publik,
   * bisa ditamper) sebelum callback ini dipanggil, jadi tidak cukup
   * dipercaya dari validasi inisiasi saja. `redirectAccountId`
   * diverifikasi ulang kepemilikannya ke `workspaceId` ini
   * (defense-in-depth yang sama, IDOR).
   *
   * CREATE `WorkspaceConnectedAccount` baru kalau `redirectAccountId`
   * kosong (connect baru, T-013). UPDATE akun existing kalau diisi
   * (reconnect, T-015.3) — `connectedAt` asli DIPERTAHANKAN oleh
   * `IWorkspaceRepository.reconnectAccount` (bukan re-create), sehingga
   * riwayat post yang merujuk `connectedAccountId` yang sama tetap utuh.
   */
  async completeAccountConnection(input: {
    workspaceId: WorkspaceId;
    actorId: UserId;
    accountId: string;
    username: string;
    networkUniqueId?: string;
    state: string;
    redirectAccountId?: ConnectedAccountId;
  }): Promise<ConnectedAccountRecord> {
    await this.assertActorCanManageConnectedAccounts(
      input.workspaceId,
      input.actorId,
      "Hanya Owner atau Admin yang bisa menghubungkan akun.",
    );

    let existingRedirectAccount: ConnectedAccountRecord | null = null;
    if (input.redirectAccountId) {
      existingRedirectAccount = await this.repository.findConnectedAccountById(
        input.workspaceId,
        input.redirectAccountId,
        input.actorId,
      );
      if (!existingRedirectAccount) {
        throw new NotFoundError("Akun terhubung tidak ditemukan.");
      }
    }

    const exchanged =
      await this.requireOutstandAdapter().resolveConnectCallback({
        state: input.state,
        outstandAccountId: input.accountId,
        username: input.username,
        networkUniqueId: input.networkUniqueId,
      });

    if (
      existingRedirectAccount &&
      existingRedirectAccount.platform !== exchanged.platform
    ) {
      throw new ValidationError(
        "Platform akun tidak cocok dengan akun yang direconnect.",
      );
    }

    let record: ConnectedAccountRecord;
    let skipSeeding = false;
    if (input.redirectAccountId) {
      record = await this.repository.reconnectAccount({
        workspaceId: input.workspaceId,
        connectedAccountId: input.redirectAccountId,
        outstandAccountId: exchanged.outstandAccountId,
        handle: exchanged.handle,
        avatarUrl: exchanged.avatarUrl,
        actingUserId: input.actorId,
      });
    } else {
      const result = await this.createOrRecoverConnectedAccount({
        workspaceId: input.workspaceId,
        platform: exchanged.platform,
        outstandAccountId: exchanged.outstandAccountId,
        handle: exchanged.handle,
        avatarUrl: exchanged.avatarUrl,
        actingUserId: input.actorId,
      });
      record = result.record;
      skipSeeding = result.recovered;
    }

    // Temuan #1 (Ridwan) — seed JOB-03 di titik "created/activated" persis
    // sesuai `background-jobs.md` § "Workspace BC → Background Job", untuk
    // KEDUA cabang (create maupun reconnect): dokumen itu menyebut
    // "created/activated", dan reconnect adalah bentuk "activated" untuk
    // akun yang sebelumnya `reconnect-required`/`disconnected`. Gagal
    // seeding TIDAK boleh menggagalkan connect account itu sendiri (akun
    // sudah berhasil dibuat/di-update di atas) — tapi juga tidak boleh
    // gagal diam-diam tanpa jejak, jadi kegagalan tetap dilempar ke atas
    // (caller/`ApplicationError` handling di Route Handler callback tetap
    // konsisten dengan error path lain di sana).
    // `skipSeeding` (code review PR #139) — cabang double-submit recovery
    // TIDAK membuat/mengaktifkan apa pun baru (baris sudah di-seed oleh
    // request asli yang menang create), jadi seed di sini akan jadi job
    // chain kedua yang paralel untuk akun yang sama.
    if (!skipSeeding) {
      await this.engagementSyncSeeder?.onAccountConnected({
        workspaceId: record.workspaceId,
        connectedAccountId: record.id,
        outstandAccountId: record.outstandAccountId,
      });
    }

    // Import Posts dari Social Account (T-090.3, ADR-093 poin 7) —
    // otomatis on-connect, HANYA untuk akun BARU (bukan reconnect/recovery,
    // lihat docstring `ImportPostsAutoTriggerPort`). Best-effort: kegagalan
    // trigger import (mis. Outstand down) TIDAK BOLEH menggagalkan connect
    // account yang sudah berhasil — endpoint ini murni nilai tambah,
    // kegagalannya cukup diam-diam diabaikan di sini (konsisten pola
    // "best-effort" `cancelScheduledPost`/`deletePost` di ACL, tidak ada
    // infra logging terpusat di codebase ini untuk dilaporkan). `skipSeeding`
    // sama alasannya dengan JOB-03 di atas — cabang double-submit recovery
    // tidak menciptakan apa pun baru, jadi tidak perlu trigger import lagi.
    // `!input.redirectAccountId` — code review PR #148: `skipSeeding` sendiri
    // TIDAK cukup, karena tetap `false` di sepanjang cabang reconnect (hanya
    // dipakai utk recovery di cabang create) — tanpa guard ini, triggerAuto
    // (selalu window 90 hari, abaikan watermark) ikut jalan setiap reconnect.
    if (!skipSeeding && !input.redirectAccountId) {
      try {
        await this.importPostsTrigger?.triggerAuto({
          workspaceId: record.workspaceId,
          connectedAccountId: record.id,
          outstandAccountId: record.outstandAccountId,
          platform: record.platform,
          actingUserId: input.actorId,
        });
      } catch {
        // Best-effort — lihat komentar di atas.
      }
    }

    return record;
  }

  /**
   * Wrapper `createConnectedAccount` (KI-079) — membedakan double-submit
   * genuine dari percobaan Connect ke akun yang sudah terhubung dari
   * alur/waktu yang berbeda, setelah `createConnectedAccount` melempar
   * `ConflictError` (unique constraint `[workspaceId, outstandAccountId]`).
   *
   * Sinyalnya `connectedAt` baris yang bentrok, yang TIDAK PERNAH berubah
   * setelah dibuat (`reconnectAccount` sengaja mempertahankannya, lihat
   * docstring method itu) — jadi selalu mencerminkan momen `create`
   * ASLINYA, bukan aktivitas connect/reconnect terakhir. Perbandingan
   * "baru berapa lama" dilakukan `IWorkspaceRepository.
   * isConnectedAccountWithinWindow` di sisi Postgres (`now() -
   * connected_at`), BUKAN `Date.now()` di sini (code review PR #139) —
   * domain ini tidak boleh mengimpor Prisma (rule 6 `AGENTS.md`), dan
   * perbandingan lintas jam app-server vs database rawan drift kalau
   * dihitung di Node:
   * - Baru dibuat dalam `DOUBLE_SUBMIT_RECOVERY_WINDOW_MS` terakhir DAN
   *   masih `status === "active"` (bukan `reconnectRequired`) →
   *   nyaris pasti request susulan dari percobaan connect YANG SAMA
   *   (idempotent) — kembalikan baris yang sudah ada sebagai sukses,
   *   JANGAN lempar error (mencegah toast error palsu di atas toast
   *   sukses dari request asli, pola sama komentar di Route Handler).
   *   Guard status (code review PR #139) — tanpa ini, baris yang
   *   di-disconnect/reconnect-required lagi dalam window yang sama tetap
   *   dilaporkan "sukses" walau datanya sudah tidak aktif (regresi KI-079).
   * - Lebih lama dari itu, atau statusnya bukan `active` → genuinely percobaan connect ke akun yang
   *   sudah pernah terhubung (aktif ATAU disconnected — keduanya sama-sama
   *   menabrak constraint yang sama) dari flow terpisah — lempar
   *   `AlreadyConnectedError` supaya Route Handler bisa memberi tahu user
   *   secara eksplisit, bukan diam-diam "success".
   */
  private async createOrRecoverConnectedAccount(input: {
    workspaceId: WorkspaceId;
    platform: SocialPlatform;
    outstandAccountId: string;
    handle: string;
    avatarUrl?: string | null;
    actingUserId: UserId;
  }): Promise<{ record: ConnectedAccountRecord; recovered: boolean }> {
    try {
      return {
        record: await this.repository.createConnectedAccount(input),
        recovered: false,
      };
    } catch (error) {
      if (!(error instanceof ConflictError)) {
        throw error;
      }

      const existing = await this.repository.findConnectedAccountByOutstandId(
        input.workspaceId,
        input.outstandAccountId,
        input.actingUserId,
      );
      const isRecent =
        existing &&
        (await this.repository.isConnectedAccountWithinWindow(
          existing.id,
          DOUBLE_SUBMIT_RECOVERY_WINDOW_MS,
          input.actingUserId,
        ));
      if (
        existing &&
        existing.status === "active" &&
        !existing.reconnectRequired &&
        isRecent
      ) {
        // `recovered: true` — akun ini sudah di-seed JOB-03 oleh request
        // asli (yang menang create); caller TIDAK boleh seed lagi di sini
        // (code review PR #139 — sebelumnya request kalah ini ikut memanggil
        // `engagementSyncSeeder.onAccountConnected` juga, race dengan
        // request asli menghasilkan 2 job chain paralel untuk 1 akun).
        return { record: existing, recovered: true };
      }

      // Copy generik (code review PR #139) — TIDAK menyebut tombol
      // "Reconnect" di sini. Route Handler callback (`route.ts`) membuang
      // `error.message` ini sepenuhnya dan hanya meneruskan status
      // `?connect=already-connected` — copy yang benar-benar tampil ke user
      // ada di `ConnectedAccountsList.tsx`, bukan string ini. Lihat catatan
      // di sana soal kenapa copy itu juga tidak lagi menyebut Reconnect.
      throw new AlreadyConnectedError(
        "Akun ini sudah terhubung di workspace ini.",
      );
    }
  }

  /**
   * Facebook Pages — list pending Pages (T-025.4, ADR-115, wire-format
   * dikoreksi ADR-116) — dipanggil `listFacebookPendingPagesAction` setelah
   * Route Handler callback redirect ke Connected Accounts dengan
   * `sessionToken` (dialog Page-selection mount, state Loading → Default).
   * RBAC Owner/Admin sama dengan `initiateConnectAccount`/
   * `completeAccountConnection` (gate yang sama, bukan RBAC baru). Tidak
   * ada IDOR check tambahan di sini — belum ada `ConnectedAccount` yang
   * disentuh, murni membaca daftar Page dari Outstand lewat adapter.
   */
  async listFacebookPendingPages(input: {
    workspaceId: WorkspaceId;
    actorId: UserId;
    sessionToken: string;
  }): Promise<FacebookPendingPage[]> {
    await this.assertActorCanManageConnectedAccounts(
      input.workspaceId,
      input.actorId,
      "Hanya Owner atau Admin yang bisa menghubungkan akun.",
    );

    const result = await this.requireOutstandAdapter().listPendingFacebookPages(
      { sessionToken: input.sessionToken },
    );
    return result.pages;
  }

  /**
   * Facebook Pages — confirm selected Pages (T-025.4, ADR-115, wire-format
   * dikoreksi ADR-116) — dipanggil `confirmFacebookPagesConnectionAction`
   * saat user submit dialog Page-selection. RBAC Owner/Admin (gate sama).
   * Validasi `selectedPageIds.length >= 1` diulang di sini (defense-in-depth
   * — UI sudah disable tombol di 0 dipilih, tapi Server Action/adapter
   * tidak boleh dipercaya sendirian).
   *
   * SATU panggilan `IOutstandAdapter.confirmFacebookPagesConnection` untuk
   * SEMUA Page yang dipilih (bukan N panggilan — bentuk endpoint Outstand
   * sendiri, ADR-115 poin 8). Hasilnya disimpan lewat
   * `createConnectedAccounts` dalam SATU transaksi — Page yang sudah
   * terhubung (`outstandAccountId` sama) di-skip, kegagalan di tengah
   * membatalkan seluruh batch. Return value HANYA berisi Page yang
   * BENAR-BENAR baru dibuat.
   *
   * JOB-03 engagement sync seeding (`engagementSyncSeeder?.onAccountConnected`,
   * Temuan #1 Ridwan, pola sama `completeAccountConnection`) dipanggil
   * SEKALI PER Page yang berhasil dibuat.
   *
   * **Reconnect Facebook Page tunggal — DI LUAR SCOPE** (ADR-115 poin 8):
   * method ini SELALU CREATE, tidak menerima `redirectAccountId`.
   *
   * **`avatarUrl` join balik (menutup KI-076, ADR-120)** —
   * `IOutstandAdapter.confirmFacebookPagesConnection` (endpoint
   * `.../finalize`) TIDAK PERNAH membawa foto profil (lihat docstring
   * `ConfirmFacebookPagesResult`). Method ini karena itu memanggil
   * `listPendingFacebookPages` LAGI dengan `sessionToken` yang sama SETELAH
   * finalize (bukan sebelum — finalize adalah langkah kritis, GET avatar
   * ini murni best-effort dan tidak boleh berisiko menunda/mengganggu
   * finalize kalau `sessionToken` ternyata sensitif terhadap urutan/waktu,
   * sesuatu yang belum terverifikasi ke OpenAPI spec resmi Outstand) untuk
   * mendapatkan `FacebookPendingPage.pictureUrl` PER `pageId`, lalu
   * men-join-kan ke `ConnectedAccountData.outstandAccountId` hasil
   * finalize. Kalau sesi sudah tidak valid lagi di titik ini, re-fetch
   * gagal dan avatar cukup kosong (`null`) — sudah ditangani `catch` di
   * bawah, konsisten dengan degradasi best-effort yang sama. Asumsi
   * `pageId === outstandAccountId` (list vs confirm) ini SAMA PERSIS dengan
   * yang sudah dipakai `selectConfirmedFacebookAccounts` di real adapter
   * (irisan pertama, fallback ke tidak ketemu → `avatarUrl: null` — tidak
   * pernah menggagalkan connect).
   */
  async confirmFacebookPagesConnection(input: {
    workspaceId: WorkspaceId;
    actorId: UserId;
    sessionToken: string;
    selectedPageIds: string[];
  }): Promise<ConnectedAccountRecord[]> {
    await this.assertActorCanManageConnectedAccounts(
      input.workspaceId,
      input.actorId,
      "Hanya Owner atau Admin yang bisa menghubungkan akun.",
    );

    if (input.selectedPageIds.length === 0) {
      throw new ValidationError(
        "Pilih minimal satu Page Facebook untuk dihubungkan.",
      );
    }

    const adapter = this.requireOutstandAdapter();

    // Finalize (kritis) dijalankan DULU, sebelum re-fetch avatar best-effort
    // di bawah — supaya request read-only tambahan untuk avatar tidak
    // pernah bisa menunda/mengganggu langkah finalize yang sebenarnya kalau
    // ternyata `sessionToken` Outstand sensitif terhadap urutan/waktu
    // (belum terverifikasi ke OpenAPI spec resmi, lihat catatan di atas).
    const { accounts } = await adapter.confirmFacebookPagesConnection({
      sessionToken: input.sessionToken,
      selectedPageIds: input.selectedPageIds,
    });

    // KI-076/ADR-120 — best-effort, DIJALANKAN SETELAH finalize: kalau
    // re-fetch daftar pending Page gagal (mis. sesi sudah kedaluwarsa
    // setelah finalize mengonsumsinya), avatar cukup kosong (`null`) untuk
    // semua Page — TIDAK boleh menggagalkan proses connect Page yang
    // sebenarnya (finalize di atas sudah selesai lebih dulu).
    let pictureUrlByPageId = new Map<string, string>();
    try {
      const pending = await adapter.listPendingFacebookPages({
        sessionToken: input.sessionToken,
      });
      pictureUrlByPageId = new Map(
        pending.pages
          .filter((page) => typeof page.pictureUrl === "string")
          .map((page) => [page.pageId, page.pictureUrl as string]),
      );
    } catch {
      pictureUrlByPageId = new Map();
    }

    const created = await this.repository.createConnectedAccounts({
      workspaceId: input.workspaceId,
      actingUserId: input.actorId,
      accounts: accounts.map((account) => ({
        platform: account.platform,
        outstandAccountId: account.outstandAccountId,
        handle: account.handle,
        avatarUrl: pictureUrlByPageId.get(account.outstandAccountId) ?? null,
      })),
    });

    for (const record of created) {
      await this.engagementSyncSeeder?.onAccountConnected({
        workspaceId: record.workspaceId,
        connectedAccountId: record.id,
        outstandAccountId: record.outstandAccountId,
      });
    }

    return created;
  }

  /**
   * Pinterest boards (menutup KI-072, sisa scope ADR-114) — daftar board
   * ASLI dari SATU akun Pinterest terhubung, dipakai UI Draft Editor untuk
   * dropdown board per post (bukan text input bebas). Board dipilih PER
   * POST (state Draft Editor, lewat `platformOptions.boardId`), BUKAN
   * dipersist ke `ConnectedAccount` — method ini murni membaca daftar
   * pilihan, tidak menulis apa pun.
   *
   * Anti-IDOR: `connectedAccountId` divalidasi terhadap
   * `listConnectedAccounts` (harus benar-benar milik `workspaceId` ini)
   * SEBELUM `outstandAccountId`-nya diteruskan ke adapter — id yang
   * ditebak/ditamper dari client (mis. milik workspace lain) ditolak
   * `ConflictError`, bukan diam-diam diteruskan. Akun yang bukan Pinterest
   * juga ditolak eksplisit (`ValidationError`) — adapter tidak boleh
   * dipanggil dengan asumsi platform yang salah.
   *
   * Tidak ada RBAC tambahan di luar keanggotaan workspace (pola sama
   * `listConnectedAccounts`/`getConnectedAccountsAction`) — SEMUA member
   * aktif boleh melihat daftar board saat menyusun post, bukan hanya
   * Owner/Admin (beda dari `initiateConnectAccount`/
   * `confirmFacebookPagesConnection` yang mengubah `ConnectedAccount`).
   */
  async listPinterestBoards(input: {
    workspaceId: WorkspaceId;
    actorId: UserId;
    connectedAccountId: ConnectedAccountId;
  }): Promise<PinterestBoard[]> {
    const accounts = await this.repository.listConnectedAccounts(
      input.workspaceId,
      input.actorId,
    );
    const account = accounts.find((acc) => acc.id === input.connectedAccountId);
    if (!account) {
      throw new ConflictError(
        "Akun terhubung tidak ditemukan atau bukan milik workspace ini.",
      );
    }
    if (account.platform !== SocialPlatform.Pinterest) {
      throw new ValidationError(
        "Daftar board Pinterest hanya berlaku untuk akun Pinterest.",
      );
    }

    return this.requireOutstandAdapter().listPinterestBoards(
      account.outstandAccountId,
    );
  }

  /**
   * Ganti nama workspace (T-008.4) — RBAC: Owner/Admin aktif saja (KI-045 —
   * komentar sebelumnya di sini keliru menyatakan "member aktif mana pun",
   * tidak konsisten dengan `roles-permissions.md` yang menyatakan Creator
   * "Tidak ada akses" ke Organization Settings). Reversible/low-stakes,
   * tanpa dialog konfirmasi di UI (beda dengan Danger Zone). Validasi nama
   * reuse aturan yang sama dengan `createWorkspace` (panjang max, tidak
   * boleh kosong) — slug TIDAK ikut berubah di sini.
   */
  async renameWorkspace(
    workspaceId: WorkspaceId,
    actorUserId: UserId,
    name: string,
  ): Promise<WorkspaceRecord> {
    await this.assertActorCanManageWorkspaceSettings(
      workspaceId,
      actorUserId,
      "Anda tidak memiliki akses untuk mengubah pengaturan workspace ini.",
    );

    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new ValidationError("Nama workspace wajib diisi.");
    }
    if (trimmedName.length > MAX_NAME_LENGTH) {
      throw new ValidationError(
        `Nama workspace maksimal ${MAX_NAME_LENGTH} karakter.`,
      );
    }

    return this.repository.renameWorkspace(
      workspaceId,
      trimmedName,
      actorUserId,
    );
  }
}
