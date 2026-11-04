import { HugeiconsIcon } from "@hugeicons/react";
import {
  Bookmark01Icon,
  BubbleChatIcon,
  FavouriteIcon,
  MoreHorizontalIcon,
  SentIcon,
} from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";

import type { PostPreviewModel } from "./preview-model";
import {
  PreviewAvatar,
  PreviewCaptionSkeleton,
  PreviewCaptionText,
  PreviewMediaBox,
} from "./preview-shared";

type InstagramPostModel = Extract<PostPreviewModel, { kind: "instagram-post" }>;

/** Pratinjau Instagram Post (media persegi), dirakit dari komponen dan token Postific. */
export function InstagramPreview({ model }: { model: InstagramPostModel }) {
  return (
    <article
      aria-label="Pratinjau Instagram Post"
      className="w-full max-w-sm overflow-hidden rounded-2xl bg-card text-sm text-card-foreground ring-1 ring-border"
    >
      <header className="flex items-center gap-2.5 p-3">
        <PreviewAvatar initial={model.initial} />
        <span className="min-w-0 flex-1 truncate font-semibold">
          {model.displayName}
        </span>
        <HugeiconsIcon
          icon={MoreHorizontalIcon}
          strokeWidth={2}
          className="size-4.5 text-muted-foreground"
        />
      </header>
      <PreviewMediaBox
        media={model.media}
        aspectClassName="aspect-square"
        emptyText="Instagram membutuhkan media"
      />
      {model.media.count > 1 ? (
        <span aria-hidden="true" className="flex justify-center gap-1 pt-1.5">
          {Array.from({ length: model.media.count }, (_, index) => (
            <span
              key={index}
              className={cn(
                "size-1.5 rounded-full",
                index === 0 ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </span>
      ) : null}
      <span className="flex items-center gap-3.5 px-3 pt-2.5 pb-1">
        <HugeiconsIcon
          icon={FavouriteIcon}
          strokeWidth={2}
          className="size-5.5"
        />
        <HugeiconsIcon
          icon={BubbleChatIcon}
          strokeWidth={2}
          className="size-5.5"
        />
        <HugeiconsIcon icon={SentIcon} strokeWidth={2} className="size-5.5" />
        <span className="flex-1" />
        <HugeiconsIcon
          icon={Bookmark01Icon}
          strokeWidth={2}
          className="size-5.5"
        />
      </span>
      <p className="px-3 pt-1 pb-1.5">
        {model.hasCaption ? (
          <>
            <span className="line-clamp-2">
              <b>{model.displayName}</b>{" "}
              <PreviewCaptionText segments={model.captionSegments} />
            </span>
            {model.isCaptionLong ? (
              <span className="text-muted-foreground">selengkapnya</span>
            ) : null}
          </>
        ) : (
          <PreviewCaptionSkeleton />
        )}
      </p>
      <p className="px-3 pb-3 text-xs text-muted-foreground uppercase">
        Baru saja
      </p>
    </article>
  );
}
