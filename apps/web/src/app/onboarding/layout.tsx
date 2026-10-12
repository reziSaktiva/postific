import type { ReactNode } from "react";

import { Text } from "@/components/ui/text";

// T-097.5: migrasi dari Center/HStack/Text/VStack (@astryxdesign/core) ke
// Tailwind flex langsung, konsisten dengan `app/(auth)/layout.tsx` (T-097.4)
// — dua layout ini sengaja identik strukturnya (beda hanya maxWidth 480 vs
// 400 di layout auth), jadi pola migrasinya juga sama.
export default function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      {/* eslint-disable-next-line no-restricted-syntax -- T-097.5: file ini
          sudah dimigrasi ke komposisi Tailwind shadcn (ADR-097), bukan lagi
          VStack Astryx. */}
      <div className="flex w-full max-w-md flex-col gap-6">
        {/* eslint-disable-next-line no-restricted-syntax -- T-097.5, sama seperti di atas */}
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
