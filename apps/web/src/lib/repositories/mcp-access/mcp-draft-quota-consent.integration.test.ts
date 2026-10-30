import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  asMcpGrantId,
  asPostId,
  asUserId,
  asWorkspaceId,
  ContentFormat,
  ContentStatus,
  MemberRole,
  MemberStatus,
  PostCreatedVia,
  SocialPlatform,
  type UserId,
  type WorkspaceId,
} from "@postific/shared";
import {
  McpAccessDeniedError,
  McpAccessService,
  McpConsentService,
  McpInvalidRateLimitInputError,
  McpRateLimitExceededError,
  McpRateLimitService,
  type IMcpGrantRepository,
  type McpGrant,
  type McpRateLimitConfig,
} from "@/domains/mcp-access";
import { MediaService } from "@/domains/media";
import { ComposeDraftUseCase, PublishingService } from "@/domains/publishing";
import { WorkspaceService } from "@/domains/workspace";
import type { Prisma } from "@/generated/prisma/client";
import type { prisma as prismaClient } from "@/lib/prisma/client";
import { ConflictError, ValidationError } from "@/lib/utils/errors";

/**
 * Tes integrasi DB gelombang 1 MCP (T-151, T-152, T-154) di Postgres
 * sungguhan: jalur yang tidak terbukti oleh tes unit karena yang diuji adalah
 * semantik SQL, RLS-context (`withCurrentUser`), CHECK constraint, dan upsert.
 *
 * Opt-in ganda: butuh `DATABASE_URL` sungguhan DAN `MCP_DB_TEST=1`, dan tiga
 * migrasi gelombang 1 (`t152_publishing_posts_created_via`,
 * `t154_mcp_rate_limit_windows`, `t151_mcp_workspace_choices`) sudah
 * diterapkan di DB itu. Tanpa opt-in, seluruh suite ini di-skip.
 *
 * Isolasi data:
 * - Semua fixture (dua workspace, member, akun terhubung, draft, penghitung,
 *   pilihan workspace) memakai suffix acak dan dihapus di `afterAll`; hasil
 *   akhirnya dihitung ulang dan tes GAGAL bila ada sisa.
 * - Tabel `mcp_workspace_choices` tidak punya FK, jadi baris dibersihkan lewat
 *   awalan `session_id`. Purge (`deleteExpired`) bersifat lintas pengguna, jadi
 *   jam yang disuntik sengaja ditaruh di masa lalu jauh (tahun 2000 sampai
 *   2002) supaya hanya baris uji yang tersentuh, bukan baris nyata.
 * - Tidak menyentuh `identity_*`, `mcp_grants`, maupun workspace nyata:
 *   repository grant diganti double di memori untuk tes `authorizeCall`.
 */
const enabled =
  Boolean(process.env.DATABASE_URL) &&
  process.env.SKIP_ENV_VALIDATION !== "1" &&
  process.env.MCP_DB_TEST === "1";

const MIN = 60 * 1000;

