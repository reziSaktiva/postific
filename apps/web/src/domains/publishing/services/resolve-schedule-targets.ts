import { asConnectedAccountId, ContentFormat } from "@postific/shared";
import type { ConnectedAccountRecord } from "@/domains/workspace";
import { ValidationError } from "@/lib/utils/errors";
import { assertContentFormatAllowed } from "../content-format-matrix";
import type { SchedulePostsTargetInput } from "./schedule-posts.use-case";

export interface ScheduleTargetRequest {
  connectedAccountId: string;
  contentFormat: string;
  platformOptions?: Record<string, unknown>;
}

const CONTENT_FORMAT_VALUES: ReadonlySet<string> = new Set(
  Object.values(ContentFormat),
);

/**
 * Cocokkan target request dari client (connectedAccountId sebagai string
 * mentah, belum tentu valid) dengan daftar akun terhubung workspace yang
 * sudah di-resolve dari DB (`WorkspaceService.listConnectedAccounts`).
 * Melempar `ValidationError` kalau ada connectedAccountId yang tidak
 * ditemukan di daftar tersebut, atau `PublishingDomainError` kalau
 * `contentFormat` bukan value `ContentFormat` yang valid / tidak diizinkan
 * untuk platform akun tersebut (`assertContentFormatAllowed`, ADR-039).
 *
 * Validasi format dilakukan di sini — bukan hanya digantungkan ke
 * `SchedulePostsUseCase.execute` — supaya fungsi ini tetap aman dipakai
 * berdiri sendiri oleh entry point lain (mis. Route Handler mobile
 * `/api/v1`) tanpa wajib mengingat memanggil use-case sesudahnya.
 *
 * Dipisah dari Server Action (`scheduleDraftAction`) supaya business rule
 * ini bisa dipakai ulang oleh entry point lain tanpa duplikasi — temuan
 * review Ridwan Architecture Reviewer, ADR-059 follow-up.
 */
export function resolveScheduleTargets(
  connectedAccounts: ConnectedAccountRecord[],
  requests: ScheduleTargetRequest[],
): SchedulePostsTargetInput[] {
  const connectedAccountById = new Map(
    connectedAccounts.map((account) => [account.id, account]),
  );

  return requests.map((request) => {
    const account = connectedAccountById.get(
      asConnectedAccountId(request.connectedAccountId),
    );
    if (!account) {
      throw new ValidationError(
        "Salah satu akun yang dipilih tidak ditemukan di daftar akun terhubung workspace ini.",
      );
    }

    if (!CONTENT_FORMAT_VALUES.has(request.contentFormat)) {
      throw new ValidationError(
        `Content format "${request.contentFormat}" tidak dikenal.`,
      );
    }
    const contentFormat = request.contentFormat as ContentFormat;
    assertContentFormatAllowed(account.platform, contentFormat);

    return {
      connectedAccountId: account.id,
      platform: account.platform,
      contentFormat,
      platformOptions: request.platformOptions,
      outstandAccountId: account.outstandAccountId,
    };
  });
}
