"use server";

import type {
  ContentFormat,
  MediaId,
  PinterestBoard,
  SocialPlatform,
  UserId,
  WorkspaceId,
} from "@postific/shared";
import {
  asConnectedAccountId,
  asMediaId,
  asPostId,
  asUserId,
} from "@postific/shared";
import { redirect } from "next/navigation";
import type { ScheduleTargetRequest } from "@/domains/publishing";
import {
  assertActorCanPublishNow,
  assertMediaCountMeetsMinimum,
  assertMediaCountWithinLimit,
  PublishingService,
  PublishNowUseCase,
  resolveDraftMediaIds,
  resolveScheduleTargets,
  SchedulePostsUseCase,
  type PostMediaLookupPort,
} from "@/domains/publishing";
import {
  DeleteMediaUseCase,
  MediaService,
  UploadMediaUseCase,
} from "@/domains/media";
import { WorkspaceService } from "@/domains/workspace";
import { getCachedSession } from "@/lib/better-auth/session";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";
import { getOutstandAdapter } from "@/lib/adapters/outstand";
import { supabaseMediaStorageAdapter } from "@/lib/adapters/media-storage/supabase-media-storage-adapter";
import { backgroundJobScheduler } from "@/lib/jobs/job-scheduler";
import { publishingRepository } from "@/lib/repositories/publishing";
import { mediaRepository } from "@/lib/repositories/media";
import { workspaceRepository } from "@/lib/repositories/workspace";
import { ApplicationError } from "@/lib/utils/errors";
import { PublishingDomainError } from "@/domains/publishing";

/**
 * `PublishingDomainError` (constraint-message asserts: format matrix,
 * Pinterest board, T-108 schedule-time) sengaja TIDAK extend
 * `ApplicationError` (`errors.ts` — isolasi domain errors dari lib app-level,
 * pola sama `WorkspaceDomainError`), jadi entry point yang bisa memicu
 * keduanya harus cek dua class terpisah. Tanpa ini, exception lolos tanpa
 * ditangkap sampai boundary Server Action Next.js, yang MEN-MASK pesan error
 * asli di production build (jadi pesan generik tanpa detail) — temuan
 * code-review PR #140, celah ini sudah ada sejak `assertMediaCountWithinLimit`/
 * `assertMediaCountMeetsMinimum` dipanggil tanpa try/catch di
 * `scheduleDraftAction`/`publishNowAction`, T-108 cuma menambah satu throw
 * site lagi (`assertScheduledAtNotInPast`) ke celah yang sama.
 */
function isKnownActionError(
  error: unknown,
): error is ApplicationError | PublishingDomainError {
  return (
    error instanceof ApplicationError || error instanceof PublishingDomainError
  );
}

/** Composition root — MediaService + Storage download untuk schedule/publish. */
function createPostMediaLookup(): PostMediaLookupPort {
  const mediaService = new MediaService(mediaRepository);
  return {
    listByIds: (input, userId) => mediaService.listByIds(input, userId),
    downloadBytes: (storagePath) =>
      supabaseMediaStorageAdapter.downloadMedia(storagePath),
    saveOutstandWorkingCopy: (input, userId) =>
      mediaService.saveOutstandWorkingCopy(input, userId),
  };
}

/**
 * Bagian "resolve + assert" bersama untuk `resolveAndValidateMediaIds` di
 * bawah maupun `scheduleDraftAction`/`publishNowAction` (yang butuh fetch
 * `foundMedia` paralel dengan `listConnectedAccounts`, jadi tidak bisa
 * memanggil `resolveAndValidateMediaIds` apa adanya) — supaya ketiganya
 * memakai SATU implementasi validasi ownership (`resolveDraftMediaIds`) +
 * batas ADR-107 (`assertMediaCountWithinLimit`) yang sama, bukan menyalin
 * ulang kombinasi keduanya di masing-masing action.
 */
