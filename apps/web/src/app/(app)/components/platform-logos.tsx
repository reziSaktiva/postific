import Image from "next/image";
import type { IconBaseProps, IconType } from "react-icons";

import { cn } from "@/lib/utils";

/**
 * Logo resmi platform dari kit merek masing-masing (T-209.3, rancangan galeri v20
 * "Ikon platform resmi"). Berkas ada di `public/brand/platforms/`, tidak diubah
 * (tanpa pewarnaan ulang, distorsi, atau efek); PNG hanya diperkecil proporsional.
 * Ketentuan kit merek (Meta, LinkedIn, YouTube) tetap berlaku; keputusan di T-209.
 *
 * Bentuknya kompatibel dengan `IconType` react-icons (`size`, `color`, `className`,
 * `aria-hidden`), jadi pemakai `PLATFORM_ICON[platform].Icon` tidak berubah. `color`
 * diabaikan karena logo resmi tidak boleh diwarnai ulang.
 */
export interface OfficialLogoSpec {
  /** Berkas untuk mode terang. */
  light: string;
  /** Berkas untuk mode gelap; bila kosong, `light` dipakai di kedua mode. */
  dark?: string;
  /** Lebar dibagi tinggi berkas asli. */
  aspect: number;
  /** Ukuran minimum merek (px); di bawahnya platform memakai glif lama. */
  minWidth?: number;
  minHeight?: number;
}

/** Ukuran bawaan react-icons adalah `1em`; tanpa `size` numerik dipakai 16px. */
const DEFAULT_SIZE_PX = 16;

/** Dimensi logo di dalam kotak persegi `size`, mempertahankan rasio asli. */
export function getLogoBox(size: number, aspect: number) {
  return {
    width: aspect >= 1 ? size : size * aspect,
    height: aspect >= 1 ? size / aspect : size,
  };
}

/** `true` bila logo resmi memenuhi ukuran minimum merek pada kotak `size`. */
export function meetsMinimumSize(size: number, spec: OfficialLogoSpec) {
  const { width, height } = getLogoBox(size, spec.aspect);
  return width >= (spec.minWidth ?? 0) && height >= (spec.minHeight ?? 0);
}

/**
 * Komponen ikon yang memakai logo resmi bila ukurannya cukup besar menurut kit
 * merek, selain itu jatuh ke glif lama `Fallback` (keputusan King Rezi 2026-11-12).
 */
export function withOfficialLogo(
  Fallback: IconType,
  spec: OfficialLogoSpec,
): IconType {
  function OfficialLogo(props: IconBaseProps) {
    const size = typeof props.size === "number" ? props.size : DEFAULT_SIZE_PX;
    if (!meetsMinimumSize(size, spec)) {
      return <Fallback {...props} />;
    }
    const { width, height } = getLogoBox(size, spec.aspect);
    const shared = {
      width: Math.round(width * 100) / 100,
      height: Math.round(height * 100) / 100,
      "aria-hidden": true as const,
      unoptimized: true,
    };
    if (!spec.dark) {
      return (
        <Image
          src={spec.light}
          alt=""
          {...shared}
          className={cn("shrink-0", props.className)}
          style={props.style}
        />
      );
    }
    return (
      <>
        <Image
          src={spec.light}
          alt=""
          {...shared}
          className={cn("shrink-0 dark:hidden", props.className)}
          style={props.style}
        />
        <Image
          src={spec.dark}
          alt=""
          {...shared}
          className={cn("hidden shrink-0 dark:block", props.className)}
          style={props.style}
        />
      </>
    );
  }
  OfficialLogo.displayName = "OfficialLogo";
  return OfficialLogo;
}
