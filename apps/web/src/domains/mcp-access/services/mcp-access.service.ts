import { MemberStatus } from "@postific/shared";
import type { McpGrantId, UserId, WorkspaceId } from "@postific/shared";
import {
  isMcpAuditStatus,
  type McpAuditEntry,
} from "../entities/mcp-audit-entry";
import {
  grantMatchesConnection,
  isMcpGrantActive,
  type McpConnectionKey,
  type McpGrant,
} from "../entities/mcp-grant";
import {
  McpAccessDeniedError,
  McpGrantNotFoundError,
  McpInvalidAuditInputError,
  McpInvalidGrantInputError,
} from "../errors";
import type { IMcpAuditRepository } from "../repositories/mcp-audit.repository";
import type { IMcpGrantRepository } from "../repositories/mcp-grant.repository";
import type { IMcpGrantRevocationPort } from "../repositories/mcp-grant-revocation.port";
import type {
  AuthorizeMcpCallInput,
  CreateMcpGrantInput,
  EnsureGrantFromConsentInput,
  McpAuthorizedCall,
  McpClock,
  McpRateLimiter,
  PurgeMcpAuditResult,
  RecordMcpAuditInput,
} from "../types";
import { summarizeToolInput } from "../value-objects/audit-summary";
import { normalizeClientName } from "../value-objects/client-identity";
import type { McpQuotaKind } from "../value-objects/rate-limit";
import {
  isMcpScope,
  normalizeMcpScopes,
  parseMcpWireScopes,
  scopesInclude,
} from "../value-objects/mcp-scope";

/** Retensi audit panggilan MCP (S-001, ADR-138): 90 hari, dihapus JOB-08. */
export const MCP_AUDIT_RETENTION_DAYS = 90;

/** `last_used_at` diperbarui paling cepat sekali per menit per grant. */
export const MCP_LAST_USED_THROTTLE_MS = 60_000;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const TOOL_NAME_MAX_LENGTH = 100;
const ERROR_CODE_MAX_LENGTH = 100;
const TARGET_ID_MAX_LENGTH = 200;

/**
 * Port lokal untuk cross-domain `mcp-access` -> `workspace` (cek member
 * aktif; AGENTS.md #7) — pola sama `ActiveAccountsPort` di `AnalyticsService`.
 * Sengaja TIDAK `export`: composition root cukup menyuplai instance yang
 * cocok secara struktural (`WorkspaceService.getMembership` memenuhinya,
 * return `WorkspaceMemberRecord` adalah superset). `WorkspaceService`
 * konkret TIDAK boleh diimpor ke file ini.
 */
interface WorkspaceMembershipPort {
  getMembership(
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<{ status: MemberStatus } | null>;
}

/**
 * `McpAccessService` (BC-04) — izin, jejak audit, dan titik sambung rate
 * limit untuk akses AI lewat MCP. `mcp_grants` adalah sumber otorisasi
 * (keputusan King Rezi 2026-10-26); aturan lengkap di `application-layer.md`
 * § McpAccessService.
 *
 * Service ini TIDAK memanggil BC-03/05/06/08: pemanggilan service domain
 * lain dilakukan handler tool MCP (entry point). Dependensinya hanya
 * repository BC-04, port pencabutan, dan port keanggotaan workspace.
 *
 * Tabel BC-04 tidak punya safety net RLS per pengguna/workspace (ADR-141),
 * jadi isolasi hidup di sini dan di filter repository.
 */
export class McpAccessService {
  constructor(
    private readonly grants: IMcpGrantRepository,
    private readonly audit: IMcpAuditRepository,
    private readonly revocation: IMcpGrantRevocationPort,
    private readonly memberships: WorkspaceMembershipPort,
    private readonly clock: McpClock = () => new Date(),
    private readonly rateLimit?: McpRateLimiter,
  ) {}

  /**
   * T-157 — peta `clientId -> clientName` untuk badge sumber MCP di
   * History/Drafts/Queue. Grant yang sudah dicabut ikut dihitung. Read-only;
   * pemanggil (composition root halaman) sudah memverifikasi keanggotaan
   * workspace. Klien tanpa nama tidak ada di peta.
   */
  async getClientNames(
    workspaceId: WorkspaceId,
    clientIds: string[],
  ): Promise<Map<string, string>> {
    const unique = [...new Set(clientIds.filter((id) => id !== ""))];
    return this.grants.findClientNames(workspaceId, unique);
  }

