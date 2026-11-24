"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import { retryFailedTargetAction } from "../[postId]/actions";

/**
 * "Coba Lagi" on a failed History card (T-289): retries every failed target
 * of the post one after the other through `retryFailedTargetAction` (T-034.4)
 * and reports the first error. No new rule: each retry is the same action
 * as the one in the History Detail.
 */
export function RetryPostButton({
  postId,
  targetIds,
}: {
  postId: string;
  targetIds: string[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleRetry() {
    startTransition(async () => {
      for (const targetId of targetIds) {
        const result = await retryFailedTargetAction(postId, targetId);
        if (result.error) {
          toast.error(result.error);
          return;
        }
      }
      toast("Percobaan retry selesai — lihat status terbaru di daftar.");
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      disabled={isPending || targetIds.length === 0}
      onClick={handleRetry}
    >
      {isPending ? <Spinner /> : null}
      Coba Lagi
    </Button>
  );
}
