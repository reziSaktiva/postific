import { cn } from "@/lib/utils";

/**
 * Penanda dua langkah persetujuan OAuth (KSP-09, rancangan ScreenOauthConsent):
 * "1 Workspace > 2 Izin". Murni tampilan; langkah aktif ditebalkan.
 */
export function OAuthSteps({ current }: { current: 1 | 2 }) {
  return (
    <ol
      aria-label="Langkah persetujuan"
      className="flex items-center gap-2 text-sm text-muted-foreground"
    >
      <li
        aria-current={current === 1 ? "step" : undefined}
        className={cn(current === 1 && "font-semibold text-foreground")}
      >
        1 Workspace
      </li>
      <li aria-hidden="true">›</li>
      <li
        aria-current={current === 2 ? "step" : undefined}
        className={cn(current === 2 && "font-semibold text-foreground")}
      >
        2 Izin
      </li>
    </ol>
  );
}