  /**
   * Buat grant untuk (pengguna, klien, workspace) dengan scope terpilih, atau
   * perbarui `scopes` grant aktif yang sudah ada (satu grant aktif per
   * koneksi, indeks unik parsial). Idempoten untuk input yang sama.
   *
   * RBAC: pengguna harus member aktif workspace; tanpa itu
   * `McpAccessDeniedError("not_workspace_member")`. Scope kosong atau
   * `clientId` kosong ditolak `McpInvalidGrantInputError` (grant tanpa izin
   * tidak bermakna dan fail closed lebih aman).
   */
  async createGrant(input: CreateMcpGrantInput): Promise<McpGrant> {
    // Disimpan apa adanya (tanpa trim): `authorizeCall` mencari dengan `azp`
    // token mentah, jadi kedua sisi harus memakai nilai yang sama.
    const clientId = input.clientId;
    if (clientId.trim() === "") {
      throw new McpInvalidGrantInputError("clientId grant tidak boleh kosong");
    }
    const scopes = normalizeMcpScopes(input.scopes);
    if (scopes.length === 0) {
      throw new McpInvalidGrantInputError(
        "Grant harus memuat minimal satu scope MCP",
      );
    }

    await this.assertActiveMember(input.workspaceId, input.userId);

    return this.grants.upsertActive({
      workspaceId: input.workspaceId,
      userId: input.userId,
      clientId,
      clientName: normalizeClientName(input.clientName),
      scopes,
      createdAt: this.clock(),
    });
  }

  /**
   * "Pastikan grant dari consent" (syarat T-149.2): dipanggil hook consent
   * plugin dan saat pengguna menyambung ulang. Mengubah scope kabel consent
   * (`mcp:read`, ...; scope non-MCP seperti `openid` dibuang) menjadi grant
   * lewat `createGrant`, jadi idempoten: consent yang sama berkali-kali tetap
   * satu grant aktif, dan consent terbaru menyempitkan atau melebarkan
   * `scopes` grant itu. Consent tanpa scope MCP ditolak (fail closed).
   */
  async ensureGrantFromConsent(
    input: EnsureGrantFromConsentInput,
  ): Promise<McpGrant> {
    return this.createGrant({
      workspaceId: input.workspaceId,
      userId: input.userId,
      clientId: input.clientId,
      clientName: input.clientName,
      scopes: parseMcpWireScopes(input.consentScopes),
    });
  }

  /**
   * Cabut koneksi klien AI milik `actingUserId` (Server Action Settings).
   * Menandai `revoked_at` DAN menghapus consent + refresh token plugin dalam
   * satu transaksi lewat `IMcpGrantRevocationPort`.
   *
   * Grant yang tidak ada atau milik pengguna lain: `McpGrantNotFoundError`
   * (tidak dibedakan, supaya keberadaan grant orang lain tidak bocor).
   * Repository sudah memfilter `user_id`; pemeriksaan pemilik di sini
   * pertahanan berlapis.
   * Grant yang sudah dicabut: tidak error dan tidak menyentuh apa pun
   * (idempoten) — termasuk tidak menghapus consent koneksi baru yang dibuat
   * setelah pencabutan itu.
   */
  async revokeGrant(grantId: McpGrantId, actingUserId: UserId): Promise<void> {
    const grant = await this.grants.findById(grantId, actingUserId);
    if (!grant || grant.userId !== actingUserId) {
      throw new McpGrantNotFoundError();
    }
    await this.revokeIfActive(grant);
  }

  /**
   * Cabut grant aktif suatu koneksi bila ada; tidak melakukan apa-apa bila
   * tidak ada. Untuk jalur sistem yang hanya tahu kunci koneksi (hook
   * `/oauth2/delete-consent`: consent diidentifikasi klien, pengguna, dan
   * `referenceId`, bukan id grant), dengan semantik pencabutan yang sama.
   */
  async revokeGrantForConnection(key: McpConnectionKey): Promise<void> {
    const grant = await this.grants.findActiveByConnection(key);
    if (!grant || !grantMatchesConnection(grant, key)) {
      return;
    }
    await this.revokeIfActive(grant);
  }

