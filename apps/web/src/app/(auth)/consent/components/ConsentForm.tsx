"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon } from "@hugeicons/core-free-icons";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/better-auth/client";
import { cn } from "@/lib/utils";

import { chooseWorkspaceAction } from "../../_mcp-oauth/actions";
import {
  ClientHeader,
  clientDisplayName,
  type OAuthClientView,
} from "../../_mcp-oauth/ClientHeader";
import { OAuthSteps } from "../../_mcp-oauth/OAuthSteps";
import {
  defaultGrantedScopes,
  type ConsentScopeCopy,
} from "../../_mcp-oauth/scope-copy";

export type SelectedWorkspaceView = {
  id: string;
  name: string;
  roleLabel: string;
};

const SAVE_FAILED_MESSAGE =
  "Persetujuan gagal disimpan. Tidak ada akses yang diberikan. Coba lagi, atau tolak dan sambungkan ulang dari klien AI.";

/**
 * Langkah 2 persetujuan OAuth klien AI (T-151, KSP-09-F02/F03/F04, ADR-139):
 * daftar scope dengan `Checkbox` di `ItemMedia` (pola
 * `FacebookPagesPickerDialog`, terkunci King Rezi 2026-10-26). `read` dan
 * `draft` tercentang bawaan; `schedule` harus dicentang sengaja. Tanpa
 * pembatasan scope berdasarkan role di MVP. Nama dan host klien selalu
 * tampil; klien tanpa nama atau host tidak lazim memberi peringatan keras,
 * Tolak menjadi tombol utama, dan Izinkan berlabel "Saya paham, izinkan".
 *
 * Sebelum persetujuan dikirim, workspace yang tampil disimpan ulang di server
 * (`chooseWorkspaceAction`): pilihan itu yang dibaca plugin sebagai
 * `referenceId` consent, jadi workspace yang diizinkan selalu sama dengan yang
 * dilihat pengguna walau ia mengubahnya di tab lain.
 */
