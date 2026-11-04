import { HugeiconsIcon } from "@hugeicons/react";
import {
  Comment01Icon,
  Globe02Icon,
  MoreHorizontalIcon,
  Share08Icon,
  ThumbsUpIcon,
} from "@hugeicons/core-free-icons";

import type { PostPreviewModel } from "./preview-model";
import {
  PreviewAvatar,
  PreviewCaptionSkeleton,
  PreviewCaptionText,
  PreviewMediaBox,
} from "./preview-shared";

type FacebookPostModel = Extract<PostPreviewModel, { kind: "facebook-post" }>;

/** Pratinjau Facebook Post, dirakit dari komponen dan token Postific. */
export function FacebookPreview({ model }: { model: FacebookPostModel }) {
  return (
    <article
      aria-label="Pratinjau Facebook Post"
      className="w-full max-w-sm overflow-hidden rounded-2xl bg-card text-sm text-card-foreground ring-1 ring-border"
    >
      <header className="flex items-center gap-2.5 p-3">
        <PreviewAvatar initial={model.initial} size="lg" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate leading-tight font-semibold">
            {model.displayName}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            Baru saja ·
            <HugeiconsIcon
              icon={Globe02Icon}
              strokeWidth={2}
              className="size-3"
            />
          </span>
        </span>
        <HugeiconsIcon
          icon={MoreHorizontalIcon}
          strokeWidth={2}
          className="size-4.5 text-muted-foreground"
        />
      </header>
      <span className="block px-3 pb-3">
        {model.hasCaption ? (
          <PreviewCaptionText
            segments={model.captionSegments}
            className="line-clamp-3"
          />
        ) : (
          <PreviewCaptionSkeleton />
        )}
      </span>
      {model.media.first ? (
        <PreviewMediaBox
          media={model.media}
          aspectClassName="aspect-4/3"
          emptyText="Belum ada media"
        />
      ) : null}
      <footer className="flex items-center justify-around border-t border-border px-1 py-1.5 text-sm font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5 px-2 py-1.5">
          <HugeiconsIcon
            icon={ThumbsUpIcon}
            strokeWidth={2}
            className="size-4"
          />
          Suka
        </span>
        <span className="flex items-center gap-1.5 px-2 py-1.5">
          <HugeiconsIcon
            icon={Comment01Icon}
            strokeWidth={2}
            className="size-4"
          />
          Komentar
        </span>
        <span className="flex items-center gap-1.5 px-2 py-1.5">
          <HugeiconsIcon
            icon={Share08Icon}
            strokeWidth={2}
            className="size-4"
          />
          Bagikan
        </span>
      </footer>
    </article>
  );
}
