import { PLATFORM_LABEL } from "./form-shared";
import type { PostPreviewModel } from "./preview-model";
import {
  PreviewAvatar,
  PreviewCaptionSkeleton,
  PreviewCaptionText,
  PreviewMediaBox,
} from "./preview-shared";

type GenericModel = Extract<PostPreviewModel, { kind: "generic" }>;

/** Kartu umum untuk platform tanpa Pratinjau khusus (X, LinkedIn, YouTube, Threads). */
export function GenericPreview({ model }: { model: GenericModel }) {
  const platformLabel = PLATFORM_LABEL[model.platform];
  return (
    <article
      aria-label={`Pratinjau umum ${platformLabel}`}
      className="w-full max-w-sm overflow-hidden rounded-2xl bg-card text-sm text-card-foreground ring-1 ring-border"
    >
      <header className="flex items-center gap-2.5 p-3">
        <PreviewAvatar initial={model.initial} size="lg" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate leading-tight font-semibold">
            {model.displayName}
          </span>
          <span className="text-xs text-muted-foreground">
            {platformLabel} · Baru saja
          </span>
        </span>
      </header>
      <p className="px-3 pb-2.5">
        {model.hasCaption ? (
          <PreviewCaptionText
            segments={model.captionSegments}
            className="line-clamp-3"
          />
        ) : (
          <PreviewCaptionSkeleton />
        )}
      </p>
      {model.media.first ? (
        <PreviewMediaBox
          media={model.media}
          aspectClassName="aspect-16/10"
          emptyText=""
        />
      ) : null}
      <p className="px-3 pt-2 pb-3 text-xs text-muted-foreground">
        Pratinjau umum. Tampilan asli di {platformLabel} bisa berbeda.
      </p>
    </article>
  );
}
