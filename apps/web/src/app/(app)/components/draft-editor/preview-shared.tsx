import { HugeiconsIcon } from "@hugeicons/react";
import { Image01Icon } from "@hugeicons/core-free-icons";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { MediaThumbnail } from "../media-thumbnail";
import type { CaptionSegment, PreviewMediaSummary } from "./preview-model";

/** Avatar akun di Pratinjau: akun belum punya foto, jadi huruf awal. */
export function PreviewAvatar({
  initial,
  size = "default",
}: {
  initial: string;
  size?: "default" | "sm" | "lg";
}) {
  return (
    <Avatar size={size}>
      <AvatarFallback>{initial}</AvatarFallback>
    </Avatar>
  );
}

/** Caption dengan hashtag diberi warna aksen; spasi dan baris baru dipertahankan. */
export function PreviewCaptionText({
  segments,
  className,
}: {
  segments: CaptionSegment[];
  className?: string;
}) {
  return (
    <span className={cn("break-words whitespace-pre-wrap", className)}>
      {segments.map((segment, index) =>
        segment.isHashtag ? (
          <span key={index} className="font-semibold text-primary">
            {segment.text}
          </span>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </span>
  );
}

/** Pengganti caption saat belum ada isi: dua baris skeleton. */
export function PreviewCaptionSkeleton() {
  return (
    <span aria-hidden="true" className="flex flex-col gap-1.5">
      <Skeleton className="h-2.5 w-11/12 rounded-full" />
      <Skeleton className="h-2.5 w-3/5 rounded-full" />
    </span>
  );
}

/**
 * Kotak media kartu (media pertama + penanda "1/N"). Rasio ditentukan
 * pemanggil lewat `aspectClassName` (mis. `aspect-4/3`).
 */
export function PreviewMediaBox({
  media,
  aspectClassName,
  emptyText,
}: {
  media: PreviewMediaSummary;
  aspectClassName: string;
  emptyText: string;
}) {
  if (!media.first) {
    return (
      <span
        className={cn(
          "flex flex-col items-center justify-center gap-1.5 bg-muted p-4 text-center text-xs text-muted-foreground",
          aspectClassName,
        )}
      >
        <HugeiconsIcon icon={Image01Icon} strokeWidth={2} className="size-5" />
        {emptyText}
      </span>
    );
  }
  return (
    <span
      className={cn("relative block overflow-hidden bg-muted", aspectClassName)}
    >
      <MediaThumbnail
        url={media.first.url}
        type={media.first.isVideo ? "video" : "image"}
        alt={media.first.filename}
      />
      {media.counterLabel ? (
        <span className="absolute top-2 right-2 rounded-full bg-foreground/60 px-2 py-0.5 text-xs text-background">
          {media.counterLabel}
        </span>
      ) : null}
    </span>
  );
}
