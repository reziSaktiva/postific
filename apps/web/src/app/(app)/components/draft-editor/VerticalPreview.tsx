import { HugeiconsIcon } from "@hugeicons/react";
import {
  BubbleChatIcon,
  FavouriteIcon,
  MoreHorizontalIcon,
  SentIcon,
  Video01Icon,
} from "@hugeicons/core-free-icons";

import { ContentFormat, SocialPlatform } from "@postific/shared";

import { MediaThumbnail } from "../media-thumbnail";
import { FORMAT_LABEL, PLATFORM_LABEL } from "./form-shared";
import type { PostPreviewModel } from "./preview-model";
import { PreviewAvatar } from "./preview-shared";

type VerticalModel = Extract<PostPreviewModel, { kind: "vertical" }>;

/**
 * Pratinjau Reel dan Story (Instagram dan Facebook), rasio 9:16. Teks dan
 * ikon di atas media memakai token media-foreground/media-scrim (tetap di kedua mode), supaya terbaca
 * di mode terang maupun gelap (sama dengan tampilan asli kedua platform).
 */
export function VerticalPreview({ model }: { model: VerticalModel }) {
  const isStory = model.format === ContentFormat.Story;
  const platformLabel = PLATFORM_LABEL[model.platform];
  const formatLabel = FORMAT_LABEL[model.format];

  return (
    <article
      aria-label={`Pratinjau ${platformLabel} ${formatLabel}`}
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
          {platformLabel} {formatLabel} membutuhkan media
        </span>
      )}
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-b from-media-scrim/45 via-transparent via-25% to-media-scrim/65"
      />
      <header className="absolute inset-x-0 top-0 flex flex-col gap-2 px-3 py-2.5">
        {isStory ? (
          <span aria-hidden="true" className="flex gap-1">
            <span className="h-0.5 flex-1 rounded-full bg-media-foreground" />
            <span className="h-0.5 flex-1 rounded-full bg-media-foreground/40" />
          </span>
        ) : null}
        <span className="flex items-center gap-2 text-xs font-semibold">
          {isStory ? (
            <>
              <PreviewAvatar initial={model.initial} size="sm" />
              <span className="truncate">{model.displayName}</span>
              <span className="font-normal text-media-foreground/70">
                Baru saja
              </span>
            </>
          ) : (
            <span className="text-base">Reels</span>
          )}
        </span>
      </header>
      {isStory ? (
        <footer className="absolute inset-x-0 bottom-0 p-3">
          <span className="block rounded-full border border-media-foreground/60 px-3.5 py-1.5 text-xs text-media-foreground/90">
            {model.platform === SocialPlatform.Instagram
              ? "Kirim pesan"
              : "Balas..."}
          </span>
        </footer>
      ) : (
        <>
          <span className="absolute right-2 bottom-20 flex flex-col items-center gap-3.5 text-xs">
            <span className="flex flex-col items-center gap-0.5">
              <HugeiconsIcon
                icon={FavouriteIcon}
                strokeWidth={2}
                className="size-6"
              />
              0
            </span>
            <span className="flex flex-col items-center gap-0.5">
              <HugeiconsIcon
                icon={BubbleChatIcon}
                strokeWidth={2}
                className="size-6"
              />
              0
            </span>
            <HugeiconsIcon icon={SentIcon} strokeWidth={2} className="size-6" />
            <HugeiconsIcon
              icon={MoreHorizontalIcon}
              strokeWidth={2}
              className="size-5.5"
            />
          </span>
          <footer className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-3 pr-14">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <PreviewAvatar initial={model.initial} size="sm" />
              <span className="truncate">{model.displayName}</span>
            </span>
            {model.hasCaption ? (
              <span className="line-clamp-2 text-xs break-words whitespace-pre-wrap">
                {model.captionSegments.map((s) => s.text).join("")}
              </span>
            ) : null}
          </footer>
        </>
      )}
    </article>
  );
}