function resolveMediaIdsAgainstFormats(
  found: Parameters<typeof resolveDraftMediaIds>[0],
  requestedMediaIds: MediaId[],
  activeFormats: ContentFormat[],
): MediaId[] {
  const resolved = resolveDraftMediaIds(found, requestedMediaIds);
  assertMediaCountWithinLimit(resolved.length, activeFormats);
  return resolved;
}

/**
 * Wiring bersama untuk `saveDraftAction`/`updateDraftAction`/
 * `scheduleDraftAction`/`publishNowAction` (T-024.4): validasi ownership
 * (setiap `mediaId` yang dikirim client benar-benar milik `workspaceId` ini
 * — anti-IDOR, `resolveDraftMediaIds`) dan batas jumlah media efektif untuk
 * format yang sedang dipilih (`assertMediaCountWithinLimit`, ADR-107).
 * Business rule sesungguhnya hidup di dua domain function itu (publishing
 * domain) — helper ini murni komposisi fetch (`MediaService.listByIds`) +
 * panggilan domain function, konsisten pola `resolveScheduleTargets` yang
 * juga dipanggil langsung dari Server Action ini.
 *
 * **Perbedaan `undefined` vs `[]` (koreksi review Ridwan, temuan MEDIUM):**
 * `requestedMediaIds` HARUS dibedakan dari "field `mediaIds` tidak dikirim
 * client sama sekali" (`undefined` — kolom `media_ids` di DB tidak boleh
 * disentuh, lihat catatan partial-update di
 * `IPublishingRepository.updateDraftCaption`) vs "client eksplisit mengirim
 * array kosong" (`[]` — user menghapus semua media, kolom harus benar-benar
 * dikosongkan). Return value function ini meneruskan perbedaan itu
 * (`undefined` masuk, `undefined` keluar — tidak pernah di-collapse jadi
 * `[]` lewat `?? []`) sampai ke `SaveDraftInput`/`UpdateDraftInput` yang
 * dikonsumsi `PublishingService.saveDraft`/`updateDraft`.
 */
async function resolveAndValidateMediaIds(
  workspaceId: WorkspaceId,
  requestedMediaIds: string[] | undefined,
  activeFormats: ContentFormat[],
  actingUserId: UserId,
): Promise<MediaId[] | undefined> {
  if (requestedMediaIds === undefined) {
    return undefined;
  }
  if (requestedMediaIds.length === 0) {
    return [];
  }

  const mediaIds = requestedMediaIds.map((id) => asMediaId(id));
  const mediaService = new MediaService(mediaRepository);
  const found = await mediaService.listByIds(
    { workspaceId, mediaIds },
    actingUserId,
  );
  return resolveMediaIdsAgainstFormats(found, mediaIds, activeFormats);
}

export interface SaveDraftInput {
  caption: string;
  /** T-024.4 — id `MediaItem` yang sudah diupload lewat `uploadMediaAction`. */
  mediaIds?: string[];
  /** T-024.4 — format yang sedang dipilih per akun target, untuk batas ADR-107 (`assertMediaCountWithinLimit`). */
  activeFormats?: ContentFormat[];
}

export async function saveDraftAction(
  input: SaveDraftInput,
): Promise<{ postId: string }> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  const actingUserId = asUserId(session.user.id);

  const mediaIds = await resolveAndValidateMediaIds(
    workspaceId,
    input.mediaIds,
    input.activeFormats ?? [],
    actingUserId,
  );

  const publishingService = new PublishingService(publishingRepository);
  const post = await publishingService.saveDraft({
    workspaceId,
    authorId: actingUserId,
    caption: input.caption,
    mediaIds,
  });

  return { postId: post.id };
}

export interface UpdateDraftInput {
  caption: string;
  mediaIds?: string[];
  activeFormats?: ContentFormat[];
}

export async function updateDraftAction(
  postId: string,
  input: UpdateDraftInput,
): Promise<{ postId: string }> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  const actingUserId = asUserId(session.user.id);

  const mediaIds = await resolveAndValidateMediaIds(
    workspaceId,
    input.mediaIds,
    input.activeFormats ?? [],
    actingUserId,
  );

  const publishingService = new PublishingService(publishingRepository);
  const post = await publishingService.updateDraft(
    {
      workspaceId,
      postId: asPostId(postId),
      caption: input.caption,
      mediaIds,
    },
    actingUserId,
  );

  return { postId: post.id };
}

