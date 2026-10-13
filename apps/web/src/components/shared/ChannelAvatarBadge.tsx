import type { SocialPlatform } from "@postific/shared";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PLATFORM_ICON } from "@/app/(app)/components/platform-icons";
import { getInitials } from "@/lib/utils/get-initials";
import { cn } from "@/lib/utils";

/**
 * Avatar akun + badge platform kecil di pojok — pola "avatar+badge per-row"
 * yang sebelumnya diduplikasi sebagai fungsi private identik di
 * `sidebar-channels/ChannelsSection.tsx` (`PlatformBadge`) dan
 * `settings/connected-accounts/components/ConnectedAccountsList.tsx`
 * (`PlatformStatusDot`). Diekstrak di T-111.2 (History Detail Dialog,
 * `.history-target-account` di Claude Design) karena T-111.2 dan T-111.4
 * (Post asal Engage, berjalan paralel) sama-sama butuh pola ini per-row —
 * ketiga kalinya akan duplikat kalau tidak diekstrak sekarang.
 *
 * **Scope T-111.2 (sengaja TIDAK migrasi caller lama):** `ChannelsSection`
 * dan `ConnectedAccountsList` TIDAK diubah untuk memakai komponen ini —
 * itu scope creep di luar task ini. Keduanya bisa migrasi ke komponen
 * shared ini di task terpisah nanti.
 *
 * Ukuran 28px/12px (avatar/badge) — LOCKED PATTERN T-111.1 (Claude Design
 * `templates/publish-history-detail.html`, `.channel-avatar`/
 * `.channel-badge`), bukan salah satu size step bawaan `Avatar`
 * (`sm`=24px/`default`=32px/`lg`=40px) — di-override lewat `className`
 * di sini, bukan menambah size step baru ke `avatar.tsx` untuk satu
 * kebutuhan spesifik ini.
 */
export function ChannelAvatarBadge({
  avatarUrl,
  handle,
  platform,
  className,
}: {
  avatarUrl?: string | null;
  handle: string;
  platform: SocialPlatform;
  className?: string;
}) {
  const entry = PLATFORM_ICON[platform];
  const PlatformGlyph = entry?.Icon;

  return (
    // eslint-disable-next-line no-restricted-syntax -- layout-only, konsisten pola shadcn+Tailwind lain (ChannelsSection/ConnectedAccountsList)
    <div className={cn("relative shrink-0", className)}>
      <Avatar className="size-7">
        <AvatarImage src={avatarUrl ?? undefined} alt={handle} />
        <AvatarFallback>{getInitials(handle)}</AvatarFallback>
      </Avatar>
      {PlatformGlyph ? (
        <span
          className="absolute -inset-e-1 -bottom-1 flex size-3 items-center justify-center rounded-full bg-background ring-1 ring-border"
          aria-hidden
        >
          {/* Warna brand asli (bukan token) — pengecualian disengaja, lihat
              komentar di platform-icons.tsx (ADR-058 poin 6 & 10). */}
          <PlatformGlyph size={9} color={entry.color} />
        </span>
      ) : null}
    </div>
  );
}