  /**
   * Grant AKTIF milik `userId` lintas workspace (Settings → Klien AI). Hanya
   * milik sendiri: baris pengguna lain tidak pernah lolos, bahkan bila
   * repository salah mengembalikannya.
   */
  async listGrants(userId: UserId): Promise<McpGrant[]> {
    const grants = await this.grants.listActiveByUser(userId);
    return grants.filter(
      (grant) => grant.userId === userId && isMcpGrantActive(grant),
    );
  }

  /**
   * Otorisasi satu panggilan tool MCP, fail closed. Dipanggil setelah
   * `mcpHandler` memvalidasi token (tanda tangan, `iss`, `aud`, kedaluwarsa).
   * Urutan, berhenti di kegagalan pertama (error, bukan data kosong):
   *
   * 1. Grant aktif untuk (pengguna, klien, workspace) -> `no_active_grant`.
   * 2. `requiredScope` ada di scope token -> `token_scope_insufficient`, lalu
   *    di scope grant di DB -> `grant_scope_insufficient`.
   * 3. Pengguna member aktif workspace -> `not_workspace_member`. Tanpa
   *    pembatasan role di MVP.
   * 4. Rate limit workspace (T-154): `McpRateLimitExceededError` bila kuota
   *    `calls` (dan `write_actions` untuk scope tulis) terlampaui. Hanya
   *    panggilan yang sudah lolos 1-3 yang dihitung, jadi klien yang dicabut
   *    atau tanpa scope tidak menghabiskan kuota workspace.
   *
   * `last_used_at` diperbarui hanya setelah semuanya lolos, paling cepat
   * sekali per menit. Penolakan TIDAK dicatat di sini: handler memanggil
   * `recordAudit` dengan `status = "denied"` memakai `error.grantId` dan
   * `error.code`, karena hanya handler yang tahu nama tool dan argumennya.
   */
  async authorizeCall(
    input: AuthorizeMcpCallInput,
  ): Promise<McpAuthorizedCall> {
    const key: McpConnectionKey = {
      userId: input.userId,
      clientId: input.clientId,
      workspaceId: input.workspaceId,
    };

    // Grant dan keanggotaan independen: dibaca paralel, tetapi keputusan tetap
    // berurutan di bawah (grant dulu) supaya alasan penolakan tidak berubah.
    const [grant, membership] = await Promise.all([
      this.grants.findActiveByConnection(key),
      this.memberships.getMembership(input.workspaceId, input.userId),
    ]);
    if (
      !grant ||
      !isMcpGrantActive(grant) ||
      !grantMatchesConnection(grant, key)
    ) {
      throw new McpAccessDeniedError("no_active_grant");
    }

    if (!scopesInclude(input.tokenScopes, input.requiredScope)) {
      throw new McpAccessDeniedError("token_scope_insufficient", grant.id);
    }
    if (!scopesInclude(grant.scopes, input.requiredScope)) {
      throw new McpAccessDeniedError("grant_scope_insufficient", grant.id);
    }

    if (!membership || membership.status !== MemberStatus.Active) {
      throw new McpAccessDeniedError("not_workspace_member", grant.id);
    }

    await this.rateLimit?.assertWithinLimit({
      workspaceId: input.workspaceId,
      userId: input.userId,
      clientId: input.clientId,
      grantId: grant.id,
      requiredScope: input.requiredScope,
    });

    const now = this.clock();
    if (
      grant.lastUsedAt === null ||
      now.getTime() - grant.lastUsedAt.getTime() >= MCP_LAST_USED_THROTTLE_MS
    ) {
      await this.grants.touchLastUsed(grant.id, key, now);
    }

    return {
      grantId: grant.id,
      userId: grant.userId,
      workspaceId: grant.workspaceId,
      clientId: grant.clientId,
      clientName: grant.clientName,
      grantScopes: grant.scopes,
    };
  }

