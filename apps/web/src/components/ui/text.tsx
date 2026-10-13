import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

// shadcn/ui tidak menyediakan komponen Typography/Text resmi — konvensinya
// heading/paragraf ditulis langsung sebagai tag HTML + Tailwind utility
// (lihat MCP `get_item_examples_from_registries` query "typography-demo",
// registry:example @shadcn). Wrapper `Text` ini dibuat T-096.4 supaya kode
// yang bermigrasi dari `@astryxdesign/core/Text` (API berbasis prop) tetap
// punya satu titik pakai konsisten, dengan variant persis classes dari demo
// resmi shadcn di atas (bukan skala baru yang dikarang) — heading pakai
// `font-heading` (Montserrat, T-096.1) mengikuti pola `CardTitle` yang
// sudah digenerate preset Maia.
const textVariants = cva("", {
  variants: {
    variant: {
      h1: "scroll-m-20 font-heading text-4xl font-extrabold tracking-tight text-balance",
      h2: "mt-10 scroll-m-20 border-b border-border pb-2 font-heading text-3xl font-semibold tracking-tight transition-colors first:mt-0",
      h3: "mt-8 scroll-m-20 font-heading text-2xl font-semibold tracking-tight first:mt-0",
      h4: "mt-6 scroll-m-20 font-heading text-xl font-semibold tracking-tight first:mt-0",
      p: "leading-7",
      lead: "text-xl text-muted-foreground",
      large: "text-lg font-semibold",
      small: "text-sm leading-none font-medium",
      muted: "text-sm text-muted-foreground",
    },
  },
  defaultVariants: {
    variant: "p",
  },
});

// Tag HTML default per variant — dipakai kalau `as`/`asChild` tidak diisi,
// supaya heading tetap render sebagai `<h1>`-`<h4>` (semantik + a11y),
// bukan `<div>` generik seperti wrapper Astryx lama.
const defaultTagForVariant: Record<
  NonNullable<VariantProps<typeof textVariants>["variant"]>,
  React.ElementType
> = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  p: "p",
  lead: "p",
  large: "div",
  small: "small",
  muted: "p",
};

function Text({
  className,
  variant = "p",
  asChild = false,
  as,
  ...props
}: React.ComponentProps<"p"> &
  VariantProps<typeof textVariants> & {
    asChild?: boolean;
    as?: React.ElementType;
  }) {
  const resolvedVariant = variant ?? "p";
  const Comp = asChild
    ? Slot.Root
    : (as ?? defaultTagForVariant[resolvedVariant]);

  return (
    <Comp
      data-slot="text"
      data-variant={resolvedVariant}
      className={cn(textVariants({ variant: resolvedVariant, className }))}
      {...props}
    />
  );
}

export { Text, textVariants };