export function ConsentForm({
  client,
  workspace,
  changeWorkspaceHref,
  scopes,
  passthroughScopes,
}: {
  client: OAuthClientView;
  workspace: SelectedWorkspaceView;
  changeWorkspaceHref: string;
  scopes: ConsentScopeCopy[];
  passthroughScopes: string[];
}) {
  const [granted, setGranted] = useState<string[]>(() =>
    defaultGrantedScopes(scopes),
  );
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState<"allow" | "deny" | null>(null);
  const isSubmitting = pending !== null;
  const allowButtonRef = useRef<HTMLButtonElement>(null);

  // Tombol Izinkan dinonaktifkan selama menyimpan, sehingga fokus keyboard
  // jatuh ke `body`; setelah gagal, kembalikan ke tombol "Coba Lagi" (T-180.3).
  useEffect(() => {
    if (failed && pending === null) {
      allowButtonRef.current?.focus();
    }
  }, [failed, pending]);

  const hostLabel =
    client.hosts.length > 0 ? client.hosts.join(", ") : "host tidak diketahui";
  const hasScopes = scopes.length > 0;
  // Catatan hanya relevan selama izin berdampak belum dicentang (T-180.3).
  const hasUngrantedImpactfulScope = scopes.some(
    (copy) => copy.impactful && !granted.includes(copy.scope),
  );

  function toggle(scope: string, checked: boolean) {
    setGranted((current) =>
      checked
        ? current.includes(scope)
          ? current
          : [...current, scope]
        : current.filter((value) => value !== scope),
    );
  }

  async function respond(accept: boolean) {
    setFailed(false);
    setPending(accept ? "allow" : "deny");

    try {
      if (accept) {
        const choice = await chooseWorkspaceAction(workspace.id);
        if (!choice.ok) {
          setPending(null);
          setFailed(true);
          return;
        }
      }

      const { error } = await authClient.oauth2.consent({
        accept,
        scope: accept
          ? [...granted, ...passthroughScopes].join(" ")
          : undefined,
      });
      if (error) {
        setPending(null);
        setFailed(true);
      }
      // Berhasil: plugin klien mengarahkan kembali ke klien AI; kontrol tetap terkunci.
    } catch {
      // Jaringan putus atau Server Action gagal: tidak ada akses yang diberikan.
      setPending(null);
      setFailed(true);
    }
  }

  const allowButton = (
    <Button
      ref={allowButtonRef}
      type="button"
      variant={client.isUnusual ? "outline" : "default"}
      className="flex-1"
      disabled={isSubmitting || granted.length === 0}
      onClick={() => respond(true)}
    >
      {pending === "allow" ? <Spinner /> : null}
      {pending === "allow"
        ? "Menyimpan…"
        : failed
          ? "Coba Lagi"
          : client.isUnusual
            ? "Saya paham, izinkan"
            : "Izinkan"}
    </Button>
  );
  const denyButton = (
    <Button
      type="button"
      variant={client.isUnusual ? "default" : "outline"}
      className="flex-1"
      disabled={isSubmitting}
      onClick={() => respond(false)}
    >
      Tolak
    </Button>
  );

  return (
    <Card aria-busy={isSubmitting}>
      <CardHeader>
        <OAuthSteps current={2} />
        <ClientHeader
          client={client}
          title={
            client.name === null
              ? clientDisplayName(client)
              : `${client.name} meminta akses`
          }
          description={
            <>
              Mendaftar sendiri ·{" "}
              <span className="font-mono text-xs">{hostLabel}</span>
            </>
          }
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {client.isUnusual ? (
          <Alert variant="destructive">
            <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
            <AlertTitle>
              Postific tidak dapat memastikan siapa pemilik klien ini. Lanjutkan
              hanya bila Anda sendiri yang baru saja menambahkan URL MCP
              Postific ke klien tersebut.
            </AlertTitle>
          </Alert>
        ) : null}

        {failed ? (
          <Alert variant="destructive">
            <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
            <AlertTitle>{SAVE_FAILED_MESSAGE}</AlertTitle>
          </Alert>
        ) : null}

        <Item
          variant="muted"
          size="sm"
          className={cn(isSubmitting && "opacity-60")}
        >
          <ItemContent>
            <ItemDescription className="text-foreground">
              Workspace: <strong>{workspace.name}</strong> ·{" "}
              {workspace.roleLabel}
            </ItemDescription>
          </ItemContent>
          {isSubmitting ? (
            <span className="text-sm text-muted-foreground">Ubah</span>
          ) : (
            <Link
              href={changeWorkspaceHref}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Ubah
            </Link>
          )}
        </Item>

        {/* eslint-disable-next-line no-restricted-syntax -- T-151: komposisi Tailwind shadcn (ADR-097) */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Izin yang diminta</p>
          {hasScopes ? (
            <ItemGroup
              className={cn(
                "gap-2",
                isSubmitting && "pointer-events-none opacity-60",
              )}
            >
              {scopes.map((copy) => (
                <Item
                  key={copy.scope}
                  variant="outline"
                  asChild
                  className="cursor-pointer flex-nowrap"
                >
                  <label htmlFor={copy.scope}>
                    <ItemMedia>
                      <Checkbox
                        id={copy.scope}
                        checked={granted.includes(copy.scope)}
                        disabled={isSubmitting}
                        onCheckedChange={(checked) =>
                          toggle(copy.scope, checked === true)
                        }
                      />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="line-clamp-none flex! w-full flex-wrap">
                        <span className="font-mono text-xs">{copy.code}</span>
                        {copy.title}
                        {copy.impactful ? (
                          <Badge variant="warning" className="ml-auto">
                            Berdampak
                          </Badge>
                        ) : null}
                      </ItemTitle>
                      <ItemDescription className="line-clamp-none">
                        {copy.description}
                      </ItemDescription>
                    </ItemContent>
                  </label>
                </Item>
              ))}
            </ItemGroup>
          ) : (
            <Alert variant="destructive">
              <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
              <AlertTitle>
                Klien ini tidak meminta izin yang dikenal Postific. Tolak dan
                sambungkan ulang dari klien AI.
              </AlertTitle>
            </Alert>
          )}
          {hasUngrantedImpactfulScope ? (
            <p className="text-sm text-muted-foreground">
              Izin Jadwalkan tidak aktif secara bawaan — centang hanya bila Anda
              mengizinkan klien ini menjadwalkan post.
            </p>
          ) : null}
        </div>

        {/* eslint-disable-next-line no-restricted-syntax -- T-151, sama seperti di atas */}
        <div className="flex gap-2">
          {denyButton}
          {allowButton}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Nama klien diberikan oleh klien itu sendiri. Anda bisa mencabut akses
          kapan saja di Settings → Account → Klien AI.
        </p>
      </CardContent>
    </Card>
  );
}
