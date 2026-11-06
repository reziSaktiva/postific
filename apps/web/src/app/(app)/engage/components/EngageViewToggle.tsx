import { HugeiconsIcon } from "@hugeicons/react";
import {
  LeftToRightListBulletIcon,
  SidebarLeftIcon,
} from "@hugeicons/core-free-icons";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import type { EngageView } from "./engage-model";

/**
 * Toggle By post / List (T-224.1, KSP-06-F09, ADR-157 Q5): `ToggleGroup`
 * single outline sesuai kartu Postific `ScreenEngagePerPosting`. Tidak
 * boleh kosong: klik item yang sedang aktif tidak melepas pilihan.
 */
export function EngageViewToggle({
  value,
  onChange,
}: {
  value: EngageView;
  onChange: (view: EngageView) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={value}
      onValueChange={(next) => {
        if (next === "post" || next === "list") onChange(next);
      }}
      aria-label="Tampilan Engage"
    >
      <ToggleGroupItem value="post" aria-label="By post">
        <HugeiconsIcon icon={SidebarLeftIcon} strokeWidth={2} />
        By post
      </ToggleGroupItem>
      <ToggleGroupItem value="list" aria-label="List">
        <HugeiconsIcon icon={LeftToRightListBulletIcon} strokeWidth={2} />
        List
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
