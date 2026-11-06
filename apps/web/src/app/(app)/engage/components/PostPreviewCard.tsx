/* eslint-disable no-restricted-syntax -- T-219: dikomposisi Tailwind langsung di atas shadcn/ui (ADR-097); layout-only, mengikuti kartu Postific ScreenEngagePerPosting */
import type { ConnectedAccountRecord } from "@/domains/workspace";

import { Card, CardContent } from "@/components/ui/card";

import type { InboxPostGroupDto } from "../actions";
import { PLATFORM_ICON } from "../../components/platform-icons";
import { ChannelAvatarBadge } from "@/components/shared/ChannelAvatarBadge";
import { PostThumb } from "./PostThumb";
import { accountLabel } from "./PostCard";

/**
 * Kartu pratinjau posting di atas daftar komentar (T-219.2, KSP-06-F04):
 * thumbnail bila ada, akun, platform, caption terpotong 3 baris, dan tautan
 * "Buka posting" (`platformPostUrl`, perilaku "Go to post" T-056).
 * Tanggal posting belum tampil: snapshot domain belum membawanya.
 */
export function PostPreviewCard({
  group,
  accounts,
}: {
  group: InboxPostGroupDto;
  accounts: ConnectedAccountRecord[];
}) {
  const snapshot = group.postSnapshot;
  const account = accounts.find((a) => a.id === group.connectedAccountId);
  const handle = accountLabel(group, accounts);

  if (!snapshot) {
    return (
      <Card size="sm">
        <CardContent className="text-sm text-muted-foreground">
          Posting asal tidak ditemukan lagi (mungkin sudah dihapus).
        </CardContent>
      </Card>
    );
  }

  return (
    <Card size="sm">
      <CardContent className="flex items-start gap-3 max-md:flex-col">
        {snapshot.thumbnail ? (
          <PostThumb
            thumbnail={snapshot.thumbnail}
            className="size-18 max-md:h-30 max-md:w-full"
          />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <ChannelAvatarBadge
              avatarUrl={account?.avatarUrl}
              handle={handle}
              platform={group.platform}
              className="mr-1"
            />
            <b className="font-semibold text-foreground">{handle}</b>
            <span>{PLATFORM_ICON[group.platform].label}</span>
          </div>
          <p className="line-clamp-3 whitespace-pre-line">
            {snapshot.caption || "(Tanpa caption)"}
          </p>
          {snapshot.platformPostUrl ? (
            <a
              href={snapshot.platformPostUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium underline underline-offset-3"
            >
              Buka posting
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