export interface DraftMediaDto {
  id: string;
  url: string | null;
  type: string;
  filename: string;
}

export async function getDraftAction(postId: string): Promise<{
  postId: string;
  caption: string;
  status: string;
  media: DraftMediaDto[];
}> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  const actingUserId = asUserId(session.user.id);

  const publishingService = new PublishingService(publishingRepository);
  const post = await publishingService.getDraftById(
    workspaceId,
    asPostId(postId),
    actingUserId,
  );

  // `supabaseMediaStorageAdapter` disuplai (bug fix QA T-056, 2026-10-06) —
  // draft bisa dibuka lagi lama setelah upload, jadi `url` di-cache dari
  // waktu upload hampir pasti sudah expired; `MediaService.listByIds`
  // meregenerate signed URL baru dari `storagePath` setiap panggilan.
  const mediaService = new MediaService(
    mediaRepository,
    supabaseMediaStorageAdapter,
  );
  const mediaItems =
    post.mediaIds && post.mediaIds.length > 0
      ? await mediaService.listByIds(
          { workspaceId, mediaIds: post.mediaIds },
          actingUserId,
        )
      : [];

  return {
    postId: post.id,
    caption: post.caption,
    status: post.status,
    media: mediaItems.map((item) => ({
      id: item.id,
      url: item.url,
      type: item.type,
      filename: item.filename,
    })),
  };
}

/** Sama bentuk dengan `DraftMediaDto` — item media tunggal hasil upload dikonsumsi client sebagai item `DraftMediaDto` biasa (`Modal.tsx`: `setMediaItems((prev) => [...prev, result.media])`). */
export type UploadMediaDto = DraftMediaDto;

/**
 * Upload satu file media (T-024.4) — dipanggil per file dari dropzone
 * custom di `Modal.tsx`. Business logic (validasi mime/ukuran, upload ke
 * Supabase Storage, create record `MediaItem`, cleanup-on-failure) hidup di
 * `UploadMediaUseCase` (T-024.2) — action ini hanya wiring: resolve
 * workspace/session, ekstrak file dari `FormData`, panggil use-case,
 * petakan hasil/`ValidationError` jadi bentuk yang aman dikonsumsi client
 * (`{ error }` alih-alih exception mentah — upload per-file harus bisa
 * gagal individual tanpa membatalkan file lain yang sedang diunggah
 * bersamaan di client).
 */
export async function uploadMediaAction(
  formData: FormData,
): Promise<{ media: UploadMediaDto } | { error: string }> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  const actingUserId = asUserId(session.user.id);

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "File tidak valid." };
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const useCase = new UploadMediaUseCase(
    mediaRepository,
    supabaseMediaStorageAdapter,
  );

  try {
    const item = await useCase.execute({
      workspaceId,
      uploaderId: actingUserId,
      filename: file.name,
      mimeType: file.type,
      fileBuffer,
      actingUserId,
    });

    return {
      media: {
        id: item.id,
        url: item.url,
        type: item.type,
        filename: item.filename,
      },
    };
  } catch (error) {
    if (error instanceof ApplicationError) {
      return { error: error.message };
    }
    throw error;
  }
}

/**
 * Hapus satu `MediaItem` secara PERMANEN (T-024.5, ADR-049 Tier 2) —
 * dipanggil dari dialog konfirmasi di grid preview `Modal.tsx` setelah
 * user mengonfirmasi. Business logic (urutan hapus record DB dulu, baru
 * best-effort hapus file Storage) hidup di `DeleteMediaUseCase` — action
 * ini hanya wiring: resolve workspace/session, validasi `mediaId`, panggil
 * use-case, petakan `ApplicationError` (mis. `NotFoundError` kalau media
 * sudah tidak ada/bukan milik workspace ini) jadi `{ error }` alih-alih
 * exception mentah, konsisten pola `uploadMediaAction`.
 */
