import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";

/**
 * Padanan Astryx CheckboxInput/RadioListItem (T-100.2) — shadcn tidak punya
 * primitive gabungan control+label, jadi dipusatkan di sini sekali daripada
 * diulang per pemakaian (Checkbox akun & RadioGroupItem Content Format).
 */
export function LabeledControl({
  htmlFor,
  control,
  children,
}: {
  htmlFor: string;
  control: ReactNode;
  children: ReactNode;
}) {
  return (
    // eslint-disable-next-line no-restricted-syntax -- T-100.2: padanan Astryx CheckboxInput/RadioListItem, murni komposisi Tailwind Checkbox|RadioGroupItem + Label shadcn, tidak punya primitive gabungan.
    <div className="flex items-center gap-2">
      {control}
      <Label htmlFor={htmlFor}>{children}</Label>
    </div>
  );
}
