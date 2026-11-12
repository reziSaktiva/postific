import {
  FaFacebook,
  FaInstagram,
  FaLinkedin,
  FaPinterest,
  FaThreads,
  FaTiktok,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import type { IconType } from "react-icons";

import { SocialPlatform } from "@postific/shared";

import { withOfficialLogo } from "./platform-logos";

const BRAND_DIR = "/brand/platforms";

/**
 * Mapping platform -> ikon brand (react-icons/fa6) + warna brand asli.
 *
 * ADR-058 poin 6: `react-icons` (fa6) dipilih karena Lucide sengaja tidak
 * menyediakan logo bermerek dagang. Warna di sini adalah warna brand resmi
 * tiap platform (bukan token Astryx) — pengecualian yang disengaja per
 * ADR-058 poin 10 ("warna brand tidak berubah"), sama seperti alasan
 * kenapa react-icons dipakai sama sekali.
 *
 * T-209.3: Instagram, Facebook, LinkedIn, YouTube, dan Threads memakai logo
 * resmi (`platform-logos.tsx`) bila ukurannya memenuhi minimum kit merek, selain
 * itu jatuh ke glif react-icons. X, Pinterest, dan TikTok tetap glif react-icons
 * sampai aset resmi mereka ada (T-209.1, T-209.2).
 */
export const PLATFORM_ICON: Record<
  SocialPlatform,
  { Icon: IconType; color: string; colorDark?: string; label: string }
> = {
  [SocialPlatform.Instagram]: {
    Icon: withOfficialLogo(FaInstagram, {
      light: `${BRAND_DIR}/instagram-black.svg`,
      dark: `${BRAND_DIR}/instagram-white.svg`,
      aspect: 1,
    }),
    color: "#E4405F",
    label: "Instagram",
  },
  [SocialPlatform.Facebook]: {
    Icon: withOfficialLogo(FaFacebook, {
      light: `${BRAND_DIR}/facebook.png`,
      aspect: 1,
      minWidth: 16,
    }),
    color: "#1877F2",
    label: "Facebook",
  },
  [SocialPlatform.Twitter]: {
    Icon: FaXTwitter,
    color: "#000000",
    colorDark: "#FFFFFF",
    label: "X (Twitter)",
  },
  [SocialPlatform.LinkedIn]: {
    Icon: withOfficialLogo(FaLinkedin, {
      light: `${BRAND_DIR}/linkedin.png`,
      aspect: 160 / 137,
      minHeight: 21,
    }),
    color: "#0A66C2",
    label: "LinkedIn",
  },
  [SocialPlatform.TikTok]: {
    Icon: FaTiktok,
    color: "#000000",
    colorDark: "#FFFFFF",
    label: "TikTok",
  },
  [SocialPlatform.YouTube]: {
    Icon: withOfficialLogo(FaYoutube, {
      light: `${BRAND_DIR}/youtube.png`,
      aspect: 160 / 136,
    }),
    color: "#FF0000",
    label: "YouTube",
  },
  [SocialPlatform.Threads]: {
    Icon: withOfficialLogo(FaThreads, {
      light: `${BRAND_DIR}/threads-black.svg`,
      dark: `${BRAND_DIR}/threads-white.svg`,
      aspect: 976.98 / 1082,
    }),
    color: "#000000",
    colorDark: "#FFFFFF",
    label: "Threads",
  },
  [SocialPlatform.Pinterest]: {
    Icon: FaPinterest,
    color: "#E60023",
    label: "Pinterest",
  },
};
