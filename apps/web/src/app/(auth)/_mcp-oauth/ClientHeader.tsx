import type { ReactNode } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Identitas klien untuk tampilan; bentuk `McpClientIdentity` (domain mcp-access) yang serializable. */
export type OAuthClientView = {
  name: string | null;
  hosts: string[];
  isUnusual: boolean;
};

export const UNNAMED_CLIENT_LABEL = "Klien tanpa nama";

export function clientDisplayName(client: OAuthClientView): string {
  return client.name ?? UNNAMED_CLIENT_LABEL;
}

/**
 * Kepala kartu persetujuan (KSP-09-F03): ikon inisial klien, judul, dan
 * keterangan. Ikon klien tanpa nama berbingkai putus-putus dengan "?". Nama
 * klien adalah klaim klien itu sendiri, jadi host asal ditampilkan oleh
 * pemanggil di keterangan.
 */
export function ClientHeader({
  client,
  title,
  description,
}: {
  client: OAuthClientView;
  title: string;
  description: ReactNode;
}) {
  const initial = client.name ? client.name.charAt(0).toUpperCase() : "?";
  return (
    // eslint-disable-next-line no-restricted-syntax -- T-151: komposisi Tailwind shadcn (ADR-097), pola layout kepala kartu auth
    <div className="flex min-w-0 items-center gap-3">
      <Avatar
        size="lg"
        className={cn(client.name === null && "after:border-dashed")}
      >
        <AvatarFallback className="font-semibold text-foreground">
          {initial}
        </AvatarFallback>
      </Avatar>
      {/* eslint-disable-next-line no-restricted-syntax -- T-151, sama seperti di atas */}
      <div className="flex min-w-0 flex-col gap-0.5">
        <CardTitle className="truncate">{title}</CardTitle>
        <CardDescription className="break-words">{description}</CardDescription>
      </div>
    </div>
  );
}
