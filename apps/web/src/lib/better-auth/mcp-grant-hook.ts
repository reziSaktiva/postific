import { getOAuthProviderState } from "@better-auth/oauth-provider";
import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
  isAPIError,
} from "better-auth/api";
import { asUserId, asWorkspaceId } from "@postific/shared";

import type { McpAccessService } from "@/domains/mcp-access";

/**
 * Plugin Better Auth permanen BC-04 (T-150.4, ADR-139): menyalin consent
 * `oauth-provider` menjadi grant `mcp_grants` lewat `hooks.after` pada
 * `/oauth2/consent` (opsi A hasil mini-spike T-149.2; plugin `oauth-provider`
 * 1.6.33 tidak punya hook `onConsent`). Seluruh logika grant ada di
 * `McpAccessService`; plugin ini hanya titik kait.
 *
 * Aturan (dibuktikan `mcp-grant-hook.test.ts` di atas Better Auth nyata):
 *  1. scope grant = scope MCP baris consent yang baru ditulis plugin
 *     (`ensureGrantFromConsent` membuang `openid`/`offline_access`);
 *  2. `workspace_id` grant = `referenceId` baris consent;
 *  3. grant gagal dibuat -> endpoint consent mengembalikan error (kode
 *     otorisasi tidak sampai ke klien) dan baris consent dikompensasi
 *     (dihapus), karena authorize melompati layar consent bila consent sudah
 *     ada: tanpa kompensasi klien macet permanen tanpa grant. Gerbang per
 *     panggilan (`authorizeCall`) tetap fail closed tanpa grant.
 *
 * Titik lain yang ditutup karena plugin membuka endpoint consent ke
 * pengguna: `/oauth2/delete-consent` mencabut grant lebih dulu (sebelum baris
 * consent hilang) dan hanya untuk consent milik pemanggil;
 * `/oauth2/update-consent` ditolak (akan melebarkan scope tanpa layar
 * persetujuan).
 */

/** Bagian `McpAccessService` yang dipakai plugin ini. */
export type McpGrantAccess = Pick<
  McpAccessService,
  "ensureGrantFromConsent" | "revokeGrantForConnection"
>;

export type McpGrantPluginOptions = {
  /**
   * Pabrik service, dipanggil per request (service stateless dan murah).
   * Produksi: `getMcpAccessService` (`lib/mcp-access`).
   */
  getAccess: () => McpGrantAccess;
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
  /**
   * Dipanggil setelah grant berhasil dibuat dari consent (T-151: hapus
   * pilihan workspace sesi). Gagal tidak membatalkan consent; hanya dicatat.
   */
  onConsentGranted?: (info: {
    user: { id: string };
    session: { id: string };
  }) => Promise<void>;
};

