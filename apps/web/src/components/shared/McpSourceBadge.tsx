import { HugeiconsIcon } from "@hugeicons/react";
import { BotIcon } from "@hugeicons/core-free-icons";
import { PostCreatedVia } from "@postific/shared";

import { Badge } from "@/components/ui/badge";

export const MCP_FALLBACK_CLIENT_NAME = "Klien AI";

/**
 * Badge sumber "dibuat lewat MCP" (T-157, rancangan terkunci
 * `McpSourceBadge`): outline, teks netral, ikon robot + nama klien, lebar
 * maksimum 140px dengan ellipsis. Item manual: tidak merender apa pun.
 * Ditaruh di baris meta di bawah judul, bukan di kolom status/aksi.
 */
export function McpSourceBadge({
  createdVia,
  clientName,
}: {
  createdVia?: PostCreatedVia;
  clientName?: string | null;
}) {
  if (createdVia !== PostCreatedVia.Mcp) {
    return null;
  }
  const name = clientName?.trim() || MCP_FALLBACK_CLIENT_NAME;

  return (
    <Badge
      variant="outline"
      title={name}
      className="max-w-35 bg-transparent font-normal text-muted-foreground"
    >
      <HugeiconsIcon
        icon={BotIcon}
        size={10}
        aria-hidden="true"
        className="shrink-0"
      />
      <span className="sr-only">Dibuat lewat MCP oleh </span>
      <span className="truncate">{name}</span>
    </Badge>
  );
}
