import { FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

import type { PinterestBoardState } from "./form-shared";

export interface PinterestFieldsValue {
  pinTitle: string;
  pinLink: string;
  onPinTitleChange: (value: string) => void;
  onPinLinkChange: (value: string) => void;
  /** `undefined` = fetch board belum dimulai untuk akun ini. */
  boardState: PinterestBoardState | undefined;
  boardId: string | undefined;
  onBoardChange: (boardId: string | undefined) => void;
  onRetryBoards: () => void;
}

/** Field khusus Pinterest (judul, link, board) untuk satu akun Pinterest yang dicentang. */
export function PinterestFields({
  checkboxId,
  pinTitle,
  pinLink,
  onPinTitleChange,
  onPinLinkChange,
  boardState,
  boardId,
  onBoardChange,
  onRetryBoards,
}: PinterestFieldsValue & { checkboxId: string }) {
  return (
    // eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex.
    <div className="flex flex-col gap-2">
      <Text variant="muted">Format: Pin</Text>
      <Label htmlFor={`${checkboxId}-pin-title`}>
        Pin Title <span className="text-muted-foreground">(opsional)</span>
      </Label>
      <Input
        id={`${checkboxId}-pin-title`}
        value={pinTitle}
        onChange={(event) => onPinTitleChange(event.target.value)}
      />
      <Label htmlFor={`${checkboxId}-pin-link`}>
        Destination Link{" "}
        <span className="text-muted-foreground">(opsional)</span>
      </Label>
      <Input
        id={`${checkboxId}-pin-link`}
        value={pinLink}
        onChange={(event) => onPinLinkChange(event.target.value)}
      />
      <Label htmlFor={`${checkboxId}-board`}>Board</Label>
      <FieldDescription>
        Wajib. Pin tidak terkirim tanpa board.
      </FieldDescription>
      {(() => {
        if (!boardState) {
          return (
            <Select disabled value="">
              <SelectTrigger id={`${checkboxId}-board`} className="w-full">
                <SelectValue placeholder="Pilih board…" />
              </SelectTrigger>
              <SelectContent />
            </Select>
          );
        }
        if (boardState.status === "loading") {
          return (
            <Select disabled value="">
              <SelectTrigger id={`${checkboxId}-board`} className="w-full">
                <SelectValue placeholder="Memuat board..." />
              </SelectTrigger>
              <SelectContent />
            </Select>
          );
        }
        if (boardState.status === "error") {
          return (
            // eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx HStack, murni Tailwind flex.
            <div className="flex items-center gap-2">
              <Text variant="muted" className="text-destructive">
                {boardState.message}
              </Text>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRetryBoards}
              >
                Coba lagi
              </Button>
            </div>
          );
        }
        return (
          <>
            {boardState.boards.length === 0 ? (
              <FieldDescription>
                Akun ini belum punya board, jadi pin belum bisa dijadwalkan.
              </FieldDescription>
            ) : null}
            <Select
              value={boardId ?? ""}
              onValueChange={(value) => onBoardChange(value || undefined)}
            >
              <SelectTrigger id={`${checkboxId}-board`} className="w-full">
                <SelectValue placeholder="Pilih board…" />
              </SelectTrigger>
              <SelectContent>
                {boardState.boards.map((board) => (
                  <SelectItem key={board.id} value={board.id}>
                    {board.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        );
      })()}
    </div>
  );
}
