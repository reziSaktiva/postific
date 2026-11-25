"use server";

import { asInboxItemId, asUserId } from "@postific/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  EngagementService,
  RefreshInboxUseCase,
  SyncCommentsUseCase,
  type EngagementInboxItemRecord,
  type EngagementReplyRecord,
  type InboxItemStatus,
} from "@/domains/engagement";
import { NotificationService } from "@/domains/notification";
import { WorkspaceService } from "@/domains/workspace";
import { getOutstandAdapter } from "@/lib/adapters/outstand";
import { getCachedSession } from "@/lib/better-auth/session";
import { engagementRepository } from "@/lib/repositories/engagement";
import { notificationRepository } from "@/lib/repositories/notification";
import { publishingRepository } from "@/lib/repositories/publishing";
import { workspaceRepository } from "@/lib/repositories/workspace";
import { toActionError } from "@/lib/utils/errors";
import { createActiveWorkspaceMembersPort } from "@/lib/workspace/active-members-port";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";

/**
 * Manual refresh Comments Inbox (T-052, `background-jobs.md` § JOB-03).
 * Reuse `SyncCommentsUseCase.sync` — logic sync (fetch+upsert+notify) yang
 * SAMA dipakai `EngagementSyncJobHandler` (job periodik 30 menit) — tapi
 * DIPANGGIL LANGSUNG dari sini, tanpa lewat handler, karena refresh manual
 * bukan job periodik: sync sekali untuk seluruh `ConnectedAccount` aktif
 * workspace ini, lalu selesai — TIDAK enqueue job baru/self-reschedule.
 *
 * Data engagement TIDAK memakai Supabase Realtime (ADR-023 membatasinya
 * hanya untuk tabel `notifications`) — ini satu-satunya cara halaman
 * `/engage` bisa dapat data terbaru tanpa menunggu siklus cron.
 *
 * **Refactor (Temuan #2 review Ridwan Architecture Reviewer):** orkestrasi
 * "ambil daftar akun aktif, loop sync tiap akun, akumulasi
 * `newCommentsCount`" sebelumnya ada LANGSUNG di Server Action ini
 * (melanggar AGENTS.md #5 — entry point tanpa business logic). Sekarang
 * dipindahkan ke `RefreshInboxUseCase.refreshAll`
 * (`domains/engagement/services/refresh-inbox.use-case.ts`), pola sama
 * `SyncCommentsUseCase`. Entry point ini murni wiring: resolve
 * workspace/session, rakit dependency konkret (composition root, pola sama
 * `/api/jobs/run/route.ts`) — `WorkspaceService` instance dipassing
 * LANGSUNG sebagai `ConnectedAccountsPort` use-case (structural typing,
 * `listConnectedAccounts` sudah punya shape yang dibutuhkan) — lalu
 * delegasi SATU panggilan ke `refreshAll`. Signature return
 * (`{ error?, newCommentsCount? }`) dan behavior (toast jumlah komentar
 * baru, `revalidatePath("/engage")`) TIDAK berubah dari sebelumnya.
 */
export async function refreshInboxAction(): Promise<{
  error?: string;
  newCommentsCount?: number;
}> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  const userId = asUserId(session.user.id);

  const workspaceService = new WorkspaceService(workspaceRepository);
  const syncCommentsUseCase = new SyncCommentsUseCase(
    engagementRepository,
    getOutstandAdapter(),
    publishingRepository,
    new NotificationService(notificationRepository),
    createActiveWorkspaceMembersPort(),
  );
  const refreshInboxUseCase = new RefreshInboxUseCase(
    syncCommentsUseCase,
    workspaceService,
  );

  try {
    const { newCommentsCount } = await refreshInboxUseCase.refreshAll(
      workspaceId,
      userId,
    );
    revalidatePath("/engage");
    return { newCommentsCount };
  } catch (error) {
    return toActionError(error);
  }
}

/*
 * Pembacaan daftar Engage (komentar dan kelompok posting) tidak lagi lewat
 * Server Action: halaman pertama dari `page.tsx`, halaman berikutnya dari
 * Route Handler GET `/api/engage/*` (T-303, ADR-166 addendum 5, RS-D01).
 */

/**
 * Ubah status satu komentar (T-217). Murni wiring — resolve workspace/
 * session, delegasi ke `EngagementService.changeStatus`, lalu
 * `revalidatePath("/engage")` (pola sama `refreshInboxAction`).
 */
export async function changeInboxItemStatusAction(
  inboxItemId: string,
  status: InboxItemStatus,
): Promise<{ data?: EngagementInboxItemRecord; error?: string }> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  const userId = asUserId(session.user.id);

  const engagementService = new EngagementService(
    engagementRepository,
    getOutstandAdapter(),
    publishingRepository,
    workspaceRepository,
  );

  try {
    const data = await engagementService.changeStatus(
      { workspaceId, inboxItemId: asInboxItemId(inboxItemId), status },
      userId,
    );
    revalidatePath("/engage");
    return { data };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Balas komentar dari dalam aplikasi (T-054, `integration-layer.md`
 * § "Reply via Outstand API", ADR-019/ADR-040, KI-071). Murni wiring —
 * resolve workspace/session (RBAC: seluruh role member aktif workspace boleh
 * membalas, `roles-permissions.md` tidak membedakan akses Engagement per
 * role — tidak ada gating tambahan di sini selain member aktif, pola sama
 * Server Action lain), rakit `EngagementService` dengan `getOutstandAdapter()`
 * + `publishingRepository` (`PublishingPostReferencePort`) +
 * `workspaceRepository` (`ConnectedAccountHandlePort` — lookup handle per
 * id untuk `accountUsername`, KI-071), delegasi ke `EngagementService.reply`
 * (validasi `content` kosong/whitespace-only ada di service, bukan di sini —
 * konsisten dengan `IdentityService.updateProfile`), lalu
 * `revalidatePath("/engage")` (pola sama `changeInboxItemStatusAction`).
 */
export async function replyToCommentAction(
  inboxItemId: string,
  content: string,
): Promise<{ data?: EngagementReplyRecord; error?: string }> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  const userId = asUserId(session.user.id);

  const engagementService = new EngagementService(
    engagementRepository,
    getOutstandAdapter(),
    publishingRepository,
    workspaceRepository,
  );

  try {
    const data = await engagementService.reply(
      { workspaceId, inboxItemId: asInboxItemId(inboxItemId), content },
      userId,
    );
    revalidatePath("/engage");
    return { data };
  } catch (error) {
    return toActionError(error);
  }
}
