import { MemberStatus } from "@postific/shared";
import type { MemberRole, UserId, WorkspaceId } from "@postific/shared";
import { isMcpWorkspaceChoiceActive } from "../entities/mcp-workspace-choice";
import { McpAccessDeniedError } from "../errors";
import type { IMcpClientIdentityRepository } from "../repositories/mcp-client-identity.repository";
import type { IMcpWorkspaceChoiceRepository } from "../repositories/mcp-workspace-choice.repository";
import type { McpClock } from "../types";
import {
  describeMcpClient,
  type McpClientIdentity,
} from "../value-objects/client-identity";

/** Umur pilihan workspace: cukup untuk satu putaran persetujuan, bukan izin jangka panjang. */
export const MCP_WORKSPACE_CHOICE_TTL_MS = 10 * 60 * 1000;

/**
 * Port lokal untuk cross-domain `mcp-access` -> `workspace` (AGENTS.md #5),
 * pola sama `WorkspaceMembershipPort` di `McpAccessService`. Sengaja TIDAK
 * `export`: composition root menyuplai `WorkspaceService`, yang memenuhinya
 * secara struktural; `WorkspaceService` konkret TIDAK boleh diimpor ke sini.
 */
interface WorkspaceDirectoryPort {
  listWorkspacesForUser(
    userId: UserId,
  ): Promise<{ workspaceId: WorkspaceId; name: string; role: MemberRole }[]>;
  findWorkspaceForUser(
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<{
    workspaceId: WorkspaceId;
    name: string;
    role: MemberRole;
  } | null>;
  countActiveConnectedAccountsByWorkspace(
    workspaceIds: WorkspaceId[],
    userId: UserId,
  ): Promise<Map<WorkspaceId, number>>;
  getMembership(
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<{ status: MemberStatus } | null>;
}

/** Satu baris pilihan di langkah 1 (KSP-09-F01). */
export interface McpSelectableWorkspace {
  workspaceId: WorkspaceId;
  name: string;
  role: MemberRole;
  connectedAccountCount: number;
}

/** Workspace terpilih yang ditampilkan di langkah 2 (KSP-09-F02). */
export interface McpSelectedWorkspace {
  workspaceId: WorkspaceId;
  name: string;
  role: MemberRole;
}

/**
 * Layanan layar persetujuan OAuth klien AI (T-151, KSP-09, ADR-139): pilihan
 * workspace per sesi login dan identitas klien. Pembuatan grant tetap di
 * `McpAccessService` (hook consent); service ini tidak memberi izin apa pun,
 * ia hanya menyimpan workspace yang akan menjadi `referenceId` consent.
 *
 * Isolasi: tabel pilihan tidak punya pemisahan per pengguna di DB, jadi
 * setiap baca/tulis membawa `userId` dan pemeriksaan member aktif dilakukan
 * di `chooseWorkspace` (dan diulang `McpAccessService.createGrant`).
 */
export class McpConsentService {
  constructor(
    private readonly choices: IMcpWorkspaceChoiceRepository,
    private readonly clients: IMcpClientIdentityRepository,
    private readonly workspaces: WorkspaceDirectoryPort,
    private readonly clock: McpClock = () => new Date(),
  ) {}

  /** Workspace tempat pengguna menjadi member aktif, beserta jumlah akun terhubung. */
  async listSelectableWorkspaces(
    userId: UserId,
  ): Promise<McpSelectableWorkspace[]> {
    const workspaces = await this.workspaces.listWorkspacesForUser(userId);
    const counts =
      await this.workspaces.countActiveConnectedAccountsByWorkspace(
        workspaces.map((workspace) => workspace.workspaceId),
        userId,
      );
    return workspaces.map((workspace) => ({
      workspaceId: workspace.workspaceId,
      name: workspace.name,
      role: workspace.role,
      connectedAccountCount: counts.get(workspace.workspaceId) ?? 0,
    }));
  }

  /**
   * Simpan workspace pilihan untuk sesi login. Pengguna harus member aktif
   * workspace itu; tanpa itu `McpAccessDeniedError("not_workspace_member")`
   * dan tidak ada yang tertulis. Pilihan lama sesi yang sama ditimpa dan masa
   * berlakunya diperbarui.
   */
  async chooseWorkspace(input: {
    sessionId: string;
    userId: UserId;
    workspaceId: WorkspaceId;
  }): Promise<void> {
    const membership = await this.workspaces.getMembership(
      input.workspaceId,
      input.userId,
    );
    if (!membership || membership.status !== MemberStatus.Active) {
      throw new McpAccessDeniedError("not_workspace_member");
    }

    const now = this.clock();
    await this.choices.upsert({
      sessionId: input.sessionId,
      userId: input.userId,
      workspaceId: input.workspaceId,
      expiresAt: new Date(now.getTime() + MCP_WORKSPACE_CHOICE_TTL_MS),
      createdAt: now,
    });
  }

  /**
   * Id workspace pilihan sesi yang masih berlaku, atau `null` (belum memilih,
   * kedaluwarsa, atau sesi milik pengguna lain). Dipakai plugin OAuth
   * (`shouldRedirect` dan `consentReferenceId`).
   */
  async getActiveWorkspaceId(
    sessionId: string,
    userId: UserId,
  ): Promise<WorkspaceId | null> {
    const now = this.clock();
    const choice = await this.choices.findActive({ sessionId, userId }, now);
    // Repository sudah memfilter `expires_at`; pemeriksaan ulang dan
    // kepemilikan di sini pertahanan berlapis (ADR-141: tanpa RLS per pengguna).
    if (
      !choice ||
      choice.userId !== userId ||
      choice.sessionId !== sessionId ||
      !isMcpWorkspaceChoiceActive(choice, now)
    ) {
      return null;
    }
    return choice.workspaceId;
  }

  /**
   * Workspace pilihan beserta nama dan role-nya untuk langkah 2. `null` bila
   * tidak ada pilihan yang berlaku atau pengguna sudah bukan member aktif
   * workspace itu (mis. dikeluarkan di antara dua langkah): layar lalu
   * mengembalikan pengguna ke langkah 1.
   */
  async getSelectedWorkspace(
    sessionId: string,
    userId: UserId,
  ): Promise<McpSelectedWorkspace | null> {
    const workspaceId = await this.getActiveWorkspaceId(sessionId, userId);
    if (workspaceId === null) {
      return null;
    }
    const selected = await this.workspaces.findWorkspaceForUser(
      workspaceId,
      userId,
    );
    return selected
      ? {
          workspaceId: selected.workspaceId,
          name: selected.name,
          role: selected.role,
        }
      : null;
  }

  /** Identitas klien untuk kedua langkah (KSP-09-F03). Klien tak dikenal tetap menghasilkan identitas yang aman ditampilkan. */
  async describeClient(clientId: string): Promise<McpClientIdentity> {
    return describeMcpClient(await this.clients.findRegistration(clientId));
  }

  /**
   * Hapus pilihan workspace sesi setelah consent berhasil: pilihan terikat satu
   * alur persetujuan, jadi klien lain di sesi yang sama kembali ke langkah 1.
   */
  async clearWorkspaceChoice(sessionId: string, userId: UserId): Promise<void> {
    await this.choices.deleteForSession({ sessionId, userId });
  }

  /** Hapus pilihan kedaluwarsa (JOB-08). Idempoten; mengembalikan jumlah baris terhapus. */
  async purgeExpiredWorkspaceChoices(): Promise<number> {
    return this.choices.deleteExpired(this.clock());
  }
}
