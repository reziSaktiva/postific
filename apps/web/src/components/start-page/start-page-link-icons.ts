import type { IconSvgElement } from "@hugeicons/react";
import {
  Facebook01Icon,
  GithubIcon,
  InstagramIcon,
  Link01Icon,
  Linkedin01Icon,
  NewTwitterIcon,
  PinterestIcon,
  SpotifyIcon,
  TelegramIcon,
  ThreadsIcon,
  TiktokIcon,
  WhatsappIcon,
  YoutubeIcon,
} from "@hugeicons/core-free-icons";

import type { LinkPlatform } from "@/domains/start-page";

/**
 * Kunci platform tautan (`getLinkPlatform(url)`, domain start-page) -> ikon
 * hugeicons untuk tile ikon kartu tautan Start Page (T-071, Opsi B LOCKED).
 * `Record<LinkPlatform, …>` membuat tipe gagal kompilasi kalau domain
 * menambah platform baru tanpa ikon di sini; `link` adalah ikon generik
 * untuk host yang tidak dikenal.
 *
 * Catatan: ikon di sini monokrom (mewarisi `currentColor`), BUKAN ikon brand
 * berwarna `platform-icons.tsx` (react-icons, ADR-058) — sesuai rancangan
 * Opsi B (`.sp-b-link-icon`, tile netral).
 */
export const LINK_PLATFORM_ICON: Record<LinkPlatform, IconSvgElement> = {
  instagram: InstagramIcon,
  tiktok: TiktokIcon,
  youtube: YoutubeIcon,
  facebook: Facebook01Icon,
  x: NewTwitterIcon,
  linkedin: Linkedin01Icon,
  threads: ThreadsIcon,
  pinterest: PinterestIcon,
  whatsapp: WhatsappIcon,
  telegram: TelegramIcon,
  github: GithubIcon,
  spotify: SpotifyIcon,
  link: Link01Icon,
};
