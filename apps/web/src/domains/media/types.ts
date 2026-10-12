/** Domain-specific types for media (BC-08, domain-model.md § BC-08 — Media). */

import type { MediaId, UserId, WorkspaceId } from "@postific/shared";
import type { MediaType } from "@postific/shared";

/**
 * Proyeksi domain `MediaItem` (Aggregate Root, BC-08) — bentuk yang
 * dikembalikan repository/service, BUKAN model Prisma mentah. Tetap
 * anemic (interface data, bukan class) mengikuti konvensi domain lain di
 * repo ini (`PublishingPostRecord`, `NotificationRecord`, dst.) —
 * `entities/` sengaja dibiarkan kosong (`.gitkeep`) di seluruh domain,
 * bukan hanya di sini.
 *
 * `url` nullable — cache URL akses aplikasi dari Supabase Storage, boleh
 * kosong/kedaluwarsa dan dibuat ulang dari `storagePath` (T-024.2, di luar
 * scope T-024.1 ini). `outstand*` seluruhnya opsional (working copy T-024.3,
 * ADR-040) dan tidak diisi sama sekali oleh skeleton ini.
 */
export interface MediaItemRecord {
  id: MediaId;
  workspaceId: WorkspaceId;
  uploaderId: UserId;
  filename: string;
  mimeType: string;
  /** Ukuran file dalam bytes. `bigint` — kolom Prisma `size` bertipe `BigInt`. */
  size: bigint;
  url: string | null;
  storagePath: string;
  outstandMediaId: string | null;
  outstandMediaUrl: string | null;
  outstandUploadedAt: Date | null;
  outstandExpiresAt: Date | null;
  type: MediaType;
  width: number | null;
  height: number | null;
  /** Durasi video dalam detik (kolom `Decimal(10,2)`); `null` untuk image/gif. */
  duration: number | null;
  createdAt: Date;
}

/**
 * Thumbnail media siap-render — `url` Supabase Storage (BUKAN
 * `outstandMediaUrl`/`resolveOutstandPostMedia`, itu untuk upload ke
 * Outstand) + `type` untuk memilih markup `<img>`/`<video>`. Dipakai
 * `MediaService.resolveFirstThumbnail` (shared oleh preview "Post asal"
 * Comments Inbox T-056 dan History Detail KI-082) supaya kedua caller tidak
 * mendefinisikan DTO lokal yang kebetulan identik.
 */
export interface MediaThumbnailDto {
  url: string;
  type: MediaType;
}
