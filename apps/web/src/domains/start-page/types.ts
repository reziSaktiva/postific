import type { UserId, WorkspaceId, MemberRole } from "@postific/shared";
import type { StartPageTheme } from "./value-objects/theme";

/** Domain-specific types for start-page. */

/**
 * Tautan pada halaman publik Start Page (T-070.2). Sengaja HANYA berisi
 * field yang aman untuk audiens anonim — tanpa `clickCount`, `isActive`,
 * `startPageId`, timestamp, dst. (data internal/analitik).
 */
export interface PublicStartPageLink {
  id: string;
  label: string;
  url: string;
}

/**
 * Proyeksi publik sebuah Start Page (ADR-128, `/u/[slug]`). Sengaja TANPA
 * `workspaceId`, `viewCount`, `isPublished`, `createdAt`/`updatedAt` —
 * halaman ini dibaca audiens anonim tanpa workspace context, jadi tidak
 * boleh membocorkan data internal tenant. `links` sudah terfilter aktif dan
 * terurut menurut `position`.
 */
export interface PublicStartPage {
  slug: string;
  title: string;
  bio: string | null;
  avatarUrl: string | null;
  theme: StartPageTheme;
  links: PublicStartPageLink[];
}

/**
 * Konteks aktor untuk operasi workspace-scoped (jalur tulis/baca editor).
 * `workspaceId`/`actorRole` datang dari `getWorkspaceContext()` (tervalidasi
 * `proxy.ts`), `actingUserId` dari session — dipakai `withCurrentUser` (RLS).
 */
export interface StartPageActorContext {
  workspaceId: WorkspaceId;
  actorRole: MemberRole;
  actingUserId: UserId;
}

/**
 * Tautan versi editor (workspace-scoped). Berbeda dari `PublicStartPageLink`:
 * memuat `isActive`, `position`, dan `clickCount` (analytics T-074 — hanya
 * tampil di Page Editor). `clickCount` bertipe number (BigInt DB dikonversi;
 * aman sampai 2^53).
 */
export interface StartPageLinkRecord {
  id: string;
  label: string;
  url: string;
  position: number;
  isActive: boolean;
  clickCount: number;
}

/**
 * Data Page Editor: halaman milik workspace beserta SEMUA tautan (aktif dan
 * nonaktif) terurut `position`. `theme` sudah lolos allowlist (nilai tak
 * dikenal di DB jatuh ke "default"). `viewCount` hanya untuk editor.
 */
export interface StartPageRecord {
  id: string;
  workspaceId: WorkspaceId;
  slug: string;
  title: string;
  bio: string | null;
  avatarUrl: string | null;
  theme: StartPageTheme;
  isPublished: boolean;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
  links: StartPageLinkRecord[];
}
