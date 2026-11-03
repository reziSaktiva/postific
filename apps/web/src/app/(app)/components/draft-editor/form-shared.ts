import type { PinterestBoard } from "@postific/shared";
import { ContentFormat, SocialPlatform } from "@postific/shared";

import type { ConnectedAccountDto } from "./actions";

/** Akun terhubung dari `WorkspaceConnectedAccount` (ADR-059) — bukan lagi mock. */
export type ConnectedAccount = ConnectedAccountDto;

/** Cuplikan form terbaru yang dilaporkan ke `DraftEditorModal` saat dialog ditutup. */
export interface LatestFormSnapshot {
  mode: "create" | "edit";
  caption: string;
  savedPostId: string | undefined;
}

/** Langkah konfirmasi dalam Dialog yang sama (`null` = langkah form). */
export type PendingAction = "schedule" | "publish-now" | null;

export type FormNotice = {
  status: "success" | "info" | "error";
  title: string;
};

export type PinterestBoardState =
  | { status: "loading" }
  | { status: "success"; boards: PinterestBoard[] }
  | { status: "error"; message: string };

export function isAccountDisconnected(account: ConnectedAccount): boolean {
  return account.status !== "active";
}

export const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  [SocialPlatform.Instagram]: "Instagram",
  [SocialPlatform.Facebook]: "Facebook",
  [SocialPlatform.Twitter]: "X (Twitter)",
  [SocialPlatform.LinkedIn]: "LinkedIn",
  [SocialPlatform.TikTok]: "TikTok",
  [SocialPlatform.YouTube]: "YouTube",
  [SocialPlatform.Threads]: "Threads",
  [SocialPlatform.Pinterest]: "Pinterest",
};

export const FORMAT_LABEL: Record<ContentFormat, string> = {
  [ContentFormat.Post]: "Post",
  [ContentFormat.Reel]: "Reel",
  [ContentFormat.Story]: "Story",
  [ContentFormat.Pin]: "Pin",
};

/** Matriks Content Format per platform — ADR-039. */
export function getSelectableFormats(
  platform: SocialPlatform,
): ContentFormat[] | null {
  if (
    platform === SocialPlatform.Instagram ||
    platform === SocialPlatform.Facebook
  ) {
    return [ContentFormat.Post, ContentFormat.Reel, ContentFormat.Story];
  }
  return null;
}

export function getDefaultFormat(platform: SocialPlatform): ContentFormat {
  return platform === SocialPlatform.Pinterest
    ? ContentFormat.Pin
    : ContentFormat.Post;
}
