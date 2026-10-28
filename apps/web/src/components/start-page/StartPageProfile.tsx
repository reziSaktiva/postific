import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  buildLinkRedirectPath,
  getLinkPlatform,
  parseStartPageTheme,
  type PublicStartPage,
  type PublicStartPageLink,
} from "@/domains/start-page";
import { cn, getInitials } from "@/lib/utils";

import { LINK_PLATFORM_ICON } from "./start-page-link-icons";
import { getStartPageThemeStyle } from "./start-page-theme";

const LINK_CARD_CLASSNAME =
  "flex items-center gap-3 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

function LinkCardContent({
  link,
  preview,
}: {
  link: PublicStartPageLink;
  preview: boolean;
}) {
  return (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <HugeiconsIcon
          icon={LINK_PLATFORM_ICON[getLinkPlatform(link.url)]}
          strokeWidth={2}
          className="size-4"
          aria-hidden="true"
        />
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium wrap-break-word">
        {link.label}
        {preview ? null : <span className="sr-only"> (buka di tab baru)</span>}
      </span>
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        strokeWidth={2}
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </>
  );
}

/**
 * Tampilan publik Start Page (`/u/[slug]`, ADR-128) — Opsi B · Card Stack,
 * LOCKED PATTERN T-071 (Claude Design `templates/start-page-option-b-card-stack.html`,
 * kelas `.sp-b-*`, King Rezi 2026-10-16). Murni presentasi: data sudah
 * disanitasi `GetPublicStartPageBySlug` (url http/https, avatar https).
 *
 * Struktur terkunci: header horizontal (Avatar 56px + judul/bio), tiap tautan
 * = `Card` MANDIRI (border + shadow, berjarak) — BUKAN `Item`/`ItemGroup` —
 * berisi `<a>` penuh dengan tile ikon platform, label, chevron; footer badge
 * "Powered by Postific".
 *
 * Deviasi dari kata-kata rancangan ("Card asChild membungkus <a>"): `Card`
 * (`components/ui/card.tsx`) tidak punya prop `asChild`, jadi `<a>` ditaruh
 * DI DALAM `Card` (padding Card dinolkan, `<a>` yang berpadding sehingga
 * seluruh area kartu tetap bisa diklik). Tampilan identik.
 *
 * `href` selalu `buildLinkRedirectPath` (bukan URL tujuan) supaya klik
 * terhitung (T-074).
 *
 * Tema preset (T-073, LOCKED 2026-10-26): `page.theme` dipetakan ke scope
 * token oleh `getStartPageThemeStyle` (nilai di luar allowlist jatuh ke
 * `default`). Wrapper terluar membawa scope (`dark` / latar primary) dan
 * mengisi penuh area halaman; `default` tanpa class tambahan (ikut tema
 * aplikasi).
 *
 * `preview` (Page Editor, T-072): markup yang sama persis dirender di dalam
 * device frame — wrapper `<section>` (bukan `<main>`, sudah ada di app
 * shell), padding ringkas, dan tautan TANPA `href`/target supaya klik di
 * preview tidak membuka tab maupun menambah hitungan klik.
 */
export function StartPageProfile({
  page,
  preview = false,
}: {
  page: PublicStartPage;
  preview?: boolean;
}) {
  const style = getStartPageThemeStyle(page.theme);
  const Root = preview ? "section" : "main";

  return (
    <Root
      data-sp-theme={parseStartPageTheme(page.theme)}
      className={cn(
        "flex w-full flex-1 flex-col",
        style.wrapper,
        // Preview: preset default tidak punya latar sendiri; device frame
        // (gelap) butuh latar halaman supaya tidak tembus ke bingkai.
        preview && style.wrapper === "" && "bg-background",
      )}
    >
      <article
        className={cn(
          "mx-auto flex w-full max-w-104 flex-1 flex-col",
          preview ? "px-3.5 py-5.5" : "px-4 pt-10 pb-12",
        )}
      >
        <header className="mb-6 flex items-center gap-3">
          <Avatar className="size-14">
            {page.avatarUrl ? (
              <AvatarImage
                src={page.avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
              />
            ) : null}
            <AvatarFallback className={cn("text-lg font-bold", style.avatar)}>
              {getInitials(page.title)}
            </AvatarFallback>
          </Avatar>
          <hgroup className="min-w-0">
            <h1
              className={cn(
                "font-heading text-lg font-bold wrap-break-word",
                style.title,
              )}
            >
              {page.title}
            </h1>
            {page.bio ? (
              <p className={cn("mt-0.5 text-sm wrap-break-word", style.bio)}>
                {page.bio}
              </p>
            ) : null}
          </hgroup>
        </header>

        {page.links.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {page.links.map((link) => (
              <li key={link.id}>
                <Card className="gap-0 rounded-xl py-0 text-card-foreground shadow-sm transition-colors hover:bg-muted/50">
                  {preview ? (
                    <a
                      role="link"
                      aria-disabled="true"
                      tabIndex={-1}
                      className={LINK_CARD_CLASSNAME}
                    >
                      <LinkCardContent link={link} preview />
                    </a>
                  ) : (
                    <a
                      href={buildLinkRedirectPath(page.slug, link.id)}
                      target="_blank"
                      rel="noopener noreferrer nofollow ugc"
                      className={LINK_CARD_CLASSNAME}
                    >
                      <LinkCardContent link={link} preview={false} />
                    </a>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        ) : null}

        <footer className="mt-8 text-center">
          <Badge
            variant="outline"
            className="h-auto bg-card px-3 py-1.5 text-muted-foreground"
          >
            Powered by <b className="font-semibold text-foreground">Postific</b>
          </Badge>
        </footer>
      </article>
    </Root>
  );
}