  /**
   * Tulis satu baris `McpAuditLog` per panggilan (berhasil, ditolak, atau
   * error). Argumen mentah tool disamarkan di sini (`summarizeToolInput`):
   * caption penuh dan URL berparameter rahasia tidak pernah sampai ke
   * repository.
   *
   * `scope` dan `status` divalidasi saat runtime (nilai dari batas sistem
   * tidak dipercaya tipe saja): di luar `read | draft | schedule` atau
   * `success | denied | error` melempar `McpInvalidAuditInputError`, tidak
   * ada baris tertulis.
   *
   * Kontrak untuk handler tool MCP (T-150): panggilan yang ditolak untuk
   * workspace yang sudah dihapus bisa membuat repository audit melempar
   * error FK (`workspace_id`), dan `recordAudit` bisa gagal karena sebab lain
   * (DB, validasi di atas). Handler HARUS menangkap kegagalan `recordAudit`
   * (catat ke log server) supaya penolakan tidak berubah menjadi HTTP 500,
   * dan kegagalan audit TIDAK BOLEH mengubah keputusan otorisasi: panggilan
   * yang ditolak tetap ditolak, panggilan yang lolos tidak dibatalkan
   * karena audit gagal ditulis.
   */
  async recordAudit(input: RecordMcpAuditInput): Promise<McpAuditEntry> {
    if (!isMcpScope(input.scope)) {
      throw new McpInvalidAuditInputError(
        "scope audit harus salah satu dari read, draft, schedule",
      );
    }
    if (!isMcpAuditStatus(input.status)) {
      throw new McpInvalidAuditInputError(
        "status audit harus salah satu dari success, denied, error",
      );
    }

    return this.audit.create({
      workspaceId: input.workspaceId,
      userId: input.userId,
      grantId: input.grantId ?? null,
      clientId: input.clientId,
      toolName: input.toolName.slice(0, TOOL_NAME_MAX_LENGTH),
      scope: input.scope,
      inputSummary: summarizeToolInput(input.toolInput),
      status: input.status,
      errorCode: input.errorCode
        ? input.errorCode.slice(0, ERROR_CODE_MAX_LENGTH)
        : null,
      durationMs: normalizeDuration(input.durationMs),
      targetId: input.targetId
        ? input.targetId.slice(0, TARGET_ID_MAX_LENGTH)
        : null,
      createdAt: this.clock(),
    });
  }

  /**
   * Hapus audit yang lebih tua dari `MCP_AUDIT_RETENTION_DAYS` hari (JOB-08).
   * Idempoten: run kedua tanpa baris kedaluwarsa menghapus 0.
   */
  async purgeAudit(): Promise<PurgeMcpAuditResult> {
    const cutoff = new Date(
      this.clock().getTime() - MCP_AUDIT_RETENTION_DAYS * MS_PER_DAY,
    );
    const deleted = await this.audit.deleteOlderThan(cutoff);
    return { deleted, cutoff };
  }

  /**
   * Konsumsi kuota workspace dari tool (T-153: `scheduled_contents` per
   * konten yang dijadwalkan). All-or-nothing; melempar
   * `McpRateLimitExceededError` (dengan `retryAfterSeconds`) bila melebihi
   * batas. Tanpa rate limiter terpasang, tidak membatasi (sama seperti hook).
   */
  async consumeQuota(
    workspaceId: WorkspaceId,
    quota: McpQuotaKind,
    amount = 1,
  ): Promise<void> {
    await this.rateLimit?.consumeQuota(workspaceId, quota, amount);
  }

  /**
   * Hapus jendela rate limit kedaluwarsa (bagian JOB-08, bersama
   * `purgeAudit`; tanpa cron baru). Idempoten.
   */
  async purgeRateLimitWindows(): Promise<{ deleted: number }> {
    return { deleted: (await this.rateLimit?.purgeExpired()) ?? 0 };
  }

  private async revokeIfActive(grant: McpGrant): Promise<void> {
    if (!isMcpGrantActive(grant)) {
      return;
    }
    await this.revocation.revokeAtomically({
      grantId: grant.id,
      userId: grant.userId,
      clientId: grant.clientId,
      workspaceId: grant.workspaceId,
      revokedAt: this.clock(),
    });
  }

  private async assertActiveMember(
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<void> {
    const membership = await this.memberships.getMembership(
      workspaceId,
      userId,
    );
    if (!membership || membership.status !== MemberStatus.Active) {
      throw new McpAccessDeniedError("not_workspace_member");
    }
  }
}

function normalizeDuration(
  durationMs: number | null | undefined,
): number | null {
  if (durationMs === null || durationMs === undefined) {
    return null;
  }
  return Number.isFinite(durationMs)
    ? Math.max(0, Math.round(durationMs))
    : null;
}
