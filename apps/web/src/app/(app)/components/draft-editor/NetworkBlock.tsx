import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import NextLink from "next/link";

import { ContentFormat, SocialPlatform } from "@postific/shared";

import { PLATFORM_ICON } from "@/app/(app)/components/platform-icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FieldDescription } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Text } from "@/components/ui/text";

import type { DraftMediaDto } from "./actions";
import { ValidationBanner } from "./FormAlerts";
import type { ConnectedAccount } from "./form-shared";
import {
  FORMAT_LABEL,
  PLATFORM_LABEL,
  getDefaultFormat,
  getSelectableFormats,
  isAccountDisconnected,
} from "./form-shared";
import { LabeledControl } from "./LabeledControl";
import type { NetworkIssue } from "./network-validation";
import { getFormatOptionState } from "./network-validation";
import type { PinterestFieldsValue } from "./PinterestFields";
import { PinterestFields } from "./PinterestFields";

const CONNECTED_ACCOUNTS_HREF = "/settings/connected-accounts";

/**
 * Ringkasan satu blok jaringan (T-202.2): ikon platform, nama dan handle,
 * lencana format, dan, saat blok tertutup, pelanggaran pertama (bila ada)
 * atau cuplikan caption beserta jumlah media. Tanpa thumbnail: tiap baris
 * merender elemen media sendiri akan memuat ulang video sebanyak jumlah
 * akun. Dipakai sebagai isi pemicu akordeon dan sebagai kepala blok
 * statis bila hanya ada satu akun.
 */
export function NetworkBlockSummary({
  account,
  format,
  caption,
  mediaCount,
  showPreview,
  warningMessage,
}: {
  account: ConnectedAccount;
  format: ContentFormat;
  caption: string;
  mediaCount: number;
  /** Cuplikan caption dan jumlah media hanya saat blok tertutup. */
  showPreview: boolean;
  /**
   * Ringkasan pelanggaran blok ini (`summarizeBlockIssues`). Pada blok
   * tertutup teksnya ditampilkan di baris ringkas supaya alasan tombol
   * Schedule/Publish Now nonaktif terlihat tanpa membuka blok.
   */
  warningMessage: string | undefined;
}) {
  const entry = PLATFORM_ICON[account.platform];
  const PlatformGlyph = entry?.Icon;
  const trimmed = caption.trim();
  const snippet =
    trimmed.length === 0
      ? "(caption kosong)"
      : trimmed.length > 60
        ? `${trimmed.slice(0, 60)}…`
        : trimmed;

  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      {PlatformGlyph ? (
        <PlatformGlyph size={16} color={entry.color} aria-hidden />
      ) : null}
      <span className="flex min-w-0 flex-col">
        <span className="font-medium">{PLATFORM_LABEL[account.platform]}</span>
        <span className="truncate text-xs font-normal text-muted-foreground">
          {account.handle}
        </span>
      </span>
      <Badge variant="outline">{FORMAT_LABEL[format]}</Badge>
      {showPreview ? (
        <>
          {warningMessage ? (
            <span className="min-w-0 flex-1 truncate text-xs font-normal text-warning">
              {warningMessage}
            </span>
          ) : (
            <span className="min-w-0 flex-1 truncate text-xs font-normal text-muted-foreground">
              {snippet}
            </span>
          )}
          {mediaCount > 0 ? (
            <span className="shrink-0 text-xs font-normal text-muted-foreground">
              {mediaCount} media
            </span>
          ) : null}
        </>
      ) : (
        <span className="flex-1" />
      )}
      {warningMessage ? (
        <span className="shrink-0 text-warning">
          <HugeiconsIcon
            icon={Alert02Icon}
            strokeWidth={2}
            size={18}
            aria-hidden
          />
          {showPreview ? null : <span className="sr-only">Ada peringatan</span>}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Isi blok jaringan untuk satu akun yang dicentang (T-202.2 sampai T-202.5):
 * banner validasi per jaringan, radio Content Format (ADR-039) dengan opsi
 * tidak sah dinonaktifkan, dan field khusus Pinterest. Caption dan media
 * sama untuk semua jaringan, jadi tidak ada di sini.
 */
export function NetworkBlockBody({
  account,
  checkboxId,
  currentFormat,
  onFormatChange,
  mediaItems,
  issues,
  pinterest,
}: {
  account: ConnectedAccount;
  checkboxId: string;
  currentFormat: ContentFormat | undefined;
  onFormatChange: (format: ContentFormat) => void;
  mediaItems: DraftMediaDto[];
  issues: NetworkIssue[];
  pinterest: PinterestFieldsValue;
}) {
  const formats = getSelectableFormats(account.platform);
  const format = currentFormat ?? getDefaultFormat(account.platform);
  const formatLabelId = `${checkboxId}-format-label`;

  // Teks nonaktif Reel (T-200) ditampilkan sekali di bawah radio, kecuali
  // Reel sedang terpilih: saat itu pesan yang sama sudah tampil sebagai banner.
  const reelState = formats?.includes(ContentFormat.Reel)
    ? getFormatOptionState(account.platform, ContentFormat.Reel, mediaItems)
    : null;
  const showReelReason =
    reelState?.disabled === true && format !== ContentFormat.Reel;

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex.
    <div className="flex flex-col gap-3">
      {isAccountDisconnected(account) ? (
        <Alert variant="destructive">
          <AlertTitle>Akun ini terputus.</AlertTitle>
          <AlertDescription>
            Sambungkan ulang agar post bisa terkirim.{" "}
            <NextLink href={CONNECTED_ACCOUNTS_HREF} className="underline">
              Reconnect
            </NextLink>
          </AlertDescription>
        </Alert>
      ) : null}

      {issues.map((issue) => (
        <ValidationBanner key={issue.code} message={issue.message} />
      ))}

      {formats ? (
        // eslint-disable-next-line no-restricted-syntax -- T-202: baris label+radio, murni Tailwind flex.
        <div className="flex flex-col gap-2">
          <Label id={formatLabelId}>Format</Label>
          <RadioGroup
            aria-labelledby={formatLabelId}
            className="flex flex-row flex-wrap gap-4"
            value={format}
            onValueChange={(value) => onFormatChange(value as ContentFormat)}
          >
            {formats.map((option) => {
              const radioId = `${checkboxId}-format-${option}`;
              const state = getFormatOptionState(
                account.platform,
                option,
                mediaItems,
              );
              return (
                <LabeledControl
                  key={option}
                  htmlFor={radioId}
                  control={
                    <RadioGroupItem
                      value={option}
                      id={radioId}
                      disabled={state.disabled}
                    />
                  }
                >
                  {FORMAT_LABEL[option]}
                </LabeledControl>
              );
            })}
          </RadioGroup>
          {showReelReason ? (
            <FieldDescription>
              Reel nonaktif. {reelState?.reason}
            </FieldDescription>
          ) : null}
        </div>
      ) : account.platform !== SocialPlatform.Pinterest ? (
        <Text variant="muted">Format: Post</Text>
      ) : null}

      {account.platform === SocialPlatform.Pinterest ? (
        <PinterestFields checkboxId={checkboxId} {...pinterest} />
      ) : null}
    </div>
  );
}