export async function deleteMediaAction(
  mediaId: string,
): Promise<{ error?: string }> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  const actingUserId = asUserId(session.user.id);

  const useCase = new DeleteMediaUseCase(
    mediaRepository,
    supabaseMediaStorageAdapter,
  );

  try {
    await useCase.execute(
      { workspaceId, mediaId: asMediaId(mediaId) },
      actingUserId,
    );
  } catch (error) {
    if (error instanceof ApplicationError) {
      return { error: error.message };
    }
    throw error;
  }

  return {};
}

export interface ConnectedAccountDto {
  id: string;
  platform: SocialPlatform;
  handle: string;
  status: string;
}

export async function getConnectedAccountsAction(): Promise<
  ConnectedAccountDto[]
> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const workspaceService = new WorkspaceService(workspaceRepository);
  const accounts = await workspaceService.listConnectedAccounts(
    workspaceId,
    asUserId(session.user.id),
  );

  return accounts.map((account) => ({
    id: account.id,
    platform: account.platform,
    handle: account.handle,
    status: account.status,
  }));
}

/**
 * Pinterest board picker (menutup KI-072, sisa scope ADR-114) — dipanggil
 * UI Draft Editor (Mark UI Engineer) saat user memilih akun target Pinterest
 * di composer, untuk mengisi dropdown board ASLI (bukan text input bebas).
 * Board dipilih PER POST (state Draft Editor), tidak dipersist ke
 * `ConnectedAccount` — hasil method ini murni dibaca, lalu id board yang
 * dipilih dikirim balik lewat `ScheduleDraftTargetInput.platformOptions.boardId`
 * saat schedule/publish (lihat `computePlatformOverride` di
 * `real-outstand-adapter.ts`).
 *
 * Business logic (anti-IDOR + validasi platform Pinterest) hidup di
 * `WorkspaceService.listPinterestBoards` — action ini hanya resolve
 * workspace context/session lalu delegasikan (pola sama
 * `getConnectedAccountsAction`). `WorkspaceService` dikonstruksi langsung
 * dengan `getOutstandAdapter()` (BUKAN
 * `createWorkspaceServiceWithOutstandAdapter()`, composition-root helper di
 * `@/lib/workspace/outstand-workspace-service`) — helper itu juga menarik
 * `backgroundJobStore`/Prisma client (untuk seeding JOB-03 di
 * `completeAccountConnection`, tidak relevan di sini) yang butuh
 * `DATABASE_URL` bahkan hanya untuk di-import, dan action ini tidak
 * menyentuh `completeAccountConnection` sama sekali.
 */
export async function listPinterestBoardsAction(
  connectedAccountId: string,
): Promise<PinterestBoard[]> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const workspaceService = new WorkspaceService(
    workspaceRepository,
    undefined,
    undefined,
    getOutstandAdapter(),
  );
  return workspaceService.listPinterestBoards({
    workspaceId,
    actorId: asUserId(session.user.id),
    connectedAccountId: asConnectedAccountId(connectedAccountId),
  });
}

/**
 * Alias dari `ScheduleTargetRequest` domain publishing (bukan definisi
 * terpisah) — actions.ts sebagai entry point reuse tipe dari domain,
 * bukan sebaliknya.
 */
export type ScheduleDraftTargetInput = ScheduleTargetRequest;

export interface ScheduleDraftInput {
  postId?: string;
  caption: string;
  scheduledAt: string;
  targets: ScheduleDraftTargetInput[];
  /** T-024.4 — media yang di-attach ke post ini (SATU set untuk seluruh post, ADR-107). */
  mediaIds?: string[];
}

