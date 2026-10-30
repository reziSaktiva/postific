"use client";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

/** State kosong filter "Lewat MCP" tanpa hasil (T-157). */
export function McpEmpty({ onShowAll }: { onShowAll: () => void }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>Belum ada konten dari klien AI</EmptyTitle>
        <EmptyDescription>
          Konten yang dibuat lewat klien AI akan muncul di sini.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button type="button" variant="outline" onClick={onShowAll}>
          Tampilkan Semua
        </Button>
      </EmptyContent>
    </Empty>
  );
}
