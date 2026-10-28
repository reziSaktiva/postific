"use server";

import { asUserId } from "@postific/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  StartPageService,
  type AddStartPageLinkInput,
  type CreateStartPageInput,
  type StartPageActorContext,
  type StartPageLinkRecord,
  type StartPageRecord,
  type UpdateStartPageLinkInput,
  type StartPageAvatarFile,
  assertAvatarSizeWithinLimit,
  type UpdateStartPageProfileInput,
} from "@/domains/start-page";
import { getCachedSession } from "@/lib/better-auth/session";
import { supabaseStartPageAvatarStorage } from "@/lib/adapters/avatar-storage";
import { startPageRepository } from "@/lib/repositories/start-page";
import { ExternalServiceError, toActionError } from "@/lib/utils/errors";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";

/**
 * Hasil Server Action Start Page: `{ error }` (pesan siap tampil) ATAU
 * `{ data }`. Selalu salah satu; `error` tidak pernah bersamaan dengan `data`.
 */
export type StartPageActionResult<T = void> =
  { error: string; data?: undefined } | { error?: undefined; data: T };

/**
 * Server Action Start Page (T-072) — wiring tipis: resolve workspace
 * context + session, delegasikan ke `StartPageService` (RBAC, validasi,
 * RLS ada di sana), revalidate `/start-page`. Tidak ada business logic di
 * sini (AGENTS.md #3). Halaman publik `/u/[slug]` dirender dinamis per
 * request (view counter), jadi tidak perlu revalidate.
 */
async function resolveActor(): Promise<StartPageActorContext> {
  const { workspaceId, role } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) redirect("/login");
  return {
    workspaceId,
    actorRole: role,
    actingUserId: asUserId(session.user.id),
  };
}

async function run<T>(
  work: (service: StartPageService, ctx: StartPageActorContext) => Promise<T>,
  options: { revalidate: boolean } = { revalidate: true },
): Promise<StartPageActionResult<T>> {
  const ctx = await resolveActor();
  try {
    const data = await work(
      new StartPageService(startPageRepository, supabaseStartPageAvatarStorage),
      ctx,
    );
    if (options.revalidate) revalidatePath("/start-page");
    return { data };
  } catch (error) {
    if (error instanceof ExternalServiceError) {
      console.error("[start-page actions] layanan eksternal gagal:", error);
    }
    return toActionError(error);
  }
}

/** Data Page Editor; `data: null` bila halaman belum dibuat. */
export async function getStartPageAction(): Promise<
  StartPageActionResult<StartPageRecord | null>
> {
  return run((service, ctx) => service.getStartPage(ctx), {
    revalidate: false,
  });
}

export async function createStartPageAction(
  input: CreateStartPageInput,
): Promise<StartPageActionResult<StartPageRecord>> {
  return run((service, ctx) => service.createStartPage(ctx, input));
}

export async function updateStartPageProfileAction(
  input: UpdateStartPageProfileInput,
  avatarFormData?: FormData,
): Promise<StartPageActionResult<StartPageRecord>> {
  return run(async (service, ctx) =>
    service.updateProfile(
      ctx,
      input,
      await readAvatarFile(avatarFormData?.get("avatar") ?? null),
    ),
  );
}

/** File kosong atau bukan `File` berarti tidak ada unggahan baru. */
async function readAvatarFile(
  avatar: FormDataEntryValue | null,
): Promise<StartPageAvatarFile | null> {
  if (!(avatar instanceof File) || avatar.size === 0) return null;
  assertAvatarSizeWithinLimit(avatar.size);
  return {
    buffer: Buffer.from(await avatar.arrayBuffer()),
    contentType: avatar.type,
  };
}

export async function setStartPagePublishedAction(
  isPublished: boolean,
): Promise<StartPageActionResult<StartPageRecord>> {
  return run((service, ctx) => service.setPublished(ctx, isPublished));
}

export async function addStartPageLinkAction(
  input: AddStartPageLinkInput,
): Promise<StartPageActionResult<StartPageLinkRecord>> {
  return run((service, ctx) => service.addLink(ctx, input));
}

export async function updateStartPageLinkAction(
  linkId: string,
  input: UpdateStartPageLinkInput,
): Promise<StartPageActionResult<StartPageLinkRecord>> {
  return run((service, ctx) => service.updateLink(ctx, linkId, input));
}

/** Konfirmasi hapus (ADR-049) ditangani UI sebelum memanggil ini. */
export async function deleteStartPageLinkAction(
  linkId: string,
): Promise<StartPageActionResult<void>> {
  return run((service, ctx) => service.deleteLink(ctx, linkId));
}

/** `orderedLinkIds` harus persis seluruh id tautan halaman, urutan baru dari atas. */
export async function reorderStartPageLinksAction(
  orderedLinkIds: string[],
): Promise<StartPageActionResult<void>> {
  return run((service, ctx) => service.reorderLinks(ctx, orderedLinkIds));
}