/**
 * Orkestrasi Server Action untuk tombol "Konfirmasi & Jadwalkan" (ADR-059).
 * Business logic (format-matrix, guard status+ownership, panggilan
 * OutstandAdapter) hidup di `SchedulePostsUseCase.execute` — action ini
 * hanya resolve workspace context/session, memastikan draft tersimpan,
 * resolve identitas akun yang otentik dari DB (bukan dari client), lalu
 * delegasikan ke use-case.
 *
 * T-024.4: `mediaIds` divalidasi (ownership + batas ADR-107) TERHADAP
 * `targets` yang baru saja di-resolve dari DB (`resolveScheduleTargets`) —
 * bukan dari format mentah yang dikirim client — supaya batas jumlah media
 * yang ditegakkan selalu mencerminkan format target yang benar-benar valid.
 * Ini mengubah urutan: `listConnectedAccounts`/`listByIds` (media) berjalan
 * paralel dulu (keduanya independen dari caption), baru SETELAH itu
 * `saveDraft`/`updateDraft` dipanggil dengan `mediaIds` yang sudah
 * tervalidasi — beda dari versi sebelumnya yang menjalankan
 * `saveDraft`/`updateDraft` berbarengan dengan `listConnectedAccounts`
 * (waktu itu belum ada mediaIds untuk divalidasi lebih dulu).
 */
export async function scheduleDraftAction(
  input: ScheduleDraftInput,
): Promise<{ postId: string } | { error: string }> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const publishingService = new PublishingService(publishingRepository);
  const workspaceService = new WorkspaceService(workspaceRepository);
  const mediaService = new MediaService(mediaRepository);

  const actingUserId = asUserId(session.user.id);

  // T-108 code-review (PR #140, finding #1): seluruh validasi/use-case di
  // bawah ini bisa melempar `ApplicationError` ATAU `PublishingDomainError`
  // (`assertMediaCountWithinLimit`/`assertMediaCountMeetsMinimum`/
  // `assertScheduledAtNotInPast` di dalam `SchedulePostsUseCase.execute`) —
  // tanpa try/catch di sini, exception lolos sampai boundary Server Action
  // Next.js, yang MEN-MASK pesan error asli di production build (klien
  // hanya menerima pesan generik, bukan "Waktu yang dipilih sudah lewat..."
  // dkk). Bungkus di sini, pola sama `uploadMediaAction`/`deleteMediaAction`.
  try {
    // T-024.4 (koreksi review Ridwan, temuan MEDIUM): `undefined` (field
    // `mediaIds` tidak dikirim client) HARUS dibedakan dari `[]` (client
    // eksplisit mengosongkan media) — `?? []` di sini akan meng-collapse
    // keduanya dan membuat kolom `media_ids` di DB ikut terhapus diam-diam
    // untuk caller yang sengaja tidak mengirim field ini.
    const requestedMediaIds = input.mediaIds?.map((id) => asMediaId(id));

    const [connectedAccounts, foundMedia] = await Promise.all([
      workspaceService.listConnectedAccounts(workspaceId, actingUserId),
      requestedMediaIds && requestedMediaIds.length > 0
        ? mediaService.listByIds(
            { workspaceId, mediaIds: requestedMediaIds },
            actingUserId,
          )
        : Promise.resolve([]),
    ]);
    const targets = resolveScheduleTargets(connectedAccounts, input.targets);
    const activeFormats = targets.map((target) => target.contentFormat);
    const mediaIds =
      requestedMediaIds !== undefined
        ? resolveMediaIdsAgainstFormats(
            foundMedia,
            requestedMediaIds,
            activeFormats,
          )
        : undefined;

    // `mediaIds` undefined berarti draft ini mempertahankan media yang SUDAH
    // dipersist sebelumnya (lihat catatan `resolveAndValidateMediaIds`) — batas
    // ADR-107 tetap wajib ditegakkan terhadap `activeFormats` yang baru saja
    // di-resolve, bukan hanya saat client mengirim `mediaIds` eksplisit.
    let effectiveMediaCount = mediaIds?.length ?? 0;
    if (mediaIds === undefined && input.postId) {
      const existingDraft = await publishingService.getDraftById(
        workspaceId,
        asPostId(input.postId),
        actingUserId,
      );
      effectiveMediaCount = existingDraft.mediaIds?.length ?? 0;
      assertMediaCountWithinLimit(effectiveMediaCount, activeFormats);
    }
    // KI-074: batas MINIMUM (Story/Reel/Pin butuh ≥1 media) — beda dari
    // `assertMediaCountWithinLimit` di atas (yang cuma menegakkan batas
    // maksimum), ini SENGAJA dievaluasi terhadap `effectiveMediaCount` untuk
    // KETIGA kasus sekaligus (mediaIds baru dikirim client, mediaIds
    // dipertahankan dari draft yang sudah ada, ATAU draft baru tanpa media
    // sama sekali) — bukan hanya di dalam blok `if` di atas, supaya post baru
    // yang tidak pernah mengirim `mediaIds` (effectiveMediaCount tetap 0)
    // juga ikut tertangkap. Hanya ditegakkan di sini (schedule/publish),
    // BUKAN di `resolveAndValidateMediaIds`/`resolveMediaIdsAgainstFormats`
    // yang juga dipakai `saveDraftAction`/`updateDraftAction` — draft yang
    // masih disusun (belum siap dijadwalkan/dipublish) boleh belum punya
    // media sama sekali.
    assertMediaCountMeetsMinimum(effectiveMediaCount, activeFormats);

    const post = input.postId
      ? await publishingService.updateDraft(
          {
            workspaceId,
            postId: asPostId(input.postId),
            caption: input.caption,
            mediaIds,
          },
          actingUserId,
        )
      : await publishingService.saveDraft({
          workspaceId,
          authorId: actingUserId,
          caption: input.caption,
          mediaIds,
        });

    const scheduled = await new SchedulePostsUseCase(
      publishingRepository,
      getOutstandAdapter(),
      backgroundJobScheduler,
      createPostMediaLookup(),
    ).execute({
      workspaceId,
      postId: post.id,
      scheduledAt: new Date(input.scheduledAt),
      targets,
      actingUserId,
    });

    return { postId: scheduled.id };
  } catch (error) {
    if (isKnownActionError(error)) {
      return { error: error.message };
    }
    throw error;
  }
}

