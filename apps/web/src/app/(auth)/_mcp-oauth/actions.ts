"use server";

import { asUserId, asWorkspaceId } from "@postific/shared";

import { McpAccessDeniedError } from "@/domains/mcp-access";
import { getCachedSession } from "@/lib/better-auth/session";
import { getMcpConsentService } from "@/lib/mcp-access/get-mcp-consent-service";
import { isMcpEnabled } from "@/lib/mcp/config";

export type ChooseWorkspaceResult = { ok: true } | { ok: false; error: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Simpan workspace pilihan pengguna untuk sesi loginnya (T-151, ADR-139).
 * Dipanggil layar `/select-workspace` (langkah 1) dan diulang `/consent`
 * tepat sebelum persetujuan dikirim, supaya workspace yang tampil di layar
 * persetujuan selalu sama dengan yang dibaca server walau pengguna mengubahnya
 * di tab lain. Entry point tipis: keanggotaan aktif diperiksa
 * `McpConsentService.chooseWorkspace`.
 */
export async function chooseWorkspaceAction(
  workspaceId: string,
): Promise<ChooseWorkspaceResult> {
  const session = await getCachedSession();
  if (!isMcpEnabled() || !session) {
    return {
      ok: false,
      error: "Sesi tidak valid. Mulai lagi dari klien AI.",
    };
  }
  if (!UUID_PATTERN.test(workspaceId)) {
    return { ok: false, error: "Workspace tidak valid." };
  }

  try {
    await getMcpConsentService().chooseWorkspace({
      sessionId: session.session.id,
      userId: asUserId(session.user.id),
      workspaceId: asWorkspaceId(workspaceId),
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof McpAccessDeniedError) {
      return {
        ok: false,
        error: "Anda bukan lagi anggota aktif workspace ini.",
      };
    }
    return {
      ok: false,
      error: "Pilihan workspace gagal disimpan. Coba lagi.",
    };
  }
}
