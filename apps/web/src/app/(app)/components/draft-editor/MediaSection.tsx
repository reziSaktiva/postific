"use client";

import { useRef, useState } from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, Delete02Icon } from "@hugeicons/core-free-icons";

import { Badge } from "@/components/ui/badge";
import { FieldDescription } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { MediaThumbnail } from "../media-thumbnail";

import type { DraftMediaDto } from "./actions";

export function MediaSection({
  mediaItems,
  uploadingMediaCount,
  mediaError,
  effectiveMaxMedia,
  isMediaLimitReached,
  overLimitMediaCount,
  isDeleting,
  onFilesSelected,
  onRequestDelete,
}: {
  mediaItems: DraftMediaDto[];
  uploadingMediaCount: number;
  mediaError: string | null;
  effectiveMaxMedia: number;
  isMediaLimitReached: boolean;
  overLimitMediaCount: number;
  isDeleting: boolean;
  onFilesSelected: (fileList: FileList | null) => Promise<void>;
  onRequestDelete: (item: DraftMediaDto) => void;
}) {
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingMedia, setIsDraggingMedia] = useState(false);

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex.
    <div className="flex flex-col gap-3">
      <Text variant="h4" as="h3">
        Media
      </Text>
      <Label htmlFor="draft-media" className="sr-only">
        Media
      </Label>
      <input
        ref={mediaFileInputRef}
        id="draft-media"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime"
        className="hidden"
        disabled={isMediaLimitReached}
        onChange={(event) => {
          void onFilesSelected(event.target.files);
          event.target.value = "";
        }}
      />
      {/* eslint-disable-next-line no-restricted-syntax -- T-024.4: custom drag-drop zone (dikonfirmasi King Rezi via AskUserQuestion, bukan native file input polos) — tidak ada primitive shadcn setara, murni Tailwind. */}
      <div
        role="button"
        tabIndex={isMediaLimitReached ? -1 : 0}
        aria-disabled={isMediaLimitReached}
        onClick={() => {
          if (!isMediaLimitReached) {
            mediaFileInputRef.current?.click();
          }
        }}
        onKeyDown={(event) => {
          if (
            !isMediaLimitReached &&
            (event.key === "Enter" || event.key === " ")
          ) {
            event.preventDefault();
            mediaFileInputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!isMediaLimitReached) setIsDraggingMedia(true);
        }}
        onDragLeave={() => setIsDraggingMedia(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDraggingMedia(false);
          if (!isMediaLimitReached) {
            void onFilesSelected(event.dataTransfer.files);
          }
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-input p-6 text-center transition-colors",
          isMediaLimitReached
            ? "cursor-not-allowed opacity-50"
            : "cursor-pointer hover:border-primary",
          isDraggingMedia && "border-primary bg-accent",
        )}
      >
        <Text>Tarik file ke sini atau klik untuk memilih</Text>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              aria-disabled="true"
              className="cursor-not-allowed text-sm text-muted-foreground underline underline-offset-4"
              onClick={(event) => event.stopPropagation()}
            >
              atau pilih dari Media Library
            </span>
          </TooltipTrigger>
          <TooltipContent>Coming soon</TooltipContent>
        </Tooltip>
      </div>

      {mediaError ? (
        <Text variant="muted" className="text-destructive">
          {mediaError}
        </Text>
      ) : (
        // eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx HStack, murni Tailwind flex.
        <div className="flex flex-wrap items-center gap-2">
          <FieldDescription>
            Maks. {effectiveMaxMedia} media untuk format yang sedang dipilih
            (ADR-107) — 50MB per file.
          </FieldDescription>
          {/* KI-061: indikator over-limit setelah ganti target akun/format menurunkan effectiveMaxMedia di bawah media yang sudah diupload. */}
          {overLimitMediaCount > 0 ? (
            <Badge variant="warning" className="gap-1">
              <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
              {overLimitMediaCount} media melebihi batas, hapus untuk lanjut
            </Badge>
          ) : null}
        </div>
      )}

      {mediaItems.length > 0 || uploadingMediaCount > 0 ? (
        // eslint-disable-next-line no-restricted-syntax -- T-024.4: grid preview thumbnail media (multi-media/carousel) — tidak ada primitive shadcn setara, murni Tailwind grid.
        <div className="grid grid-cols-3 gap-2">
          {mediaItems.map((item, index) => {
            // KI-061 (ADR-107): server menolak berdasarkan TOTAL count.
            // Ekor array = media paling baru karena urutan grid
            // mengikuti `mediaIds` (append, dan di-restore oleh
            // `getDraftAction`), jadi index >= effectiveMaxMedia
            // adalah kelebihan yang perlu dihapus dulu.
            const isOverLimit = index >= effectiveMaxMedia;
            return (
              // eslint-disable-next-line no-restricted-syntax -- T-024.4: tile thumbnail grid preview media (multi-media/carousel) — tidak ada primitive shadcn setara, murni Tailwind.
              <div
                key={item.id}
                className={cn(
                  "group relative aspect-square overflow-hidden rounded-md border border-border bg-muted",
                  isOverLimit && "border-warning bg-warning/10",
                )}
              >
                <MediaThumbnail
                  url={item.url}
                  type={item.type}
                  alt={item.filename}
                />
                {isOverLimit ? (
                  <Badge
                    variant="warning"
                    className="absolute top-1 left-1 px-1"
                    aria-label="Media ini melebihi batas maksimum untuk format yang sedang dipilih"
                  >
                    <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
                  </Badge>
                ) : null}
                <button
                  type="button"
                  aria-label={`Hapus ${item.filename} secara permanen`}
                  onClick={() => onRequestDelete(item)}
                  disabled={isDeleting}
                  className={cn(
                    "absolute top-1 right-1 rounded-full bg-background/80 p-1 transition-opacity disabled:cursor-not-allowed disabled:opacity-50",
                    // Tile dalam batas tetap hover-only. Tile
                    // kelebihan batas harus selalu terlihat —
                    // layar sentuh tidak punya hover, padahal
                    // badge KI-061 menyuruh user menghapus.
                    isOverLimit
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100",
                  )}
                >
                  <HugeiconsIcon
                    icon={Delete02Icon}
                    strokeWidth={2}
                    size={16}
                  />
                </button>
              </div>
            );
          })}
          {Array.from({ length: uploadingMediaCount }).map((_, index) => (
            // eslint-disable-next-line no-restricted-syntax -- T-024.4: placeholder loading tile tanpa identitas stabil (belum ada id sampai upload selesai); murni Tailwind, tidak ada primitive shadcn setara.
            <div
              key={`uploading-${index}`}
              className="flex aspect-square items-center justify-center rounded-md border border-dashed border-input bg-muted"
            >
              <Spinner />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