export type ConsentRow = {
  id: string;
  clientId: string;
  userId?: string | null;
  referenceId?: string | null;
  scopes: string[];
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

function consentTime(row: ConsentRow): number {
  const value = row.updatedAt ?? row.createdAt;
  return value ? new Date(value).getTime() : 0;
}

/** Baris consent terbaru (`updatedAt`, lalu `createdAt`); seri memilih yang terakhir. */
export function newestConsent(rows: ConsentRow[]): ConsentRow | undefined {
  return rows.reduce<ConsentRow | undefined>(
    (newest, row) =>
      !newest || consentTime(row) >= consentTime(newest) ? row : newest,
    undefined,
  );
}

export function mcpGrantPlugin(
  options: McpGrantPluginOptions,
): BetterAuthPlugin {
  const { getAccess, consentReferenceId, onConsentGranted } = options;

  return {
    id: "mcp-grant",
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

            // Hook `before` berjalan SEBELUM middleware sesi endpoint, jadi
            // kepemilikan diperiksa di sini: tanpa ini, siapa pun yang tahu
            // id consent bisa mencabut grant orang lain. Sesi hilang atau
            // consent milik pengguna lain: biarkan endpoint yang menolak.
            const session = await getSessionFromCtx(ctx);
            if (!session) {
              return;
            }
            const consent = await ctx.context.adapter.findOne<ConsentRow>({
              model: "oauthConsent",
              where: [{ field: "id", value: id }],
            });
            if (
              !consent?.userId ||
              consent.userId !== session.user.id ||
              !consent.referenceId
            ) {
              return;
            }

            // Cabut grant SEBELUM consent dihapus. Pencabutan atomik juga
            // menghapus consent + refresh token koneksi itu; bila gagal, tidak
            // ada yang berubah dan endpoint tidak dijalankan (error ke klien,
            // bisa dicoba ulang), jadi tidak ada consent hilang tanpa grant
            // tercabut.
            try {
              await getAccess().revokeGrantForConnection({
                userId: asUserId(consent.userId),
                clientId: consent.clientId,
                workspaceId: asWorkspaceId(consent.referenceId),
              });
            } catch (error) {
              ctx.context.logger.error(
                "[mcp-grant] pencabutan grant gagal; consent tidak dihapus",
                error,
              );
              throw serverError("Koneksi tidak dapat dicabut. Coba lagi.");
            }
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
            const query = state?.query
              ? new URLSearchParams(state.query)
              : undefined;
            const clientId = query?.get("client_id") ?? null;
            if (!session || !clientId) {
              // Batas kompensasi: tanpa sesi tidak ada pemilik consent, dan
              // tanpa `client_id` pada state OAuth tidak ada klien; baris
              // consent yang mungkin sudah ditulis plugin tidak dapat
              // diidentifikasi tanpa menebak, jadi tidak dihapus di sini.
              // Gerbang per panggilan (`authorizeCall`) tetap fail closed
              // karena grant tidak dibuat.
              throw serverError("Konteks persetujuan tidak lengkap.");
            }

            const requestedScopes = (query?.get("scope") ?? "")
              .split(" ")
              .filter(Boolean);
            const workspaceId = await consentReferenceId({
              user: session.user,
              session: session.session,
              scopes: requestedScopes,
            });
            if (!workspaceId) {
              // Tanpa workspace consent tidak boleh menjadi grant. Baris
              // consent yang sudah ditulis plugin tanpa `referenceId`
              // dikompensasi (hanya baris tanpa `referenceId`, supaya consent
              // sah untuk workspace lain tidak ikut terhapus).
              await compensateConsent(ctx, {
                userId: session.user.id,
                clientId,
              });
              throw serverError("Persetujuan tanpa workspace.");
            }

            // Tabel consent tidak punya constraint unik: ambil baris TERBARU
            // supaya baris lama yang lebih lebar tidak menjadi scope grant.
            const consents = await ctx.context.adapter.findMany<ConsentRow>({
              model: "oauthConsent",
              where: [
                { field: "clientId", value: clientId },
                { field: "userId", value: session.user.id },
                { field: "referenceId", value: workspaceId },
              ],
            });
            const consent = newestConsent(consents);
            if (!consent) {
              // Jalur `prompt=login` yang belum terpenuhi: plugin mengalihkan ke
              // login tanpa menulis consent. Tidak ada yang disetujui.
              return;
            }

            try {
              await getAccess().ensureGrantFromConsent({
                userId: asUserId(session.user.id),
                clientId,
                workspaceId: asWorkspaceId(workspaceId),
                clientName: await findClientName(ctx, clientId),
                consentScopes: consent.scopes,
              });
            } catch (error) {
              ctx.context.logger.error(
                "[mcp-grant] pembuatan grant gagal; consent dikompensasi",
                error,
              );
              await compensateConsent(ctx, {
                userId: session.user.id,
                clientId,
                workspaceId,
                consentId: consent.id,
              });
              throw serverError("Koneksi tidak dapat disimpan. Coba lagi.");
            }

            try {
              await onConsentGranted?.({
                user: session.user,
                session: session.session,
              });
            } catch (error) {
              ctx.context.logger.error(
                "[mcp-grant] pembersihan pilihan workspace gagal (diabaikan, kedaluwarsa 10 menit)",
                error,
              );
            }
          }),
        },
      ],
    },
  };
}

type CompensationContext = {
  context: {
    adapter: {
      findMany<T>(query: {
        model: string;
        where: { field: string; value: string }[];
      }): Promise<T[]>;
      delete(query: {
        model: string;
        where: { field: string; value: string }[];
      }): Promise<unknown>;
    };
    logger: { error(message: string, ...args: unknown[]): void };
  };
};

/**
 * Menghapus baris consent yang tidak boleh bertahan tanpa grant. Memakai
 * `consentId` bila sudah diketahui; selain itu memilih consent TERBARU milik
 * pengguna + klien (dengan `workspaceId` bila ada, atau hanya baris tanpa
 * `referenceId` bila workspace tidak terselesaikan). Tidak pernah melempar:
 * kegagalan kompensasi hanya dicatat.
 */
export async function compensateConsent(
  ctx: CompensationContext,
  target: {
    userId: string;
    clientId: string;
    workspaceId?: string;
    consentId?: string;
  },
): Promise<void> {
  try {
    let consentId = target.consentId;
    if (!consentId) {
      const rows = await ctx.context.adapter.findMany<ConsentRow>({
        model: "oauthConsent",
        where: [
          { field: "clientId", value: target.clientId },
          { field: "userId", value: target.userId },
        ],
      });
      const candidates = rows.filter((row) =>
        target.workspaceId
          ? row.referenceId === target.workspaceId
          : !row.referenceId,
      );
      consentId = newestConsent(candidates)?.id;
    }
    if (!consentId) {
      return;
    }
    await ctx.context.adapter.delete({
      model: "oauthConsent",
      where: [{ field: "id", value: consentId }],
    });
  } catch (deleteError) {
    ctx.context.logger.error(
      "[mcp-grant] kompensasi consent gagal",
      deleteError,
    );
  }
}

/**
 * Nama klien untuk layar Klien AI (T-156). Hanya label tampilan: kegagalan
 * membaca atau nama kosong tidak boleh menggagalkan pembuatan grant.
 */
async function findClientName(
  ctx: {
    context: {
      adapter: {
        findOne<T>(query: {
          model: string;
          where: { field: string; value: string }[];
        }): Promise<T | null>;
      };
    };
  },
  clientId: string,
): Promise<string | null> {
  try {
    const client = await ctx.context.adapter.findOne<{ name?: string | null }>({
      model: "oauthClient",
      where: [{ field: "clientId", value: clientId }],
    });
    return client?.name ?? null;
  } catch {
    return null;
  }
}

function serverError(description: string): APIError {
  return new APIError("INTERNAL_SERVER_ERROR", {
    error: "server_error",
    error_description: description,
    message: description,
  });
}
