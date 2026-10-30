"use client";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

import type { FilteredEmptyKind } from "./source-filter";

const COPY: Record<
  Exclude<FilteredEmptyKind, "base">,
  { title: string; description: string }
> = {
  mcp: {
    title: "Belum ada konten dari klien AI",
    description: "Konten yang dibuat lewat klien AI akan muncul di sini.",
  },
  manual: {
    title: "Belum ada konten yang dibuat manual",
    description: "Konten yang dibuat lewat klien AI disembunyikan oleh filter.",
  },
  generic: {
    title: "Tidak ada hasil untuk filter ini",
    description: "Ubah atau reset filter untuk melihat konten lainnya.",
  },
};

/**
 * State kosong karena filter (T-157): sumber MCP kosong, sumber manual kosong
 * padahal ada konten MCP, atau kombinasi filter tanpa hasil. Tombol
 * "Tampilkan Semua" memanggil `onShowAll` (caller menentukan apa yang direset).
 */
export function SourceFilterEmpty({
  kind,
  onShowAll,
}: {
  kind: Exclude<FilteredEmptyKind, "base">;
  onShowAll: () => void;
}) {
  const { title, description } = COPY[kind];
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button type="button" variant="outline" onClick={onShowAll}>
          Tampilkan Semua
        </Button>
      </EmptyContent>
    </Empty>
  );
}
