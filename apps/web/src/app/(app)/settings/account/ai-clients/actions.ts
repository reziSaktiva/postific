"use server";

import { asMcpGrantId, asUserId } from "@postific/shared";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { McpGrantNotFoundError } from "@/domains/mcp-access";
import { auth } from "@/lib/better-auth/auth";
import { getMcpAccessService } from "@/lib/mcp-access/get-mcp-access-service";

export type RevokeAiClientActionResult =
  { ok: true } | { ok: false; error: string };

/**
 * Cabut koneksi klien AI milik pengguna yang sedang login (T-156). Entry
 * point tipis: sesi -> `McpAccessService.revokeGrant`. Kepemilikan grant
 * ditegakkan service, bukan di sini.
 */
export async function revokeAiClientAction(
  grantId: string,
): Promise<RevokeAiClientActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  try {
    await getMcpAccessService().revokeGrant(
      asMcpGrantId(grantId),
      asUserId(session.user.id),
    );
  } catch (error) {
    if (error instanceof McpGrantNotFoundError) {
      // Sudah hilang (mis. dicabut dari tab lain): daftar cukup disegarkan.
      revalidatePath("/settings/account/ai-clients");
      return { ok: false, error: error.message };
    }
    console.error("[revokeAiClientAction] gagal mencabut klien AI:", error);
    return { ok: false, error: "Gagal mencabut akses. Coba lagi." };
  }

  revalidatePath("/settings/account/ai-clients");
  return { ok: true };
}
