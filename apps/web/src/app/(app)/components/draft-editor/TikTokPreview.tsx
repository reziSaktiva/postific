import { HugeiconsIcon } from "@hugeicons/react";
import {
  Bookmark01Icon,
  BubbleChatIcon,
  FavouriteIcon,
  MusicNote01Icon,
  Share08Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons";

import { MediaThumbnail } from "../media-thumbnail";
import type { PostPreviewModel } from "./preview-model";
import { PreviewAvatar } from "./preview-shared";

type TikTokModel = Extract<PostPreviewModel, { kind: "tiktok" }>;

/**
 * Pratinjau TikTok (9:16, rel aksi di kanan, tab "Untuk Anda"), dirakit dari
 * token Postific; bukan aset atau markup TikTok. Teks di atas media memakai
 * token media-foreground/media-scrim (sama untuk mode terang dan gelap).
 */
export function TikTokPreview({ model }: { model: TikTokModel }) {
  return (
    <article
      aria-label="Pratinjau TikTok"
      className="relative aspect-9/16 w-63 overflow-hidden rounded-3xl bg-media-scrim text-media-foreground ring-1 ring-border"
    >
      {model.media.first ? (
        <span className="absolute inset-0">
          <MediaThumbnail
            url={model.media.first.url}
            type={model.media.first.isVideo ? "video" : "image"}
            alt={model.media.first.filename}
          />
        </span>
      ) : (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-muted p-4 text-center text-xs text-muted-foreground">
          <HugeiconsIcon
            icon={Video01Icon}
            strokeWidth={2}
            className="size-6"
          />
          TikTok membutuhkan media
        </span>
      )}
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-b from-media-scrim/45 via-transparent via-25% to-media-scrim/65"
      />
      <header className="absolute inset-x-0 top-0 flex justify-center gap-4 px-3 py-2.5 text-sm font-semibold">
        <span className="text-media-foreground/65">Mengikuti</span>
        <span className="border-b-2 border-media-foreground pb-0.5">
          Untuk Anda
        </span>
      </header>
      <span className="absolute right-2 bottom-20 flex flex-col items-center gap-3.5 text-xs">
        <PreviewAvatar initial={model.initial} size="lg" />
        <RailAction icon={FavouriteIcon} />
        <RailAction icon={BubbleChatIcon} />
        <RailAction icon={Bookmark01Icon} />
        <RailAction icon={Share08Icon} />
      </span>
      <footer className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-3 pr-15">
        <span className="truncate text-sm font-bold">{model.displayName}</span>
        {model.hasCaption ? (
          <span className="line-clamp-2 text-xs break-words whitespace-pre-wrap">
            {model.captionSegments.map((s) => s.text).join("")}
          </span>
        ) : null}
        <span className="flex items-center gap-1.5 text-xs">
          <HugeiconsIcon
            icon={MusicNote01Icon}
            strokeWidth={2}
            className="size-3.5 shrink-0"
          />
          <span className="truncate">suara asli - {model.displayName}</span>
        </span>
      </footer>
    </article>
  );
}

function RailAction({ icon }: { icon: typeof FavouriteIcon }) {
  return (
    <span className="flex flex-col items-center gap-0.5">
      <HugeiconsIcon icon={icon} strokeWidth={2} className="size-6.5" />0
    </span>
  );
}
