import { HugeiconsIcon } from "@hugeicons/react";
import { Image01Icon, Link01Icon } from "@hugeicons/core-free-icons";

import { Skeleton } from "@/components/ui/skeleton";

import { MediaThumbnail } from "../media-thumbnail";
import type { PostPreviewModel } from "./preview-model";
import { PreviewAvatar } from "./preview-shared";

type PinterestModel = Extract<PostPreviewModel, { kind: "pinterest-pin" }>;

/**
 * Pratinjau Pinterest Pin (media 2:3, judul, link, board), dirakit dari
 * komponen dan token Postific. Judul, link, dan board berasal dari blok
 * jaringan Pinterest.
 */
export function PinterestPreview({ model }: { model: PinterestModel }) {
  return (
    <article
      aria-label="Pratinjau Pinterest Pin"
      className="w-full max-w-68 text-card-foreground"
    >
      <span className="relative block aspect-2/3 overflow-hidden rounded-3xl bg-muted ring-1 ring-border">
        {model.media.first ? (
          <span className="absolute inset-0">
            <MediaThumbnail
              url={model.media.first.url}
              type={model.media.first.isVideo ? "video" : "image"}
              alt={model.media.first.filename}
            />
          </span>
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-4 text-center text-xs text-muted-foreground">
            <HugeiconsIcon
              icon={Image01Icon}
              strokeWidth={2}
              className="size-5"
            />
            Pinterest membutuhkan media
          </span>
        )}
        <span className="absolute top-2.5 right-2.5 rounded-full bg-brand-pinterest px-3.5 py-1.5 text-sm font-semibold text-media-foreground">
          Simpan
        </span>
      </span>
      <footer className="flex flex-col gap-1.5 px-1 pt-2.5 text-sm">
        {model.pinTitle ? (
          <span className="text-base leading-tight font-bold break-words">
            {model.pinTitle}
          </span>
        ) : (
          <Skeleton aria-hidden="true" className="h-2.5 w-7/12 rounded-full" />
        )}
        {model.hasCaption ? (
          <span className="line-clamp-2 text-xs break-words whitespace-pre-wrap text-muted-foreground">
            {model.captionSegments.map((s) => s.text).join("")}
          </span>
        ) : null}
        {model.linkHost ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <HugeiconsIcon
              icon={Link01Icon}
              strokeWidth={2}
              className="size-3.5"
            />
            <span className="truncate">{model.linkHost}</span>
          </span>
        ) : null}
        {model.boardName ? (
          <span className="truncate text-xs text-muted-foreground">
            Board: {model.boardName}
          </span>
        ) : null}
        <span className="mt-0.5 flex items-center gap-2">
          <PreviewAvatar initial={model.initial} size="sm" />
          <span className="truncate text-xs font-semibold">
            {model.displayName}
          </span>
        </span>
      </footer>
    </article>
  );
}