export interface PublishNowInput {
  postId?: string;
  caption: string;
  targets: ScheduleDraftTargetInput[];
  mediaIds?: string[];
}

/**
 * Orkestrasi Server Action untuk tombol "Konfirmasi & Publish" (T-029,
 * ADR-047) — sengaja mengikuti struktur `scheduleDraftAction` persis
 * (persist caption terbaru dulu, resolve akun terhubung dari DB, lalu
 * delegasikan ke use-case) supaya kedua aksi publish tetap konsisten.
 * Business logic (RBAC, format-matrix, guard status+ownership, panggilan
 * OutstandAdapter) hidup di `PublishNowUseCase.execute` — action ini hanya
 * wiring: resolve workspace context/session (termasuk `role` yang sudah
 * tervalidasi oleh `proxy.ts` per request), memastikan draft tersimpan,
 * resolve identitas akun yang otentik dari DB (bukan dari client), lalu
 * delegasikan. `mediaIds` — lihat catatan `scheduleDraftAction`.
 */
export async function publishNowAction(
  input: PublishNowInput,
): Promise<{ postId: string } | { error: string }> {
  const { workspaceId, role } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const publishingService = new PublishingService(publishingRepository);
  const workspaceService = new WorkspaceService(workspaceRepository);
  const mediaService = new MediaService(mediaRepository);

  const actingUserId = asUserId(session.user.id);

  // T-108 code-review (PR #140, finding #1) — lihat catatan identik di
  // `scheduleDraftAction`. Dipindah ke dalam try/catch ini juga
  // `assertActorCanPublishNow` (RBAC), yang sebelumnya dipanggil DI LUAR
  // blok ini — gap yang sama (exception lolos tanpa map ke `{error}`,
  // ter-mask di production) berlaku untuknya juga, bukan cuma throw site
  // baru T-108.
  try {
    // RBAC dulu, sebelum side effect apapun (saveDraft/updateDraft) — supaya
    // actor yang tidak berhak tidak sempat mempersist perubahan caption
    // walau `PublishNowUseCase.execute` juga mengulang guard yang sama.
    assertActorCanPublishNow(role);

    // T-024.4 (koreksi review Ridwan, temuan MEDIUM): `undefined` (field
    // `mediaIds` tidak dikirim client) HARUS dibedakan dari `[]` (client
    // eksplisit mengosongkan media) — `?? []` di sini akan meng-collapse
    // keduanya dan membuat kolom `media_ids` di DB ikut terhapus diam-diam
    // untuk caller yang sengaja tidak mengirim field ini.
    const requestedMediaIds = input.mediaIds?.map((id) => asMediaId(id));

    const [connectedAccounts, foundMedia] = await Promise.all([
      workspaceService.listConnectedAccounts(workspaceId, actingUserId),
      requestedMediaIds && requestedMediaIds.length > 0
        ? mediaService.listByIds(
            { workspaceId, mediaIds: requestedMediaIds },
            actingUserId,
          )
        : Promise.resolve([]),
    ]);
    const targets = resolveScheduleTargets(connectedAccounts, input.targets);
    const activeFormats = targets.map((target) => target.contentFormat);
    const mediaIds =
      requestedMediaIds !== undefined
        ? resolveMediaIdsAgainstFormats(
            foundMedia,
            requestedMediaIds,
            activeFormats,
          )
        : undefined;

    // `mediaIds` undefined berarti draft ini mempertahankan media yang SUDAH
    // dipersist sebelumnya (lihat catatan `resolveAndValidateMediaIds`) — batas
    // ADR-107 tetap wajib ditegakkan terhadap `activeFormats` yang baru saja
    // di-resolve, bukan hanya saat client mengirim `mediaIds` eksplisit.
    let effectiveMediaCount = mediaIds?.length ?? 0;
    if (mediaIds === undefined && input.postId) {
      const existingDraft = await publishingService.getDraftById(
        workspaceId,
        asPostId(input.postId),
        actingUserId,
      );
      effectiveMediaCount = existingDraft.mediaIds?.length ?? 0;
      assertMediaCountWithinLimit(effectiveMediaCount, activeFormats);
    }
    // KI-074: batas MINIMUM (Story/Reel/Pin butuh ≥1 media) — beda dari
    // `assertMediaCountWithinLimit` di atas (yang cuma menegakkan batas
    // maksimum), ini SENGAJA dievaluasi terhadap `effectiveMediaCount` untuk
    // KETIGA kasus sekaligus (mediaIds baru dikirim client, mediaIds
    // dipertahankan dari draft yang sudah ada, ATAU draft baru tanpa media
    // sama sekali) — bukan hanya di dalam blok `if` di atas, supaya post baru
    // yang tidak pernah mengirim `mediaIds` (effectiveMediaCount tetap 0)
    // juga ikut tertangkap. Hanya ditegakkan di sini (schedule/publish),
    // BUKAN di `resolveAndValidateMediaIds`/`resolveMediaIdsAgainstFormats`
    // yang juga dipakai `saveDraftAction`/`updateDraftAction` — draft yang
    // masih disusun (belum siap dijadwalkan/dipublish) boleh belum punya
    // media sama sekali.
    assertMediaCountMeetsMinimum(effectiveMediaCount, activeFormats);

    const post = input.postId
      ? await publishingService.updateDraft(
          {
            workspaceId,
            postId: asPostId(input.postId),
            caption: input.caption,
            mediaIds,
          },
          actingUserId,
        )
      : await publishingService.saveDraft({
          workspaceId,
          authorId: actingUserId,
          caption: input.caption,
          mediaIds,
        });

    const published = await new PublishNowUseCase(
      publishingRepository,
      getOutstandAdapter(),
      backgroundJobScheduler,
      createPostMediaLookup(),
    ).execute({
      workspaceId,
      postId: post.id,
      targets,
      actorRole: role,
      actingUserId,
    });

    return { postId: published.id };
  } catch (error) {
    if (isKnownActionError(error)) {
      return { error: error.message };
    }
    throw error;
  }
}
