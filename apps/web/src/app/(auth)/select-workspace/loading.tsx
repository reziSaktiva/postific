import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { OAuthSteps } from "../_mcp-oauth/OAuthSteps";

/**
 * State loading langkah 1 (KSP-09, kartu ScreenOauthConsent 1C): skeleton
 * kartu selama workspace dimuat; tombol terkunci.
 */
export default function SelectWorkspaceLoading() {
  return (
    <Card aria-busy="true">
      <CardHeader>
        <OAuthSteps current={1} />
        {/* eslint-disable-next-line no-restricted-syntax -- T-151: komposisi Tailwind shadcn (ADR-097) */}
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          {/* eslint-disable-next-line no-restricted-syntax -- T-151, sama seperti di atas */}
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-36 w-full" />
        {/* eslint-disable-next-line no-restricted-syntax -- T-151, sama seperti di atas */}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" disabled>
            Batal
          </Button>
          <Button type="button" className="flex-1" disabled>
            Lanjut
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
