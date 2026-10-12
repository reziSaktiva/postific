import type { ReactNode } from "react";

import { Text } from "@/components/ui/text";

// T-097.4: migrasi dari Center/HStack/Text/VStack (@astryxdesign/core) ke
// Tailwind flex langsung — layout ini cuma wrapper posisi (bukan komponen
// kompleks), jadi Tailwind utility langsung lebih idiomatik daripada
// menambah wrapper baru (ADR-097 poin "Tailwind sebagai styling utama").
// Class `text-on-accent` lama (bridge Astryx) diganti `text-accent-foreground`
// — nama token shadcn yang benar-benar ada di globals.css (tidak ada
// `--on-accent` di theme shadcn, hanya konvensi `-foreground`).
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      {/* eslint-disable-next-line no-restricted-syntax -- T-097.4: file ini
          sudah dimigrasi ke komposisi Tailwind shadcn (ADR-097), bukan lagi
          VStack Astryx. */}
      <div className="flex w-full max-w-sm flex-col gap-6">
        {/* eslint-disable-next-line no-restricted-syntax -- T-097.4, sama seperti di atas */}
        <div className="flex items-center justify-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-accent text-sm font-semibold text-accent-foreground">
            P
          </span>
          <Text variant="small" className="font-semibold">
            Postific
          </Text>
        </div>
        {children}
      </div>
    </main>
  );
}
