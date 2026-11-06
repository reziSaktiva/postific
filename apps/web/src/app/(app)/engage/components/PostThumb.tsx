import { HugeiconsIcon } from "@hugeicons/react";
import { Image01Icon } from "@hugeicons/core-free-icons";

import type { MediaThumbnailDto } from "@/domains/media";
import { cn } from "@/lib/utils";

import { MediaThumbnail } from "../../components/media-thumbnail";

/** Thumbnail posting; tanpa media memakai ikon gambar sebagai pengganti. */
export function PostThumb({
  thumbnail,
  className,
}: {
  thumbnail: MediaThumbnailDto | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground",
        className,
      )}
      aria-hidden
    >
      {thumbnail ? (
        <MediaThumbnail
          url={thumbnail.url}
          type={thumbnail.type}
          alt=""
          fit="cover"
          className="absolute inset-0"
        />
      ) : (
        <HugeiconsIcon icon={Image01Icon} className="size-5" />
      )}
    </span>
  );
}
