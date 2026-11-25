/* eslint-disable no-restricted-syntax -- T-303: dikomposisi Tailwind langsung di atas shadcn/ui Skeleton (ADR-097); layout-only, bentuk disalin dari CommentRow dan PostCard (kartu Postific ScreenInfiniteScrollStates, dikonfirmasi King Rezi 2026-11-25) */
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { InfiniteListFooterProps } from "../../components/infinite-list/InfiniteListStates";

/**
 * Teks daftar Engage (T-303, ADR-166; pola "Long Lists" di
 * `key-screen-patterns.md`): semua daftar Engage memakai kata komentar,
 * sesuai kartu Postific `ScreenInfiniteScrollStates`.
 */
export const ENGAGE_END_TEXT = "Sudah sampai komentar terlama.";
export const ENGAGE_ERROR = {
  title: "Gagal memuat komentar lainnya",
  description: "Periksa koneksi, lalu coba lagi.",
  retryLabel: "Coba Lagi",
} as const;

/** Baris komentar berbentuk `CommentRow`: avatar, nama + waktu + badge, dua baris isi. */
export function CommentSkeletonRow({ withContext }: { withContext?: boolean }) {
  return (
    <div className="flex gap-2.5 p-3 not-first:border-t not-first:border-border">
      <Skeleton className="size-8 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2.5 w-14" />
          <Skeleton className="h-5 w-20 rounded-full md:ml-auto" />
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
        {withContext ? <Skeleton className="h-2.5 w-56 max-w-full" /> : null}
      </div>
    </div>
  );
}

/** Kartu posting berbentuk `PostCard`: akun, caption + thumbnail, progress. */
export function PostCardSkeletonRow() {
  return (
    <Card size="sm" className="shrink-0 gap-2 py-2.5">
      <CardContent className="flex flex-col gap-2 px-3">
        <div className="flex items-center gap-1.5">
          <Skeleton className="size-5 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex items-start gap-2.5">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <Skeleton className="size-12 shrink-0 rounded-lg" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-1 flex-1 rounded-full" />
          <Skeleton className="size-5 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

type FooterShape = Pick<
  InfiniteListFooterProps,
  "loading" | "endText" | "error"
>;

/** Teks dan baris skeleton `InfiniteListFooter` untuk daftar komentar. */
export function commentsFooter(withContext = false): FooterShape {
  return {
    loading: {
      count: 3,
      label: "Memuat komentar lainnya",
      renderRow: () => <CommentSkeletonRow withContext={withContext} />,
      className: cn("gap-0"),
    },
    endText: ENGAGE_END_TEXT,
    error: ENGAGE_ERROR,
  };
}

/**
 * Teks dan baris skeleton `InfiniteListFooter` untuk daftar posting. Daftar
 * posting (panel kiri By post) tidak ada di kartu yang dikonfirmasi; teksnya
 * mengikuti pola Publish ("posting lainnya", "posting terlama") dan menunggu
 * konfirmasi King Rezi.
 */
export function postsFooter(): FooterShape {
  return {
    loading: {
      count: 3,
      label: "Memuat posting lainnya",
      renderRow: () => <PostCardSkeletonRow />,
    },
    endText: "Sudah sampai posting terlama.",
    error: { ...ENGAGE_ERROR, title: "Gagal memuat posting lainnya" },
  };
}
