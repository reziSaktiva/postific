"use client";

import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Image01Icon } from "@hugeicons/core-free-icons";

import type { MediaThumbnailDto } from "@/domains/media";
import { cn } from "@/lib/utils";

import { MediaThumbnail } from "../../components/media-thumbnail";

/**
 * Thumbnail posting; tanpa media memakai ikon gambar sebagai pengganti.
 * Gambar yang gagal dimuat (T-227: URL CDN posting impor kedaluwarsa)
 * jatuh ke ikon yang sama dengan ukuran kotak tetap, jadi tata letak kartu
 * tidak bergeser. Kegagalan dilacak per URL, sehingga thumbnail baru
 * (URL berbeda) tetap dicoba dimuat.
 *
 * Gambar bisa gagal SEBELUM hydration (HTML hasil server sudah memuatnya),
 * saat itu `onError` React tidak terpanggil. Karena itu setelah mount
 * gambar yang sudah selesai tetapi lebarnya 0 dianggap gagal.
 */
export function PostThumb({
  thumbnail,
  className,
}: {
  thumbnail: MediaThumbnailDto | null;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showMedia = thumbnail !== null && thumbnail.url !== failedUrl;
  const boxRef = useRef<HTMLSpanElement>(null);
  const url = thumbnail?.url ?? null;

  useEffect(() => {
    const img = boxRef.current?.querySelector("img");
    if (url && img && img.complete && img.naturalWidth === 0) {
      setFailedUrl(url);
    }
  }, [url]);

  return (
    <span
      ref={boxRef}
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground",
        className,
      )}
      aria-hidden
    >
      {showMedia ? (
        <MediaThumbnail
          url={thumbnail.url}
          type={thumbnail.type}
          alt=""
          fit="cover"
          className="absolute inset-0"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(thumbnail.url)}
        />
      ) : (
        <HugeiconsIcon icon={Image01Icon} className="size-5" />
      )}
    </span>
  );
}
