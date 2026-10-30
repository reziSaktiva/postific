"use client";

import { useState, useTransition } from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Text } from "@/components/ui/text";
import { formatShortDate } from "@/lib/utils/format-date";
import { formatRelativeTime } from "@/lib/utils/format-relative-time";
import { useUserTimeZone } from "@/lib/time/user-time-zone-context";

import {
  SETTINGS_BREADCRUMB_GROUP,
  SettingsPageHead,
} from "../../../components/SettingsPageHead";
import { revokeAiClientAction } from "../actions";

export interface AiClientItem {
  id: string;
  /** Salinan nama klien saat persetujuan; null untuk grant lama. */
  clientName: string | null;
  /** Null bila pengguna tidak lagi member workspace itu. */
  workspaceName: string | null;
  scopes: readonly string[];
  connectedAt: string;
  lastUsedAt: string | null;
}

interface Props {
  clients: AiClientItem[];
  /** Null bila base URL belum dikonfigurasi (URL relatif tidak berguna). */
  mcpUrl: string | null;
}

const FALLBACK_CLIENT_NAME = "Klien AI";
const FALLBACK_WORKSPACE_NAME = "Workspace tidak tersedia";

function displayName(client: AiClientItem): string {
  return client.clientName?.trim() || FALLBACK_CLIENT_NAME;
}

function ClientRow({
  client,
  timeZone,
  onRequestRevoke,
}: {
  client: AiClientItem;
  timeZone: string;
  onRequestRevoke: (client: AiClientItem) => void;
}) {
  const name = displayName(client);
  const lastUsed = client.lastUsedAt
    ? `Terakhir dipakai ${formatRelativeTime(new Date(client.lastUsedAt), timeZone)}`
    : "Belum pernah dipakai";
  const meta = [
    client.workspaceName ?? FALLBACK_WORKSPACE_NAME,
    `Tersambung ${formatShortDate(new Date(client.connectedAt), timeZone)}`,
    lastUsed,
  ].join(" · ");

  return (
    <TableRow>
      <TableCell className="whitespace-normal">
        {/* eslint-disable-next-line no-restricted-syntax -- file ini komposisi Tailwind shadcn (ADR-097) */}
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-sm font-bold"
          >
            {name.charAt(0).toUpperCase()}
          </span>
          {/* eslint-disable-next-line no-restricted-syntax -- sama seperti di atas */}
          <div className="flex min-w-0 flex-col gap-1">
            <Text variant="small">{name}</Text>
            <Text variant="muted">{meta}</Text>
            {/* eslint-disable-next-line no-restricted-syntax -- sama seperti di atas */}
            <div className="flex flex-wrap gap-1.5">
              {client.scopes.map((scope) => (
                <Badge key={scope} variant="outline">
                  {scope}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onRequestRevoke(client)}
        >
          Cabut
        </Button>
      </TableCell>
    </TableRow>
  );
}

function EmptyState({ mcpUrl }: { mcpUrl: string | null }) {
  async function handleCopy() {
    if (!mcpUrl) return;
    try {
      await navigator.clipboard.writeText(mcpUrl);
      toast("URL MCP disalin");
    } catch {
      toast("Gagal menyalin. Salin URL secara manual.");
    }
  }

  return (
    <Empty className="rounded-xl border border-border">
      <EmptyHeader>
        <EmptyTitle>Belum ada klien AI tersambung</EmptyTitle>
        <EmptyDescription>
          Sambungkan klien AI seperti Claude, ChatGPT, atau Cursor agar bisa
          membaca data dan menyiapkan draft untuk Anda.
        </EmptyDescription>
      </EmptyHeader>
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-left text-sm text-muted-foreground">
        <li>Buka pengaturan konektor / MCP di klien AI Anda.</li>
        <li>Tambahkan server MCP baru dengan URL di bawah ini.</li>
        <li>
          Login ke Postific saat diminta, lalu pilih workspace dan izin pada
          layar persetujuan.
        </li>
      </ol>
      {mcpUrl ? (
        <>
          {/* eslint-disable-next-line no-restricted-syntax -- file ini komposisi Tailwind shadcn (ADR-097) */}
          <div className="flex w-full max-w-md gap-2">
            <Input
              readOnly
              value={mcpUrl}
              aria-label="URL MCP Postific"
              className="font-mono text-sm"
            />
            <Button type="button" variant="outline" onClick={handleCopy}>
              <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
              Salin
            </Button>
          </div>
        </>
      ) : (
        <Text variant="muted">
          URL MCP belum dikonfigurasi di server ini. Hubungi admin.
        </Text>
      )}
    </Empty>
  );
}

/**
 * View Settings → Account → Klien AI (T-156, ADR-139). Presentasi +
 * orkestrasi Server Action; kepemilikan grant ditegakkan
 * `McpAccessService.revokeGrant` lewat `revokeAiClientAction`. Rancangan:
 * artifact Postific `ScreenSettingsAiClients` (dikonfirmasi 2026-10-26):
 * baris KSP-08 tanpa header kolom, Cabut membuka AlertDialog Tier 2.
 */
export function AiClientsView({ clients, mcpUrl }: Props) {
  const timeZone = useUserTimeZone();
  const [isPending, startTransition] = useTransition();
  const [target, setTarget] = useState<AiClientItem | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function requestRevoke(client: AiClientItem) {
    setError(null);
    setTarget(client);
    setOpen(true);
  }

  function handleRevoke() {
    if (!target) return;
    const grantId = target.id;
    startTransition(async () => {
      const result = await revokeAiClientAction(grantId);
      if (!result.ok) {
        setError(result.error);
      } else {
        toast("Akses klien AI dicabut");
      }
      setOpen(false);
    });
  }

  const dialogName = target ? displayName(target) : "";
  const dialogWorkspaceText = target?.workspaceName
    ? `workspace ${target.workspaceName}`
    : "workspace ini";

  return (
    // eslint-disable-next-line no-restricted-syntax -- file ini komposisi Tailwind shadcn (ADR-097)
    <div className="flex flex-col gap-4 p-4">
      <SettingsPageHead
        pageName="Klien AI"
        breadcrumb={`${SETTINGS_BREADCRUMB_GROUP.account} / Klien AI`}
      />
      <Text variant="muted">
        Klien AI yang Anda izinkan mengakses Postific lewat MCP. Mencabut akses
        langsung menghentikan klien itu — post yang sudah dibuat atau
        dijadwalkan tetap ada.
      </Text>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      ) : null}

      {clients.length === 0 ? (
        <EmptyState mcpUrl={mcpUrl} />
      ) : (
        <>
          {/* eslint-disable-next-line no-restricted-syntax -- file ini komposisi Tailwind shadcn (ADR-097) */}
          <div className="rounded-xl border border-border py-2">
            <Table>
              <TableBody>
                {clients.map((client) => (
                  <ClientRow
                    key={client.id}
                    client={client}
                    timeZone={timeZone}
                    onRequestRevoke={requestRevoke}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          <Text variant="muted">
            Satu persetujuan berlaku untuk satu workspace. Klien yang sama di
            workspace lain muncul sebagai baris terpisah.
          </Text>
        </>
      )}

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !isPending) setOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{`Cabut akses ${dialogName}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {`${dialogName} tidak bisa lagi membaca atau mengubah data ${dialogWorkspaceText}. Draft dan post yang sudah dibuat atau dijadwalkan lewat klien ini tetap ada. Anda bisa menyambungkan lagi kapan saja.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(e) => {
                e.preventDefault();
                handleRevoke();
              }}
            >
              {isPending ? <Spinner /> : null}
              Cabut Akses
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
