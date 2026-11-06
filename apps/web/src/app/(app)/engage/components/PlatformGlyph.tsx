import type { SocialPlatform } from "@postific/shared";

import { cn } from "@/lib/utils";

import { PLATFORM_ICON } from "../../components/platform-icons";

/** Ikon brand platform (ADR-058 poin 6/10: warna brand asli, bukan token). */
export function PlatformGlyph({
  platform,
  size = 14,
  className,
}: {
  platform: SocialPlatform;
  size?: number;
  className?: string;
}) {
  const entry = PLATFORM_ICON[platform];
  if (!entry) return null;
  const { Icon, color } = entry;
  return (
    <Icon
      size={size}
      color={color}
      aria-hidden
      className={cn("shrink-0", className)}
    />
  );
}