describe.skipIf(!enabled)(
  "MCP gelombang 1 (Postgres, T-151/T-152/T-154)",
  () => {
    const suffix = randomUUID().slice(0, 8);
    const prefix = `t-mcp-db-${suffix}`;

    // ---- fixture ids ---------------------------------------------------------
    const owner = asUserId(`${prefix}-owner`); // member aktif A (owner)
    const dual = asUserId(`${prefix}-dual`); // member aktif A dan B
    const memberB = asUserId(`${prefix}-member-b`); // member aktif B saja
    const outsider = asUserId(`${prefix}-outsider`); // bukan member mana pun
    const removed = asUserId(`${prefix}-removed`); // member A berstatus removed
    const pending = asUserId(`${prefix}-pending`); // member A berstatus pending

    let prisma: typeof prismaClient;
    let wsA: WorkspaceId;
    let wsB: WorkspaceId;
    let accountA: string;
    let accountB: string;
    let drafts: ComposeDraftUseCase;
    let workspaceService: WorkspaceService;
    let publishingRepository: typeof import("@/lib/repositories/publishing").publishingRepository;
    let withCurrentUser: typeof import("@/lib/prisma/with-current-user").withCurrentUser;
    let mcpRateLimitRepository: typeof import("./mcp-rate-limit.repository").mcpRateLimitRepository;
    let mcpWorkspaceChoiceRepository: typeof import("./mcp-workspace-choice.repository").mcpWorkspaceChoiceRepository;

    beforeAll(async () => {
      ({ prisma } = await import("@/lib/prisma/client"));
      ({ withCurrentUser } = await import("@/lib/prisma/with-current-user"));
      ({ publishingRepository } =
        await import("@/lib/repositories/publishing"));
      const { workspaceRepository } =
        await import("@/lib/repositories/workspace");
      const { mediaRepository } = await import("@/lib/repositories/media");
      ({ mcpRateLimitRepository } =
        await import("./mcp-rate-limit.repository"));
      ({ mcpWorkspaceChoiceRepository } =
        await import("./mcp-workspace-choice.repository"));

      const a = await prisma.workspace.create({
        data: {
          name: `T-MCP-DB-TEST ${suffix} A`,
          slug: `${prefix}-a`,
          ownerId: owner,
        },
      });
      const b = await prisma.workspace.create({
        data: {
          name: `T-MCP-DB-TEST ${suffix} B`,
          slug: `${prefix}-b`,
          ownerId: memberB,
        },
      });
      wsA = asWorkspaceId(a.id);
      wsB = asWorkspaceId(b.id);

      const now = new Date();
      const member = (
        workspaceId: string,
        userId: string,
        role: MemberRole,
        status: MemberStatus,
      ) => ({ workspaceId, userId, role, status, joinedAt: now });
      await prisma.workspaceMember.createMany({
        data: [
          member(a.id, owner, MemberRole.Owner, MemberStatus.Active),
          member(a.id, dual, MemberRole.Creator, MemberStatus.Active),
          member(a.id, removed, MemberRole.Creator, MemberStatus.Removed),
          member(a.id, pending, MemberRole.Creator, MemberStatus.Pending),
          member(b.id, memberB, MemberRole.Owner, MemberStatus.Active),
          member(b.id, dual, MemberRole.Creator, MemberStatus.Active),
        ],
      });

      // RLS: tabel ini hanya menerima baris workspace milik pengguna aktif.
      const acctA = await withCurrentUser(owner, (tx) =>
        tx.workspaceConnectedAccount.create({
          data: {
            workspaceId: a.id,
            platform: SocialPlatform.Facebook,
            outstandAccountId: `${prefix}-acct-a`,
            handle: `${prefix}-handle-a`,
          },
        }),
      );
      const acctB = await withCurrentUser(memberB, (tx) =>
        tx.workspaceConnectedAccount.create({
          data: {
            workspaceId: b.id,
            platform: SocialPlatform.Facebook,
            outstandAccountId: `${prefix}-acct-b`,
            handle: `${prefix}-handle-b`,
          },
        }),
      );
      accountA = acctA.id;
      accountB = acctB.id;

      // Perakitan produksi (get-mcp-tool-services.ts) tanpa AnalyticsService
      // (tidak dipakai saveDraft/updateDraft) dan tanpa penyimpanan media.
      workspaceService = new WorkspaceService(workspaceRepository);
      drafts = new ComposeDraftUseCase(
        new PublishingService(publishingRepository),
        publishingRepository,
        workspaceService,
        new MediaService(mediaRepository),
      );
    });

    afterAll(async () => {
      if (!prisma) {
        return;
      }
      const ids = [wsA, wsB].filter(Boolean);
      // FK cascade dari workspaces: members, akun, post (+ target), penghitung.
      if (ids.length > 0) {
        await prisma.workspace.deleteMany({ where: { id: { in: ids } } });
      }
      // `mcp_workspace_choices` tanpa FK: hapus lewat awalan session_id.
      await prisma.mcpWorkspaceChoice.deleteMany({
        where: { sessionId: { startsWith: prefix } },
      });

      // Verifikasi data uji benar-benar bersih; gagal keras bila ada sisa.
      const [workspaces, members, accounts, posts, windows, choices] =
        await Promise.all([
          prisma.workspace.count({
            where: { name: { startsWith: `T-MCP-DB-TEST ${suffix}` } },
          }),
          prisma.workspaceMember.count({
            where: { userId: { startsWith: prefix } },
          }),
          prisma.workspaceConnectedAccount.count({
            where: { outstandAccountId: { startsWith: prefix } },
          }),
          prisma.publishingPost.count({
            where: { workspaceId: { in: ids } },
          }),
          prisma.mcpRateLimitWindow.count({
            where: { workspaceId: { in: ids } },
          }),
          prisma.mcpWorkspaceChoice.count({
            where: {
              OR: [
                { sessionId: { startsWith: prefix } },
                { userId: { startsWith: prefix } },
                { workspaceId: { in: ids } },
              ],
            },
          }),
        ]);
      const leftover = {
        workspaces,
        members,
        accounts,
        posts,
        windows,
        choices,
      };
      console.info(`[mcp-db-test ${suffix}] sisa data uji:`, leftover);
      expect(Object.values(leftover).every((count) => count === 0)).toBe(true);
    });

    // =========================================================================
    // T-152 — draft sumber MCP/app lewat ComposeDraftUseCase + repository nyata
    // =========================================================================
    describe("T-152 draft tool (publishing_posts.created_via)", () => {
      const clientId = `${prefix}-client`;

      // RLS: post hanya terlihat dalam konteks anggota workspace-nya.
      const asOwner = <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) =>
        withCurrentUser(owner, fn);
      const rowOf = (postId: string) =>
        asOwner((tx) =>
          tx.publishingPost.findUniqueOrThrow({ where: { id: postId } }),
        );

      it("menyimpan draft sumber mcp dengan created_via='mcp' dan created_via_client_id terisi", async () => {
        const { post, targets } = await drafts.createDraft({
          workspaceId: wsA,
          authorId: owner,
          caption: "Draft dari AI klien",
          targets: [
            {
              connectedAccountId: accountA,
              contentFormat: ContentFormat.Post,
            },
          ],
          source: { createdVia: PostCreatedVia.Mcp, clientId },
        });

        expect(post.createdVia).toBe(PostCreatedVia.Mcp);
        expect(post.createdViaClientId).toBe(clientId);
        expect(post.status).toBe(ContentStatus.Draft);
        expect(targets).toHaveLength(1);

        const row = await rowOf(post.id);
        expect(row.createdVia).toBe("mcp");
        expect(row.createdViaClientId).toBe(clientId);
        expect(row.status).toBe("draft");
        expect(row.workspaceId).toBe(wsA);
        expect(row.authorId).toBe(owner);

        const dbTargets = await asOwner((tx) =>
          tx.publishingPostTarget.findMany({ where: { postId: post.id } }),
        );
        expect(dbTargets).toHaveLength(1);
        expect(dbTargets[0]?.connectedAccountId).toBe(accountA);
        expect(dbTargets[0]?.platform).toBe("facebook");
      });

      it("draft sumber app (eksplisit) tersimpan created_via='app' tanpa client id", async () => {
        const { post } = await drafts.createDraft({
          workspaceId: wsA,
          authorId: owner,
          caption: "Draft dari aplikasi",
          source: { createdVia: PostCreatedVia.App },
        });
        const row = await rowOf(post.id);
        expect(row.createdVia).toBe("app");
        expect(row.createdViaClientId).toBeNull();
      });

      it("draft tanpa source (jalur Draft Editor, repository langsung) default ke 'app' tanpa client id", async () => {
        const post = await publishingRepository.createDraft({
          workspaceId: wsA,
          authorId: owner,
          caption: "Draft tanpa source",
        });
        expect(post.createdVia).toBe(PostCreatedVia.App);
        expect(post.createdViaClientId).toBeNull();
        const row = await rowOf(post.id);
        expect(row.createdVia).toBe("app");
        expect(row.createdViaClientId).toBeNull();
      });

      it("akun dari workspace lain ditolak dan tidak ada draft yang tertulis", async () => {
        const before = await asOwner((tx) =>
          tx.publishingPost.count({ where: { workspaceId: wsA } }),
        );
        await expect(
          drafts.createDraft({
            workspaceId: wsA,
            authorId: owner,
            caption: "Akun workspace lain",
            targets: [
              {
                connectedAccountId: accountB,
                contentFormat: ContentFormat.Post,
              },
            ],
            source: { createdVia: PostCreatedVia.Mcp, clientId },
          }),
        ).rejects.toBeInstanceOf(ValidationError);
        expect(
          await asOwner((tx) =>
            tx.publishingPost.count({ where: { workspaceId: wsA } }),
          ),
        ).toBe(before);
      });

      describe("CHECK constraint publishing_posts_created_via_check (SQL mentah)", () => {
        const CONSTRAINT = "publishing_posts_created_via_check";

        const insertRaw = (via: string, client: string | null) =>
          withCurrentUser(
            owner,
            (tx) =>
              tx.$executeRaw`INSERT INTO publishing_posts (workspace_id, author_id, created_via, created_via_client_id)
              VALUES (${wsA}::uuid, ${owner}, ${via}, ${client}::text)`,
          );

        async function expectCheckViolation(run: Promise<unknown>) {
          const error = await run.then(
            () => null,
            (e: unknown) => e,
          );
          expect(error, "SQL ilegal seharusnya ditolak").not.toBeNull();
          const detail = [
            error instanceof Error ? error.message : String(error),
            JSON.stringify((error as { meta?: unknown }).meta ?? {}),
            String((error as { cause?: unknown }).cause ?? ""),
          ].join(" ");
          expect(detail).toContain(CONSTRAINT);
        }

        it("pasangan sah (mcp+client, app tanpa client) diterima (kontrol positif)", async () => {
          await expect(insertRaw("mcp", `${prefix}-raw`)).resolves.toBe(1);
          await expect(insertRaw("app", null)).resolves.toBe(1);
        });

        it("menolak mcp tanpa client id", async () => {
          await expectCheckViolation(insertRaw("mcp", null));
        });

        it("menolak app dengan client id", async () => {
          await expectCheckViolation(insertRaw("app", `${prefix}-raw`));
        });

        it("menolak nilai created_via di luar app|mcp", async () => {
          await expectCheckViolation(insertRaw("web", null));
        });

        it("menolak UPDATE yang membuat baris mcp kehilangan client id", async () => {
          const { post } = await drafts.createDraft({
            workspaceId: wsA,
            authorId: owner,
            caption: "Akan diubah ilegal",
            source: { createdVia: PostCreatedVia.Mcp, clientId },
          });
          await expectCheckViolation(
            withCurrentUser(
              owner,
              (tx) =>
                tx.$executeRaw`UPDATE publishing_posts SET created_via_client_id = NULL WHERE id = ${post.id}::uuid`,
            ),
          );
          const row = await rowOf(post.id);
          expect(row.createdViaClientId).toBe(clientId);
        });
      });

      describe("update_draft (ComposeDraftUseCase.updateDraft)", () => {
        it("mengubah caption draft dan TIDAK mengubah created_via / client id", async () => {
          const created = await drafts.createDraft({
            workspaceId: wsA,
            authorId: owner,
            caption: "Caption awal MCP",
            targets: [
              {
                connectedAccountId: accountA,
                contentFormat: ContentFormat.Post,
              },
            ],
            source: { createdVia: PostCreatedVia.Mcp, clientId },
          });

          const updated = await drafts.updateDraft({
            workspaceId: wsA,
            postId: created.post.id,
            actingUserId: owner,
            caption: "Caption baru MCP",
          });
          expect(updated.post.caption).toBe("Caption baru MCP");

          const row = await rowOf(created.post.id);
          expect(row.caption).toBe("Caption baru MCP");
          expect(row.status).toBe("draft");
          expect(row.createdVia).toBe("mcp");
          expect(row.createdViaClientId).toBe(clientId);
          // Update parsial: target lama tidak disentuh.
          expect(
            await asOwner((tx) =>
              tx.publishingPostTarget.count({
                where: { postId: created.post.id },
              }),
            ),
          ).toBe(1);
        });

        it("update oleh pengguna app pada draft app tetap 'app', dan pada draft mcp tetap 'mcp'", async () => {
          const appDraft = await drafts.createDraft({
            workspaceId: wsA,
            authorId: owner,
            caption: "Awal app",
            source: { createdVia: PostCreatedVia.App },
          });
          await drafts.updateDraft({
            workspaceId: wsA,
            postId: appDraft.post.id,
            actingUserId: owner,
            caption: "Ubah app",
          });
          const appRow = await rowOf(appDraft.post.id);
          expect(appRow.createdVia).toBe("app");
          expect(appRow.createdViaClientId).toBeNull();

          const mcpDraft = await drafts.createDraft({
            workspaceId: wsA,
            authorId: owner,
            caption: "Awal mcp",
            source: { createdVia: PostCreatedVia.Mcp, clientId },
          });
          // Diubah oleh anggota lain (bukan penulis asli); sumber tetap mcp.
          await drafts.updateDraft({
            workspaceId: wsA,
            postId: mcpDraft.post.id,
            actingUserId: dual,
            caption: "Ubah oleh anggota lain",
          });
          const mcpRow = await rowOf(mcpDraft.post.id);
          expect(mcpRow.caption).toBe("Ubah oleh anggota lain");
          expect(mcpRow.createdVia).toBe("mcp");
          expect(mcpRow.createdViaClientId).toBe(clientId);
        });

        it("menolak post Scheduled dengan ConflictError dan tidak mengubah apa pun", async () => {
          const created = await drafts.createDraft({
            workspaceId: wsA,
            authorId: owner,
            caption: "Akan dijadwalkan",
            source: { createdVia: PostCreatedVia.Mcp, clientId },
          });
          const scheduledAt = new Date(Date.now() + 24 * 60 * MIN);
          await asOwner((tx) =>
            tx.publishingPost.update({
              where: { id: created.post.id },
              data: { status: "scheduled", scheduledAt },
            }),
          );

          await expect(
            drafts.updateDraft({
              workspaceId: wsA,
              postId: created.post.id,
              actingUserId: owner,
              caption: "Tidak boleh berubah",
            }),
          ).rejects.toBeInstanceOf(ConflictError);

          const row = await rowOf(created.post.id);
          expect(row.caption).toBe("Akan dijadwalkan");
          expect(row.status).toBe("scheduled");
          expect(row.createdVia).toBe("mcp");
          expect(row.createdViaClientId).toBe(clientId);
        });

        it("jaring pengaman repository: updateDraftCaption pada post non-Draft mengembalikan null dan tidak menulis", async () => {
          for (const status of ["scheduled", "published", "failed"]) {
            const created = await drafts.createDraft({
              workspaceId: wsA,
              authorId: owner,
              caption: `Awal ${status}`,
              source: { createdVia: PostCreatedVia.Mcp, clientId },
            });
            await asOwner((tx) =>
              tx.publishingPost.update({
                where: { id: created.post.id },
                data: { status },
              }),
            );
            const result = await publishingRepository.updateDraftCaption(
              {
                workspaceId: wsA,
                postId: created.post.id,
                caption: "Tidak boleh berubah",
              },
              owner,
            );
            expect(result, `status ${status}`).toBeNull();
            const row = await rowOf(created.post.id);
            expect(row.caption, `status ${status}`).toBe(`Awal ${status}`);
            expect(row.createdVia, `status ${status}`).toBe("mcp");
          }
        });

        it("post workspace lain atau yang tidak ada tidak ditemukan", async () => {
          const created = await drafts.createDraft({
            workspaceId: wsA,
            authorId: owner,
            caption: "Milik A",
            source: { createdVia: PostCreatedVia.App },
          });
          // Dicari lewat workspace B: tidak boleh bocor/berubah.
          await expect(
            drafts.updateDraft({
              workspaceId: wsB,
              postId: created.post.id,
              actingUserId: memberB,
              caption: "Menyusup",
            }),
          ).rejects.toThrow();
          expect((await rowOf(created.post.id)).caption).toBe("Milik A");

          await expect(
            drafts.updateDraft({
              workspaceId: wsA,
              postId: asPostId(randomUUID()),
              actingUserId: owner,
              caption: "Tidak ada",
            }),
          ).rejects.toThrow();
        });
      });
    });

    // =========================================================================
    // T-154 — McpRateLimitService / McpAccessService dengan repository nyata
    // =========================================================================
    describe("T-154 rate limit (mcp_rate_limit_windows)", () => {
      // Jam di tahun 2000: jendela uji tidak pernah bertabrakan dengan data
      // nyata, dan purge (expires_at < jam) hanya mengenai baris uji.
      const BASE = new Date("2000-01-01T10:00:30.000Z");
      const config: McpRateLimitConfig = {
        calls: 5,
        write_actions: 3,
        scheduled_contents: 4,
      };
      let now = BASE;
      const clock = () => now;

      let service: McpRateLimitService;
      const countOf = async (
        workspaceId: WorkspaceId,
        quota: string,
      ): Promise<number> =>
        (
          await prisma.mcpRateLimitWindow.findMany({
            where: { workspaceId, quota },
          })
        ).reduce((sum, row) => sum + row.count, 0);

      beforeAll(() => {
        service = new McpRateLimitService(
          mcpRateLimitRepository,
          config,
          clock,
        );
      });
      beforeEach(async () => {
        now = BASE;
        await prisma.mcpRateLimitWindow.deleteMany({
          where: { workspaceId: { in: [wsA, wsB] } },
        });
      });

      const context = (
        workspaceId: WorkspaceId,
        requiredScope: "read" | "draft" | "schedule",
      ) => ({
        workspaceId,
        userId: owner,
        clientId: `${prefix}-client`,
        grantId: asMcpGrantId(randomUUID()),
        requiredScope,
      });

      it("consumeQuota all-or-nothing: batch yang tidak muat ditolak utuh dan tidak menaikkan penghitung", async () => {
        await service.consumeQuota(wsA, "scheduled_contents", 3);
        expect(await countOf(wsA, "scheduled_contents")).toBe(3);

        // 3 + 2 > 4: ditolak, penghitung tetap 3 (bukan 4).
        await expect(
          service.consumeQuota(wsA, "scheduled_contents", 2),
        ).rejects.toBeInstanceOf(McpRateLimitExceededError);
        expect(await countOf(wsA, "scheduled_contents")).toBe(3);

        // Sisa satu masih bisa dipakai, lalu penuh.
        await service.consumeQuota(wsA, "scheduled_contents", 1);
        expect(await countOf(wsA, "scheduled_contents")).toBe(4);
        await expect(
          service.consumeQuota(wsA, "scheduled_contents", 1),
        ).rejects.toBeInstanceOf(McpRateLimitExceededError);
        expect(await countOf(wsA, "scheduled_contents")).toBe(4);
      });

      it("error membawa quota, limit, grantId (null untuk consumeQuota) dan retryAfterSeconds sampai akhir jendela", async () => {
        await service.consumeQuota(wsA, "scheduled_contents", 4);
        const error = await service
          .consumeQuota(wsA, "scheduled_contents", 1)
          .then(
            () => null,
            (e: unknown) => e,
          );
        expect(error).toBeInstanceOf(McpRateLimitExceededError);
        const exceeded = error as McpRateLimitExceededError;
        expect(exceeded.quota).toBe("scheduled_contents");
        expect(exceeded.limit).toBe(4);
        expect(exceeded.grantId).toBeNull();
        expect(exceeded.code).toBe("rate_limited");
        // 2000-01-01T10:00:30Z sampai 2000-01-02T00:00:00Z = 13j 59m 30d.
        expect(exceeded.retryAfterSeconds).toBe(13 * 3600 + 59 * 60 + 30);

        // Kuota per menit: jendela 10:00:00-10:01:00, sisa 30 detik.
        for (let i = 0; i < config.calls; i++) {
          await service.assertWithinLimit(context(wsA, "read"));
        }
        const callsError = await service
          .assertWithinLimit(context(wsA, "read"))
          .then(
            () => null,
            (e: unknown) => e,
          );
        expect(callsError).toBeInstanceOf(McpRateLimitExceededError);
        expect((callsError as McpRateLimitExceededError).quota).toBe("calls");
        expect(
          (callsError as McpRateLimitExceededError).retryAfterSeconds,
        ).toBe(30);
        expect(
          (callsError as McpRateLimitExceededError).grantId,
        ).not.toBeNull();
      });

      it("amount tidak valid atau melebihi seluruh batas ditolak tanpa menulis baris", async () => {
        await expect(
          service.consumeQuota(wsA, "scheduled_contents", 5),
        ).rejects.toBeInstanceOf(McpInvalidRateLimitInputError);
        await expect(
          service.consumeQuota(wsA, "scheduled_contents", 0),
        ).rejects.toBeInstanceOf(McpInvalidRateLimitInputError);
        expect(
          await prisma.mcpRateLimitWindow.count({
            where: { workspaceId: wsA },
          }),
        ).toBe(0);
      });

      it("isolasi antar workspace: menghabiskan kuota A tidak mengurangi kuota B", async () => {
        await service.consumeQuota(wsA, "scheduled_contents", 4);
        await expect(
          service.consumeQuota(wsA, "scheduled_contents", 1),
        ).rejects.toBeInstanceOf(McpRateLimitExceededError);

        await expect(
          service.consumeQuota(wsB, "scheduled_contents", 4),
        ).resolves.toBeUndefined();
        expect(await countOf(wsB, "scheduled_contents")).toBe(4);
        expect(await countOf(wsA, "scheduled_contents")).toBe(4);
      });

      it("jendela baru (menit berikutnya) mereset kuota calls", async () => {
        for (let i = 0; i < config.calls; i++) {
          await service.assertWithinLimit(context(wsA, "read"));
        }
        await expect(
          service.assertWithinLimit(context(wsA, "read")),
        ).rejects.toBeInstanceOf(McpRateLimitExceededError);

        now = new Date(BASE.getTime() + MIN);
        await expect(
          service.assertWithinLimit(context(wsA, "read")),
        ).resolves.toBeUndefined();
        expect(
          await prisma.mcpRateLimitWindow.count({
            where: { workspaceId: wsA, quota: "calls" },
          }),
        ).toBe(2); // dua jendela terpisah
      });

      it("konkurensi lewat service: dari 20 consumeQuota paralel tepat `limit` yang lolos", async () => {
        const outcomes = await Promise.allSettled(
          Array.from({ length: 20 }, () =>
            service.consumeQuota(wsA, "scheduled_contents", 1),
          ),
        );
        expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(
          4,
        );
        const rejected = outcomes.filter((o) => o.status === "rejected");
        expect(rejected).toHaveLength(16);
        for (const outcome of rejected) {
          expect(outcome.reason).toBeInstanceOf(McpRateLimitExceededError);
        }
        expect(await countOf(wsA, "scheduled_contents")).toBe(4);
      });

      it("assertWithinLimit: baca hanya menghitung calls; tulis menghitung calls dan write_actions", async () => {
        await service.assertWithinLimit(context(wsA, "read"));
        expect(await countOf(wsA, "calls")).toBe(1);
        expect(await countOf(wsA, "write_actions")).toBe(0);

        await service.assertWithinLimit(context(wsA, "draft"));
        await service.assertWithinLimit(context(wsA, "schedule"));
        expect(await countOf(wsA, "calls")).toBe(3);
        expect(await countOf(wsA, "write_actions")).toBe(2);
      });

      it("penolakan calls tidak menyentuh write_actions; penolakan write_actions tetap meninggalkan hitungan calls", async () => {
        // calls penuh lewat panggilan baca -> panggilan tulis ditolak di calls.
        for (let i = 0; i < config.calls; i++) {
          await service.assertWithinLimit(context(wsA, "read"));
        }
        await expect(
          service.assertWithinLimit(context(wsA, "draft")),
        ).rejects.toMatchObject({ quota: "calls" });
        expect(await countOf(wsA, "calls")).toBe(config.calls);
        expect(await countOf(wsA, "write_actions")).toBe(0);

        // Jendela calls baru; write_actions (per jam) penuh pada panggilan ke-4.
        now = new Date(BASE.getTime() + MIN);
        for (let i = 0; i < config.write_actions; i++) {
          await service.assertWithinLimit(context(wsA, "draft"));
        }
        const error = await service
          .assertWithinLimit(context(wsA, "draft"))
          .then(
            () => null,
            (e: unknown) => e,
          );
        expect(error).toBeInstanceOf(McpRateLimitExceededError);
        expect((error as McpRateLimitExceededError).quota).toBe(
          "write_actions",
        );
        // Jam 10:00-11:00, sekarang 10:01:30 -> 58m 30d.
        expect((error as McpRateLimitExceededError).retryAfterSeconds).toBe(
          58 * 60 + 30,
        );
        expect(await countOf(wsA, "write_actions")).toBe(config.write_actions);
        // calls: 5 (jendela lama) + 3 lolos + 1 yang ditolak write_actions.
        const callsWindow2 = await prisma.mcpRateLimitWindow.findFirstOrThrow({
          where: {
            workspaceId: wsA,
            quota: "calls",
            windowStart: new Date("2000-01-01T10:01:00.000Z"),
          },
        });
        expect(callsWindow2.count).toBe(config.write_actions + 1);
      });

      it("purgeExpired menghapus hanya jendela yang sudah berakhir dan idempoten", async () => {
        await service.consumeQuota(wsA, "scheduled_contents", 1); // hari 2000-01-01
        await service.assertWithinLimit(context(wsA, "read")); // menit 10:00

        // 10:00:30 -> jendela menit (berakhir 10:01) belum lewat di jam ini.
        expect(await service.purgeExpired()).toBe(0);

        now = new Date("2000-01-01T10:05:00.000Z");
        expect(await service.purgeExpired()).toBe(1); // hanya jendela calls
        expect(await countOf(wsA, "calls")).toBe(0);
        expect(await countOf(wsA, "scheduled_contents")).toBe(1);
        expect(await service.purgeExpired()).toBe(0);

        now = new Date("2000-01-02T00:00:01.000Z");
        expect(await service.purgeExpired()).toBe(1);
        expect(
          await prisma.mcpRateLimitWindow.count({
            where: { workspaceId: wsA },
          }),
        ).toBe(0);
      });

      describe("McpAccessService.authorizeCall dengan rate limiter nyata", () => {
        // Repository grant di memori: `mcp_grants` tidak disentuh tes ini.
        const grants: McpGrant[] = [];
        const grantRepository: IMcpGrantRepository = {
          findById: async () => null,
          listActiveByUser: async () => [],
          upsertActive: async () => {
            throw new Error("tidak dipakai");
          },
          findActiveByConnection: async (key) =>
            grants.find(
              (g) =>
                g.revokedAt === null &&
                g.userId === key.userId &&
                g.clientId === key.clientId &&
                g.workspaceId === key.workspaceId,
            ) ?? null,
          touchLastUsed: async () => undefined,
        };
        const unused = () => {
          throw new Error("tidak dipakai");
        };
        let access: McpAccessService;
        const clientId = `${prefix}-client`;

        const grantFor = (
          userId: UserId,
          workspaceId: WorkspaceId,
        ): McpGrant => ({
          id: asMcpGrantId(randomUUID()),
          workspaceId,
          userId,
          clientId,
          clientName: "Klien uji",
          scopes: ["read", "draft"],
          createdAt: BASE,
          lastUsedAt: null,
          revokedAt: null,
        });
        const call = (
          userId: UserId,
          workspaceId: WorkspaceId,
          requiredScope: "read" | "draft" | "schedule",
        ) =>
          access.authorizeCall({
            userId,
            clientId,
            workspaceId,
            tokenScopes: ["read", "draft", "schedule"],
            requiredScope,
          });

        beforeAll(() => {
          grants.push(
            grantFor(owner, wsA),
            grantFor(removed, wsA),
            grantFor(memberB, wsB),
          );
          access = new McpAccessService(
            grantRepository,
            { create: unused, deleteOlderThan: unused },
            { revokeAtomically: unused },
            workspaceService,
            clock,
            service,
          );
        });

        it("batas calls ditegakkan per workspace: panggilan ke-6 ditolak dengan grantId + retryAfterSeconds, dan tidak menaikkan penghitung", async () => {
          const grant = grants[0];
          for (let i = 0; i < config.calls; i++) {
            await expect(call(owner, wsA, "read")).resolves.toMatchObject({
              grantId: grant?.id,
              workspaceId: wsA,
            });
          }
          const error = await call(owner, wsA, "read").then(
            () => null,
            (e: unknown) => e,
          );
          expect(error).toBeInstanceOf(McpRateLimitExceededError);
          expect((error as McpRateLimitExceededError).grantId).toBe(grant?.id);
          expect((error as McpRateLimitExceededError).retryAfterSeconds).toBe(
            30,
          );
          expect(await countOf(wsA, "calls")).toBe(config.calls);

          // Workspace B (grant dan member sendiri) tidak terpengaruh.
          await expect(call(memberB, wsB, "read")).resolves.toMatchObject({
            workspaceId: wsB,
          });
          expect(await countOf(wsB, "calls")).toBe(1);
        });

        it("panggilan yang ditolak otorisasi (scope grant kurang, bukan member aktif) tidak mengonsumsi kuota", async () => {
          await expect(call(owner, wsA, "schedule")).rejects.toMatchObject({
            reason: "grant_scope_insufficient",
          });
          // Grant ada tetapi keanggotaan berstatus removed (dicek di DB nyata).
          const denied = await call(removed, wsA, "read").then(
            () => null,
            (e: unknown) => e,
          );
          expect(denied).toBeInstanceOf(McpAccessDeniedError);
          expect((denied as McpAccessDeniedError).reason).toBe(
            "not_workspace_member",
          );
          // Tanpa grant sama sekali.
          await expect(call(outsider, wsA, "read")).rejects.toMatchObject({
            reason: "no_active_grant",
          });
          expect(await countOf(wsA, "calls")).toBe(0);
          expect(await countOf(wsA, "write_actions")).toBe(0);
        });

        it("consumeQuota dan purgeRateLimitWindows lewat McpAccessService memakai penghitung yang sama", async () => {
          await access.consumeQuota(wsA, "scheduled_contents", 4);
          await expect(
            access.consumeQuota(wsA, "scheduled_contents", 1),
          ).rejects.toBeInstanceOf(McpRateLimitExceededError);
          expect(await countOf(wsA, "scheduled_contents")).toBe(4);

          now = new Date("2000-01-02T00:00:01.000Z");
          await expect(access.purgeRateLimitWindows()).resolves.toEqual({
            deleted: 1,
          });
        });
      });
    });

    // =========================================================================
    // T-151 — McpConsentService dengan repository nyata (mcp_workspace_choices)
    // =========================================================================
    describe("T-151 pilihan workspace (mcp_workspace_choices)", () => {
      // Tahun 2001 (purge di tahun 2002): tidak menyentuh baris nyata.
      const T0 = new Date("2001-01-01T00:00:00.000Z");
      const TTL = 10 * MIN;
      let now = T0;
      let consent: McpConsentService;

      const session = (name: string) => `${prefix}-sess-${name}`;
      const choiceOf = (sessionId: string) =>
        prisma.mcpWorkspaceChoice.findUnique({ where: { sessionId } });

      beforeAll(() => {
        consent = new McpConsentService(
          mcpWorkspaceChoiceRepository,
          { findRegistration: async () => null },
          workspaceService,
          () => now,
        );
      });
      beforeEach(() => {
        now = T0;
      });

      it("chooseWorkspace menyimpan pilihan member aktif dan getActiveWorkspaceId membacanya", async () => {
        const sessionId = session("basic");
        await consent.chooseWorkspace({
          sessionId,
          userId: owner,
          workspaceId: wsA,
        });

        const row = await choiceOf(sessionId);
        expect(row?.userId).toBe(owner);
        expect(row?.workspaceId).toBe(wsA);
        expect(row?.expiresAt.getTime()).toBe(T0.getTime() + TTL);
        expect(await consent.getActiveWorkspaceId(sessionId, owner)).toBe(wsA);
      });

      it("chooseWorkspace menolak non-member, member removed/pending, dan member workspace lain; tidak ada baris tertulis", async () => {
        const cases: [string, UserId, WorkspaceId][] = [
          ["outsider", outsider, wsA],
          ["removed", removed, wsA],
          ["pending", pending, wsA],
          ["member-b-ke-a", memberB, wsA],
        ];
        for (const [name, userId, workspaceId] of cases) {
          const sessionId = session(`deny-${name}`);
          const error = await consent
            .chooseWorkspace({ sessionId, userId, workspaceId })
            .then(
              () => null,
              (e: unknown) => e,
            );
          expect(error, name).toBeInstanceOf(McpAccessDeniedError);
          expect((error as McpAccessDeniedError).reason, name).toBe(
            "not_workspace_member",
          );
          expect(await choiceOf(sessionId), name).toBeNull();
          expect(
            await consent.getActiveWorkspaceId(sessionId, userId),
          ).toBeNull();
        }
      });

      it("pilihan terisolasi per sesi dan per pengguna", async () => {
        const sessionA = session("iso-a");
        const sessionB = session("iso-b");
        await consent.chooseWorkspace({
          sessionId: sessionA,
          userId: owner,
          workspaceId: wsA,
        });
        await consent.chooseWorkspace({
          sessionId: sessionB,
          userId: dual,
          workspaceId: wsB,
        });

        // Sesi yang sama dibaca pengguna lain: null.
        expect(await consent.getActiveWorkspaceId(sessionA, dual)).toBeNull();
        expect(
          await consent.getActiveWorkspaceId(sessionA, outsider),
        ).toBeNull();
        expect(await consent.getActiveWorkspaceId(sessionB, owner)).toBeNull();
        // Sesi lain milik pengguna yang sama (belum memilih): null.
        expect(
          await consent.getActiveWorkspaceId(session("iso-none"), owner),
        ).toBeNull();
        // Pemilik masing-masing membaca pilihannya sendiri.
        expect(await consent.getActiveWorkspaceId(sessionA, owner)).toBe(wsA);
        expect(await consent.getActiveWorkspaceId(sessionB, dual)).toBe(wsB);
      });

      it("kedaluwarsa tepat 10 menit: aktif sebelum, tidak aktif pada dan setelah expires_at", async () => {
        const sessionId = session("ttl");
        await consent.chooseWorkspace({
          sessionId,
          userId: owner,
          workspaceId: wsA,
        });

        now = new Date(T0.getTime() + TTL - 1);
        expect(await consent.getActiveWorkspaceId(sessionId, owner)).toBe(wsA);

        now = new Date(T0.getTime() + TTL);
        expect(await consent.getActiveWorkspaceId(sessionId, owner)).toBeNull();

        now = new Date(T0.getTime() + TTL + 1);
        expect(await consent.getActiveWorkspaceId(sessionId, owner)).toBeNull();
        // Baris kedaluwarsa tidak otomatis hilang (hanya purge yang menghapus).
        expect(await choiceOf(sessionId)).not.toBeNull();

        // Memilih ulang memperbarui masa berlaku dari jam saat itu.
        await consent.chooseWorkspace({
          sessionId,
          userId: owner,
          workspaceId: wsA,
        });
        expect((await choiceOf(sessionId))?.expiresAt.getTime()).toBe(
          now.getTime() + TTL,
        );
        expect(await consent.getActiveWorkspaceId(sessionId, owner)).toBe(wsA);
      });

      it("upsert pada sesi yang sama menimpa workspace dan masa berlaku", async () => {
        const sessionId = session("overwrite");
        await consent.chooseWorkspace({
          sessionId,
          userId: dual,
          workspaceId: wsA,
        });
        now = new Date(T0.getTime() + 3 * MIN);
        await consent.chooseWorkspace({
          sessionId,
          userId: dual,
          workspaceId: wsB,
        });

        expect(
          await prisma.mcpWorkspaceChoice.count({ where: { sessionId } }),
        ).toBe(1);
        const row = await choiceOf(sessionId);
        expect(row?.workspaceId).toBe(wsB);
        expect(row?.userId).toBe(dual);
        expect(row?.expiresAt.getTime()).toBe(now.getTime() + TTL);
        expect(await consent.getActiveWorkspaceId(sessionId, dual)).toBe(wsB);
      });

      it("upsert tidak menimpa userId pemilik baris: pengguna lain tidak bisa mengambil alih sesi", async () => {
        const sessionId = session("takeover");
        await consent.chooseWorkspace({
          sessionId,
          userId: owner,
          workspaceId: wsA,
        });
        // `dual` (member sah A dan B) memakai session_id yang sama.
        await consent.chooseWorkspace({
          sessionId,
          userId: dual,
          workspaceId: wsA,
        });

        const row = await choiceOf(sessionId);
        expect(row?.userId).toBe(owner);
        expect(await consent.getActiveWorkspaceId(sessionId, dual)).toBeNull();
        expect(await consent.getActiveWorkspaceId(sessionId, owner)).toBe(wsA);
      });

      it("listSelectableWorkspaces dan getSelectedWorkspace mengikuti keanggotaan nyata", async () => {
        const listed = await consent.listSelectableWorkspaces(dual);
        const byId = new Map(listed.map((w) => [w.workspaceId, w]));
        expect(byId.get(wsA)).toMatchObject({
          role: MemberRole.Creator,
          connectedAccountCount: 1,
        });
        expect(byId.get(wsB)).toMatchObject({ connectedAccountCount: 1 });
        expect(await consent.listSelectableWorkspaces(outsider)).toEqual([]);

        const sessionId = session("selected");
        await consent.chooseWorkspace({
          sessionId,
          userId: dual,
          workspaceId: wsA,
        });
        expect(await consent.getSelectedWorkspace(sessionId, dual)).toEqual({
          workspaceId: wsA,
          name: `T-MCP-DB-TEST ${suffix} A`,
          role: MemberRole.Creator,
        });

        // Dikeluarkan dari workspace di antara dua langkah: kembali ke langkah 1.
        await withCurrentUser(owner, (tx) =>
          tx.workspaceMember.update({
            where: { workspaceId_userId: { workspaceId: wsA, userId: dual } },
            data: { status: MemberStatus.Removed },
          }),
        );
        expect(await consent.getSelectedWorkspace(sessionId, dual)).toBeNull();
        await withCurrentUser(owner, (tx) =>
          tx.workspaceMember.update({
            where: { workspaceId_userId: { workspaceId: wsA, userId: dual } },
            data: { status: MemberStatus.Active },
          }),
        );
      });

      it("purgeExpiredWorkspaceChoices menghapus yang kedaluwarsa, menyisakan yang aktif, idempoten", async () => {
        // Tahun 2002: jam purge tidak mengenai baris nyata (semua 2026+).
        const P0 = new Date("2002-01-01T00:00:00.000Z");
        const expired = session("purge-expired");
        const alive = session("purge-alive");

        now = P0;
        await consent.chooseWorkspace({
          sessionId: expired,
          userId: owner,
          workspaceId: wsA,
        }); // berakhir P0 + 10m
        now = new Date(P0.getTime() + 20 * MIN);
        await consent.chooseWorkspace({
          sessionId: alive,
          userId: owner,
          workspaceId: wsA,
        }); // berakhir P0 + 30m

        now = new Date(P0.getTime() + 15 * MIN);
        const deleted = await consent.purgeExpiredWorkspaceChoices();
        // Termasuk baris uji tahun 2001 yang sudah kedaluwarsa pada jam ini.
        expect(deleted).toBeGreaterThanOrEqual(1);
        expect(await choiceOf(expired)).toBeNull();
        expect(await choiceOf(alive)).not.toBeNull();
        expect(await consent.getActiveWorkspaceId(alive, owner)).toBe(wsA);

        expect(await consent.purgeExpiredWorkspaceChoices()).toBe(0);

        now = new Date(P0.getTime() + 30 * MIN);
        expect(await consent.purgeExpiredWorkspaceChoices()).toBe(1); // tepat expires_at
        expect(await choiceOf(alive)).toBeNull();
      });
    });
  },
);

describe.skipIf(enabled)(
  "MCP gelombang 1 (Postgres, T-151/T-152/T-154)",
  () => {
    it("skipped: needs a real DATABASE_URL with the T-151/T-152/T-154 migrations applied and MCP_DB_TEST=1", () => {
      expect(true).toBe(true);
    });
  },
);
