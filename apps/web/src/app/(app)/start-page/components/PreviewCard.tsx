import { StartPageProfile } from "@/components/start-page/StartPageProfile";
import { START_PAGE_THEME_META } from "@/components/start-page/start-page-theme";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PublicStartPage } from "@/domains/start-page";

/**
 * Card "Preview" Page Editor — LOCKED PATTERN T-072: device frame yang
 * me-reuse struktur Opsi B (LOCKED T-071) apa adanya lewat
 * `StartPageProfile preview`. Preset tema (T-073) diterapkan oleh
 * komponen itu (wrapper scope token) — device frame sendiri tetap netral
 * mengikuti tema aplikasi. Link nonaktif tidak tampil (sudah difilter di
 * `toPreviewPage`).
 */
export function PreviewCard({ page }: { page: PublicStartPage }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        <figure
          aria-label="Pratinjau halaman publik"
          className="mx-auto flex h-115 w-70 flex-col overflow-hidden rounded-4xl border-8 border-foreground bg-foreground shadow-sm"
        >
          <section className="flex flex-1 flex-col overflow-y-auto rounded-3xl">
            <StartPageProfile page={page} preview />
          </section>
        </figure>
        <p className="text-center text-sm text-muted-foreground">
          Struktur diambil persis dari Opsi B — Card Stack. Link nonaktif tidak
          ditampilkan di preview publik.
        </p>
        <p
          className="text-center text-sm text-muted-foreground"
          data-testid="preview-theme-label"
        >
          Preset tema: {START_PAGE_THEME_META[page.theme].label}
        </p>
      </CardContent>
    </Card>
  );
}
