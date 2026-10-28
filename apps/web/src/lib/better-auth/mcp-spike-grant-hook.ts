import { getOAuthProviderState } from "@better-auth/oauth-provider";
import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
  isAPIError,
} from "better-auth/api";

import type {
  SpikeGrantKey,
  SpikeGrantStore,
} from "@/lib/mcp-spike/grant-store";

/**
 * T-149.2 (mini-spike titik kait grant, ADR-139) — SEMENTARA. Opsi A: plugin
 * Better Auth kecil yang menyalin consent menjadi grant lewat `hooks.after`
 * pada `/oauth2/consent`. Plugin `oauth-provider` 1.6.33 tidak punya hook
 * `onConsent`; ini satu-satunya titik kait yang dapat dipegang tanpa
 * mengubah paket. Bentuk permanen ditulis ulang di T-149.5/.6 (store diganti
 * repository Prisma `mcp_grants`).
 *
 * Aturan yang dibuktikan tes (`mcp-spike-grant-hook.test.ts`):
 *  1. scope grant = scope baris consent yang baru ditulis plugin (hanya
 *     `mcp:*`; `openid`/`offline_access` bukan scope tool);
 *  2. `workspace_id` grant = `referenceId` baris consent;
 *  3. grant gagal dibuat -> endpoint consent mengembalikan error (kode otorisasi
 *     tidak sampai ke klien), baris consent dikompensasi (dihapus) supaya
 *     percobaan ulang menampilkan layar persetujuan lagi, dan gerbang per
 *     panggilan menolak karena tidak ada grant.
 *
 * Titik lain yang ditutup karena plugin membuka endpoint consent ke
 * pengguna: `/oauth2/delete-consent` mencabut grant lebih dulu (sebelum baris
 * consent hilang), `/oauth2/update-consent` ditolak (akan melebarkan scope
 * tanpa layar persetujuan).
 */

export type McpSpikeGrantPluginOptions = {
  store: SpikeGrantStore;
  /** Scope yang menjadi scope tool (mis. `mcp:read`). Lainnya diabaikan. */
  toolScopes: readonly string[];
  /**
   * Fungsi yang sama dengan `oauthProvider({ postLogin.consentReferenceId })`.
   * Dipakai untuk memilih baris consent yang baru ditulis (satu per
   * klien + pengguna + workspace).
   */
  consentReferenceId: (info: {
    user: { id: string };
    session: { id: string };
    scopes: string[];
  }) => string | undefined | Promise<string | undefined>;
};

type ConsentRow = {
  id: string;
  clientId: string;
  userId?: string | null;
  referenceId?: string | null;
  scopes: string[];
};

export function mcpSpikeGrantPlugin(
  options: McpSpikeGrantPluginOptions,
): BetterAuthPlugin {
  const { store, toolScopes, consentReferenceId } = options;

  return {
    id: "mcp-spike-grant",
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === "/oauth2/update-consent",
          handler: createAuthMiddleware(async () => {
            throw new APIError("FORBIDDEN", {
              message:
                "Scope koneksi tidak dapat diubah lewat endpoint ini. Sambungkan ulang dari klien AI.",
            });
          }),
        },
        {
          matcher: (ctx) => ctx.path === "/oauth2/delete-consent",
          handler: createAuthMiddleware(async (ctx) => {
            const id = (ctx.body as { id?: string } | undefined)?.id;
            if (!id) {
              return;
            }
            const consent = await ctx.context.adapter.findOne<ConsentRow>({
              model: "oauthConsent",
              where: [{ field: "id", value: id }],
            });
            if (!consent?.userId || !consent.referenceId) {
              return;
            }
            // Cabut grant SEBELUM consent dihapus: bila langkah berikutnya
            // gagal, hasilnya tetap tertutup (grant dicabut, consent tersisa).
            await store.revoke({
              userId: consent.userId,
              clientId: consent.clientId,
              workspaceId: consent.referenceId,
            });
          }),
        },
      ],
      after: [
        {
          matcher: (ctx) => ctx.path === "/oauth2/consent",
          handler: createAuthMiddleware(async (ctx) => {
            // Endpoint gagal (scope tidak diminta, sesi hilang, dst.) atau
            // pengguna menolak: tidak ada consent baru, tidak ada grant.
            if (isAPIError(ctx.context.returned)) {
              return;
            }
            if (
              (ctx.body as { accept?: boolean } | undefined)?.accept !== true
            ) {
              return;
            }

            const session = await getSessionFromCtx(ctx);
            const state = await getOAuthProviderState();
            const clientId = state?.query
              ? new URLSearchParams(state.query).get("client_id")
              : null;
            if (!session || !clientId) {
              throw serverError("Konteks persetujuan tidak lengkap.");
            }

            const requestedScopes = state?.query
              ? (new URLSearchParams(state.query).get("scope") ?? "")
                  .split(" ")
                  .filter(Boolean)
              : [];
            const workspaceId = await consentReferenceId({
              user: session.user,
              session: session.session,
              scopes: requestedScopes,
            });
            if (!workspaceId) {
              // Tanpa workspace consent tidak boleh menjadi grant.
              throw serverError("Persetujuan tanpa workspace.");
            }

            const consent = await ctx.context.adapter.findOne<ConsentRow>({
              model: "oauthConsent",
              where: [
                { field: "clientId", value: clientId },
                { field: "userId", value: session.user.id },
                { field: "referenceId", value: workspaceId },
              ],
            });
            if (!consent) {
              // Jalur `prompt=login` yang belum terpenuhi: plugin mengalihkan ke
              // login tanpa menulis consent. Tidak ada yang disetujui.
              return;
            }

            const key: SpikeGrantKey = {
              userId: session.user.id,
              clientId,
              workspaceId,
            };
            const scopes = consent.scopes.filter((scope) =>
              toolScopes.includes(scope),
            );

            try {
              await store.upsertActive({ ...key, scopes });
            } catch (error) {
              ctx.context.logger.error(
                "[mcp-spike] pembuatan grant gagal; consent dikompensasi",
                error,
              );
              await ctx.context.adapter
                .delete({
                  model: "oauthConsent",
                  where: [{ field: "id", value: consent.id }],
                })
                .catch((deleteError: unknown) => {
                  ctx.context.logger.error(
                    "[mcp-spike] kompensasi consent gagal",
                    deleteError,
                  );
                });
              throw serverError("Koneksi tidak dapat disimpan. Coba lagi.");
            }
          }),
        },
      ],
    },
  };
}

function serverError(description: string): APIError {
  return new APIError("INTERNAL_SERVER_ERROR", {
    error: "server_error",
    error_description: description,
    message: description,
  });
}
