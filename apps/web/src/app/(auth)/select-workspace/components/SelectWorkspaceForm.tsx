"use client";

import { useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon } from "@hugeicons/core-free-icons";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/better-auth/client";

import { chooseWorkspaceAction } from "../../_mcp-oauth/actions";
import {
  ClientHeader,
  clientDisplayName,
  type OAuthClientView,
} from "../../_mcp-oauth/ClientHeader";
import { OAuthSteps } from "../../_mcp-oauth/OAuthSteps";

export type WorkspaceOption = {
  id: string;
  name: string;
  roleLabel: string;
  connectedAccountCount: number;
};

/**
 * Langkah 1 persetujuan OAuth klien AI (T-151, KSP-09-F01, ADR-139): pilih
 * satu workspace. Pola terkunci King Rezi 2026-10-26: `RadioGroup` dengan
 * tiap baris `Item` variant `outline` berisi `RadioGroupItem`, nama
 * workspace, role, dan jumlah akun. Lanjut menyimpan pilihan di server
 * (`chooseWorkspaceAction`) lalu melanjutkan alur OAuth (`/oauth2/continue`);
 * Batal menolak otorisasi dan mengembalikan pengguna ke klien.
 */
export function SelectWorkspaceForm({
  email,
  client,
  workspaces,
  initialSelectedId,
}: {
  email: string;
  client: OAuthClientView;
  workspaces: WorkspaceOption[];
  initialSelectedId: string | null;
}) {
  const [selected, setSelected] = useState(
    initialSelectedId ?? workspaces[0]?.id ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"continue" | "cancel" | null>(null);
  const isSubmitting = pending !== null;

  const hasWorkspaces = workspaces.length > 0;

  async function handleContinue() {
    setError(null);
    setPending("continue");
    try {
      const result = await chooseWorkspaceAction(selected);
      if (!result.ok) {
        setPending(null);
        setError(result.error);
        return;
      }
      const { error: continueError } = await authClient.oauth2.continue({
        postLogin: true,
      });
      if (continueError) {
        setPending(null);
        setError(continueError.message ?? "Gagal melanjutkan. Coba lagi.");
      }
      // Berhasil: plugin klien menavigasi ke langkah 2; tombol tetap terkunci.
    } catch {
      setPending(null);
      setError("Gagal melanjutkan. Periksa koneksi Anda lalu coba lagi.");
    }
  }

  async function handleCancel() {
    setError(null);
    setPending("cancel");
    try {
      const { error: cancelError } = await authClient.oauth2.consent({
        accept: false,
      });
      if (cancelError) {
        setPending(null);
        setError(cancelError.message ?? "Gagal membatalkan. Coba lagi.");
      }
    } catch {
      setPending(null);
      setError("Gagal membatalkan. Periksa koneksi Anda lalu coba lagi.");
    }
  }

  return (
    <Card aria-busy={isSubmitting}>
      <CardHeader>
        <OAuthSteps current={1} />
        <ClientHeader
          client={client}
          title={`${clientDisplayName(client)} ingin tersambung`}
          description={
            hasWorkspaces
              ? `Pilih workspace yang boleh diakses · ${email}`
              : email
          }
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <Alert variant="destructive">
            <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        ) : null}

        {hasWorkspaces ? (
          // eslint-disable-next-line no-restricted-syntax -- T-151: komposisi Tailwind shadcn (ADR-097)
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium" id="workspace-list-label">
              Workspace
            </p>
            <RadioGroup
              value={selected}
              onValueChange={setSelected}
              disabled={isSubmitting}
              aria-labelledby="workspace-list-label"
            >
              <ItemGroup className="gap-2">
                {workspaces.map((workspace) => {
                  const radioId = `workspace-${workspace.id}`;
                  return (
                    <Item
                      key={workspace.id}
                      variant="outline"
                      asChild
                      className="cursor-pointer flex-nowrap"
                    >
                      <label htmlFor={radioId}>
                        <ItemMedia>
                          <RadioGroupItem id={radioId} value={workspace.id} />
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle>{workspace.name}</ItemTitle>
                          <ItemDescription>
                            {workspace.connectedAccountCount} akun terhubung
                          </ItemDescription>
                        </ItemContent>
                        <ItemActions className="text-sm text-muted-foreground">
                          {workspace.roleLabel}
                        </ItemActions>
                      </label>
                    </Item>
                  );
                })}
              </ItemGroup>
            </RadioGroup>
            <p className="text-sm text-muted-foreground">
              Hanya workspace tempat Anda menjadi anggota aktif. Satu workspace
              per persetujuan; untuk workspace lain, sambungkan lagi.
            </p>
          </div>
        ) : (
          <Empty className="p-0">
            <EmptyHeader>
              <EmptyTitle>
                Anda belum menjadi anggota workspace mana pun
              </EmptyTitle>
              <EmptyDescription>
                Klien AI hanya bisa tersambung ke workspace tempat Anda menjadi
                anggota aktif. Buat workspace atau minta undangan, lalu
                sambungkan lagi dari klien AI.
              </EmptyDescription>
            </EmptyHeader>
            <Button asChild>
              <Link href="/onboarding">Buat Workspace</Link>
            </Button>
          </Empty>
        )}

        {/* eslint-disable-next-line no-restricted-syntax -- T-151: komposisi Tailwind shadcn (ADR-097) */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={isSubmitting}
            onClick={handleCancel}
          >
            Batal
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={isSubmitting || !hasWorkspaces || selected === ""}
            onClick={handleContinue}
          >
            {pending === "continue" ? <Spinner /> : null}
            Lanjut
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
