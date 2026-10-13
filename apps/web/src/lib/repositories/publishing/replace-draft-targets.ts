import type { Prisma } from "@/generated/prisma/client";
import type { SchedulePostTargetInput } from "@/domains/publishing/repositories/publishing.repository";
import type { PrismaTransactionClient } from "@/lib/prisma/with-current-user";
import { ValidationError } from "@/lib/utils/errors";

/**
 * KI-060 — ganti seluruh `PublishingPostTarget` sebuah draft.
 * Array kosong menghapus target yang tersimpan. Akun di luar workspace
 * ditolak sebelum ada penghapusan, supaya transaksi pemanggil ikut batal.
 */
export async function replaceDraftTargets(
  tx: PrismaTransactionClient,
  workspaceId: string,
  postId: string,
  targets: SchedulePostTargetInput[],
) {
  const uniqueConnectedAccountIds = Array.from(
    new Set(targets.map((target) => target.connectedAccountId)),
  );
  if (uniqueConnectedAccountIds.length > 0) {
    const ownedAccountCount = await tx.workspaceConnectedAccount.count({
      where: {
        id: { in: uniqueConnectedAccountIds },
        workspaceId,
      },
    });
    if (ownedAccountCount !== uniqueConnectedAccountIds.length) {
      throw new ValidationError(
        "Salah satu akun yang dipilih tidak ditemukan di workspace ini.",
      );
    }
  }

  await tx.publishingPostTarget.deleteMany({ where: { postId } });
  if (targets.length === 0) {
    return;
  }

  await tx.publishingPostTarget.createMany({
    data: targets.map((target) => ({
      postId,
      connectedAccountId: target.connectedAccountId,
      platform: target.platform,
      contentFormat: target.contentFormat,
      platformOptions: (target.platformOptions ?? undefined) as
        Prisma.InputJsonValue | undefined,
      status: "pending",
    })),
  });
}
