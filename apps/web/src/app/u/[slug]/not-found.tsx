import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";

import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/**
 * 404 publik untuk `/u/[slug]` (T-166, rancangan dikonfirmasi King Rezi
 * 2026-10-29: `ScreenStartPageNotFound` di artifact Postific). Menggantikan
 * 404 bawaan Next yang menyuntik `<style>` tanpa nonce (pelanggaran CSP
 * `style-src-elem`, ADR-144). TANPA inline style: hanya class Tailwind.
 *
 * Dipanggil `notFound()` dari `page.tsx` untuk slug yang tidak ada DAN halaman
 * draft; copy sengaja identik agar status draft tidak bocor. Struktur meniru
 * `StartPageProfile` (`main` > `article`, footer badge Opsi B). Tanpa tautan
 * atau tombol ke beranda.
 *
 * `EmptyTitle` merender `div`, jadi dibuat heading level 1 lewat
 * `role="heading"` + `aria-level` (saran a11y di rancangan).
 */
export default function StartPageNotFound() {
  return (
    <main className="flex w-full flex-1 flex-col">
      <article className="mx-auto flex w-full max-w-104 flex-1 flex-col px-4 pt-10 pb-12">
        <Empty className="p-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon
                icon={Search01Icon}
                strokeWidth={2}
                aria-hidden="true"
              />
            </EmptyMedia>
            <EmptyTitle role="heading" aria-level={1}>
              Halaman tidak ditemukan
            </EmptyTitle>
            <EmptyDescription>
              Alamat ini tidak mengarah ke halaman yang tersedia. Periksa
              kembali tautannya, atau hubungi orang yang membagikannya.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>

        <footer className="mt-8 text-center">
          <Badge
            variant="outline"
            className="h-auto bg-card px-3 py-1.5 text-muted-foreground"
          >
            Powered by <b className="font-semibold text-foreground">Postific</b>
          </Badge>
        </footer>
      </article>
    </main>
  );
}
