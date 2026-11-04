"use client";

import { useState } from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import { ViewIcon } from "@hugeicons/core-free-icons";

import type { ContentFormat } from "@postific/shared";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { PLATFORM_ICON } from "../platform-icons";
import { resolveSelectedAccounts } from "./account-selection";
import { FacebookPreview } from "./FacebookPreview";
import {
  FORMAT_LABEL,
  PLATFORM_LABEL,
  getDefaultFormat,
  type ConnectedAccount,
} from "./form-shared";
import { InstagramPreview } from "./InstagramPreview";
import {
  buildPostPreview,
  resolveActivePreviewAccountId,
  type PostPreviewModel,
  type PreviewMediaInput,
} from "./preview-model";
import { VerticalPreview } from "./VerticalPreview";

function PreviewCard({ model }: { model: PostPreviewModel }) {
  switch (model.kind) {
    case "facebook-post":
      return <FacebookPreview model={model} />;
    case "instagram-post":
      return <InstagramPreview model={model} />;
    case "vertical":
      return <VerticalPreview model={model} />;
    case "unavailable":
      // Pratinjau TikTok, Pinterest, dan kartu generik dikerjakan di T-204.
      return (
        <Empty className="rounded-2xl border p-6">
          <EmptyHeader>
            <EmptyTitle className="text-sm">
              Pratinjau {PLATFORM_LABEL[model.platform]} belum tersedia
            </EmptyTitle>
            <EmptyDescription>
              Caption, media, dan jadwal tetap berlaku untuk akun ini.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
  }
}

/**
 * Panel Pratinjau live di sisi kanan Draft Editor (ADR-155, T-203). Seluruh
 * tampilan dihitung di klien dari state form lewat `buildPostPreview`: tanpa
 * request jaringan, jadi ikut berubah saat mengetik atau mengganti media.
 */
export function PreviewPanel({
  selectedAccounts: selectedAccountsInput,
  selectedAccountIds,
  formatByAccount,
  caption,
  mediaItems,
}: {
  selectedAccounts: ConnectedAccount[];
  /**
   * Urutan pilihan (sama dengan urutan chip). Bila diisi, tab Pratinjau
   * mengikuti urutan ini; bila tidak, memakai urutan `selectedAccounts`.
   */
  selectedAccountIds?: string[];
  formatByAccount: Record<string, ContentFormat | undefined>;
  caption: string;
  mediaItems: PreviewMediaInput[];
}) {
  const selectedAccounts = selectedAccountIds
    ? resolveSelectedAccounts(selectedAccountsInput, selectedAccountIds)
    : selectedAccountsInput;
  const [requestedAccountId, setRequestedAccountId] = useState<string | null>(
    null,
  );
  const activeId = resolveActivePreviewAccountId(
    selectedAccounts.map((account) => account.id),
    requestedAccountId,
  );
  const activeAccount =
    selectedAccounts.find((account) => account.id === activeId) ?? null;
  const activeFormat = activeAccount
    ? (formatByAccount[activeAccount.id] ??
      getDefaultFormat(activeAccount.platform))
    : null;

  return (
    <aside
      aria-label="Pratinjau"
      className="hidden min-h-0 w-96 shrink-0 flex-col border-l border-border bg-muted/30 md:flex"
    >
      <header className="flex flex-col gap-2 px-4 pt-3.5 pb-2.5">
        <span className="flex items-baseline justify-between gap-2">
          <h3 className="font-heading text-sm font-semibold">Pratinjau</h3>
          {activeAccount && activeFormat ? (
            <span className="text-xs text-muted-foreground">
              {PLATFORM_LABEL[activeAccount.platform]} ·{" "}
              {FORMAT_LABEL[activeFormat]}
            </span>
          ) : null}
        </span>
        {selectedAccounts.length > 1 && activeId ? (
          <Tabs value={activeId} onValueChange={setRequestedAccountId}>
            <TabsList variant="line" className="h-auto flex-wrap">
              {selectedAccounts.map((account) => {
                const entry = PLATFORM_ICON[account.platform];
                const fullLabel = `${PLATFORM_LABEL[account.platform]} ${account.handle}`;
                return (
                  <TabsTrigger
                    key={account.id}
                    value={account.id}
                    aria-label={fullLabel}
                    title={fullLabel}
                    className="max-w-48"
                  >
                    <entry.Icon size={14} color={entry.color} aria-hidden />
                    <span className="truncate">
                      {PLATFORM_LABEL[account.platform]} · {account.handle}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        ) : null}
      </header>
      <section className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto px-4 pt-1 pb-5">
        {activeAccount && activeFormat ? (
          <>
            <PreviewCard
              model={buildPostPreview({
                account: activeAccount,
                format: activeFormat,
                caption,
                media: mediaItems,
              })}
            />
            <p className="max-w-80 text-center text-xs text-muted-foreground">
              Pratinjau perkiraan. Tampilan asli di{" "}
              {PLATFORM_LABEL[activeAccount.platform]} bisa berbeda sedikit.
            </p>
          </>
        ) : (
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={ViewIcon} strokeWidth={2} />
              </EmptyMedia>
              <EmptyTitle>Pratinjau tampil di sini</EmptyTitle>
              <EmptyDescription>
                Pilih akun tujuan dan tulis caption untuk melihat tampilan post
                di tiap jaringan.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
    </aside>
  );
}
