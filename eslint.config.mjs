import path from "node:path";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginTailwindcss from "eslint-plugin-tailwindcss";

// ADR-095 follow-up (review Ridwan, 2026-08-28): 2 custom rule lokal untuk
// menutup known-limitation `no-restricted-imports`/`tailwindcss/no-arbitrary-value`
// bawaan (dynamic import dan arbitrary-value yang disimpan di variabel
// terpisah tidak terjangkau rule standar). Tidak butuh dependency baru.
// Diekstrak ke ./eslint-rules/local-rules.mjs (bukan inline di sini) supaya
// bisa diuji lewat ESLint RuleTester — lihat eslint-rules/local-rules.test.ts.
import {
  localRules,
  RESTRICTED_IMPORTS_CONFIG,
} from "./eslint-rules/local-rules.mjs";

/** Flat ESLint config for the monorepo (apps/web + packages/shared). */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  eslintConfigPrettier,
  {
    settings: {
      next: {
        rootDir: "apps/web/",
      },
    },
  },
  {
    // KI-012 follow-up: menangkap Tailwind arbitrary-value yang punya
    // padanan utility canonical (mis. `start-[calc(var(--spacing-4)*-1)]`
    // seharusnya `-start-4`), supaya tidak lolos manual review lagi.
    files: ["apps/web/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"],
    extends: [eslintPluginTailwindcss.configs.recommended],
    plugins: { local: localRules },
    settings: {
      tailwindcss: {
        // Path absolut: plugin me-resolve cssConfigPath relatif ke direktori
        // tiap file yang di-lint (bukan cwd), jadi path relatif tidak stabil
        // lintas kedalaman folder — harus absolut.
        cssConfigPath: path.resolve(
          import.meta.dirname,
          "apps/web/src/app/globals.css",
        ),
      },
    },
    rules: {
      // Astryx tailwind bridge pakai custom utilities (mis. bg-surface,
      // text-primary) yang bukan bagian dari Tailwind core — matikan rule
      // yang menganggapnya "unknown class" sampai ada cara whitelist token
      // Astryx secara resmi ke plugin ini.
      "tailwindcss/no-custom-classname": "off",
      // ADR-095: `off` secara default di preset recommended — diaktifkan
      // untuk menegakkan larangan arbitrary-value spacing/style di
      // design-tokens.md § Spacing. Rule ini all-or-nothing (tidak bisa
      // di-scope hanya ke prefix spacing), jadi 5 pemakaian token-backed
      // yang legit (transition/shadow, bukan magic number) di 2 file
      // (`ChannelsSection.tsx`, `ConnectedAccountsList.tsx`) diberi
      // `eslint-disable-next-line` + alasan inline per lokasi.
      // Known limitation (temuan review Ridwan, 2026-08-28): rule ini
      // hanya menganalisis string literal langsung di atribut
      // `className`/`class` (termasuk di dalam `cn(...)`) — arbitrary-value
      // yang ditaruh di `const` terpisah lalu diinterpolasi (mis.
      // `TRANSITION_FAST` di `ChannelsSection.tsx`, 2 instans arbitrary
      // value di dalamnya) TIDAK terjangkau sama sekali, jadi bukan celah
      // yang butuh disable comment — tapi juga bukan celah yang tertutup
      // rule ini kalau ada magic-number baru ditaruh dengan pola yang sama.
      "tailwindcss/no-arbitrary-value": "error",
      // Menutup celah di atas: custom rule lokal yang menganalisis
      // deklarasi/assignment variabel, bukan hanya atribut className.
      "local/no-arbitrary-value-in-variable": "error",
    },
  },
  {
    // ADR-095: menegakkan AGENTS.md rule 6 — domain logic tidak boleh
    // import Prisma/Supabase/implementasi repository-adapter langsung.
    // Diverifikasi 0 pelanggaran existing sebelum diaktifkan sebagai error.
    // `local/no-dynamic-restricted-import` menutup celah dynamic import
    // yang tidak terjangkau `no-restricted-imports` (temuan review Ridwan,
    // 2026-08-28). Re-export pass-through tidak langsung via file
    // perantara tetap tidak terjangkau — masih known limitation, karena
    // butuh analisis lintas-file yang tidak dilakukan lint per-file.
    files: ["apps/web/src/domains/**/*.{ts,tsx}"],
    plugins: { local: localRules },
    rules: {
      "local/no-dynamic-restricted-import": "error",
      "no-restricted-imports": ["error", RESTRICTED_IMPORTS_CONFIG],
    },
  },
  {
    // ADR-095: menegakkan apps/web/.claude/CLAUDE.md — "No <div>, komponen
    // yang menangani seluruh layout/spacing". Diverifikasi 0 pelanggaran
    // existing sebelum diaktifkan sebagai error. Aturan ini era-Astryx
    // (props layout VStack/HStack/Stack/Grid/Box) — ADR-097 poin 4 (migrasi
    // shadcn/ui) sudah memutuskan "aturan lint ... disesuaikan ke konvensi
    // shadcn", jadi `apps/web/src/components/ui/**` (satu-satunya direktori
    // output CLI/MCP shadcn, lihat alias `ui` di components.json)
    // dikecualikan di bawah — setiap komponen shadcn (Card, Dialog, dst.)
    // memang dikomposisi dari `<div>` Tailwind langsung, bukan wrapper
    // layout Astryx.
    files: ["apps/web/src/app/**/*.tsx", "apps/web/src/components/**/*.tsx"],
    ignores: ["apps/web/src/components/ui/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='div']",
          message:
            "Jangan pakai <div> mentah — pakai komponen layout Astryx (VStack/HStack/Stack/Grid/Box), kecuali file ini sudah dimigrasi ke shadcn/ui (ADR-097) dan boleh dikomposisi Tailwind langsung. Lihat apps/web/.claude/CLAUDE.md.",
        },
      ],
    },
  },
  {
    // Sama seperti override di atas — komponen shadcn CLI-generated di
    // `components/ui/**` juga rutin memakai Tailwind arbitrary-value untuk
    // hal yang belum punya padanan utility canonical (mis. `ring-[3px]`,
    // `max-w-[calc(100%-2rem)]`, `grid-cols-[1fr_auto]`) — pola yang sama
    // persis dengan yang sudah diberi `eslint-disable-next-line` manual di
    // `button.tsx` sejak T-095.1. Dikecualikan di level direktori (bukan
    // disable per baris) supaya `shadcn add`/CLI update berikutnya tidak
    // butuh anotasi ulang setiap kali file di-regenerate.
    files: ["apps/web/src/components/ui/**/*.tsx"],
    rules: {
      "tailwindcss/no-arbitrary-value": "off",
    },
  },
  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/out/**",
    "**/dist/**",
    "**/coverage/**",
    "apps/web/next-env.d.ts",
    "apps/web/src/generated/**",
    "product-discovery/**",
    "project-os/**",
    // Skill vendor/custom (ADR-064) — bukan kode project, jangan di-lint.
    ".claude/**",
  ]),
]);

export default eslintConfig;
