/* eslint-disable no-restricted-syntax -- T-219: dikomposisi Tailwind langsung di atas shadcn/ui (ADR-097); layout-only, mengikuti kartu Postific ScreenEngagePerPosting */
import { HugeiconsIcon } from "@hugeicons/react";
import { Comment01Icon, Tick02Icon } from "@hugeicons/core-free-icons";

import type { ConnectedAccountRecord } from "@/domains/workspace";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import type { InboxPostGroupDto } from "../actions";
import { PLATFORM_ICON } from "../../components/platform-icons";
import { handledPercent } from "./engage-model";
import { PlatformGlyph } from "./PlatformGlyph";
import { PostThumb } from "./PostThumb";

export const NO_POST_CARD_TEXT =
  "Komentar yang tidak terhubung ke posting di Postific";

/** Nama akun kartu/pratinjau: handle akun terkoneksi, atau nama platform bila akun sudah tidak ada. */
export function accountLabel(
  group: Pick<InboxPostGroupDto, "connectedAccountId" | "platform">,
  accounts: ConnectedAccountRecord[],
): string {
  return (
    accounts.find((account) => account.id === group.connectedAccountId)
      ?.handle ?? PLATFORM_ICON[group.platform].label
  );
}

/**
 * Kartu posting di panel kiri (T-216 keputusan #5: kustom dari `Card`,
 * `Badge`, `Progress`). Seluruh kartu bisa diklik lewat tombol berjudul
 * yang diperluas (`after:absolute after:inset-0`), jadi fokus keyboard dan
 * pembaca layar mendapat satu kontrol nyata, bukan `div` ber-onClick.
 */
export function PostCard({
  group,
  accounts,
  selected,
  onSelect,
}: {
  group: InboxPostGroupDto;
  accounts: ConnectedAccountRecord[];
  selected: boolean;
  onSelect: () => void;
}) {
  const snapshot = group.postSnapshot;
  const isNoPost = group.postId === null;
  const label = isNoPost ? "Tanpa posting" : accountLabel(group, accounts);
  const caption = isNoPost
    ? NO_POST_CARD_TEXT
    : snapshot?.caption || "(Tanpa caption)";
  const percent = handledPercent(group);

  return (
    <Card
      size="sm"
      data-selected={selected}
      className={cn(
        "relative shrink-0 gap-2 py-2.5 transition-colors hover:bg-muted/45",
        selected && "bg-muted/55 ring-2 ring-ring",
      )}
    >
      <CardContent className="flex flex-col gap-2 px-3">
        <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
          {isNoPost ? (
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <HugeiconsIcon icon={Comment01Icon} className="size-3" />
            </span>
          ) : (
            <PlatformGlyph platform={group.platform} />
          )}
          <button
            type="button"
            onClick={onSelect}
            aria-current={selected ? "true" : undefined}
            className="min-w-0 truncate text-left outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {label}
          </button>
        </div>
        <div className="flex items-start gap-2.5">
          <p className="line-clamp-2 min-w-0 flex-1 text-sm leading-snug">
            {caption}
          </p>
          {!isNoPost && snapshot?.thumbnail ? (
            <PostThumb thumbnail={snapshot.thumbnail} className="size-12" />
          ) : null}
        </div>
        <div className="flex items-center gap-2.5">
          <Progress
            value={percent}
            className="h-1 flex-1"
            aria-label={`${group.handledCount} dari ${group.totalCount} komentar ditangani`}
          />
          {group.unrepliedCount > 0 ? (
            <Badge aria-label={`${group.unrepliedCount} belum dibalas`}>
              {group.unrepliedCount}
            </Badge>
          ) : group.totalCount > 0 ? (
            <span
              className="flex size-5 items-center justify-center text-success"
              role="img"
              aria-label="Semua komentar sudah ditangani"
            >
              <HugeiconsIcon icon={Tick02Icon} className="size-3.5" />
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">0</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
