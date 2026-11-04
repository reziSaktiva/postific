"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import { formatRelativeTime } from "@/lib/utils/format-relative-time";
import { useUserTimeZone } from "@/lib/time/user-time-zone-context";

import type { UnsavedNewPost } from "./Context";

export function ResumeDialog({
  isOpen,
  unsaved,
  onDiscard,
  onResume,
}: {
  isOpen: boolean;
  unsaved: UnsavedNewPost | null;
  onDiscard: () => void;
  onResume: () => void;
}) {
  const timeZone = useUserTimeZone();
  const preview = unsaved
    ? unsaved.caption.length > 60
      ? `${unsaved.caption.slice(0, 60)}…`
      : unsaved.caption
    : "";

  return (
    <Dialog open={isOpen} onOpenChange={() => undefined}>
      <DialogContent
        role="alertdialog"
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Resume unfinished post?</DialogTitle>
          <DialogDescription>
            Ada draft New Post yang belum disimpan dari sesi sebelumnya. Hanya
            caption yang tersimpan; akun dan media perlu dipilih lagi.
          </DialogDescription>
        </DialogHeader>
        {/* eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack/HStack, murni komposisi Tailwind flex, tidak ada primitive shadcn setara. */}
        <div className="flex flex-col gap-3">
          {/* eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex. */}
          <div className="flex flex-col gap-1">
            <Text variant="muted">Caption</Text>
            <Text>{preview || "(kosong)"}</Text>
          </div>
          {/* eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex. */}
          <div className="flex flex-col gap-1">
            <Text variant="muted">Terakhir diedit</Text>
            <Text>
              {unsaved
                ? formatRelativeTime(new Date(unsaved.savedAt), timeZone)
                : "-"}
            </Text>
          </div>
          {/* eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx HStack, murni Tailwind flex. */}
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={onDiscard}>
              Mulai Baru
            </Button>
            <Button onClick={onResume}>Resume</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
