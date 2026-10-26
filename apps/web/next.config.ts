import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_MEDIA_FILE_SIZE_BYTES } from "./src/domains/media/constants";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(appDir, "../..");

// Headroom di atas MAX_MEDIA_FILE_SIZE_BYTES (KI-075) — body POST multipart
// bawa overhead tambahan (boundary/header per-field) di luar byte file
// mentah, jadi limit Next.js harus lebih longgar dari batas aplikasi supaya
// file TEPAT di batas 50MB tidak ditolak Next.js sebelum validasi aplikasi
// sempat jalan.
const SERVER_ACTION_BODY_SIZE_LIMIT_BYTES =
  MAX_MEDIA_FILE_SIZE_BYTES + 5 * 1024 * 1024;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.ngrok-free.app"],
  turbopack: {
    // Pin workspace root so parent lockfiles outside the repo are ignored.
    root: monorepoRoot,
  },
  async headers() {
    // Header keamanan dasar untuk halaman publik Start Page (T-071) dan route
    // redirect klik di bawahnya. CSP penuh sengaja belum dipasang (butuh
    // nonce untuk inline script Next.js); `frame-ancestors` saja menutup
    // clickjacking tanpa risiko merusak render.
    return [
      {
        source: "/u/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      // Diturunkan dari MAX_MEDIA_FILE_SIZE_BYTES (domains/media/validation.ts)
      // + headroom multipart, bukan angka hardcode — Next.js default 1MB
      // memotong upload media sebelum validasi aplikasi sempat jalan (KI-075).
      bodySizeLimit: SERVER_ACTION_BODY_SIZE_LIMIT_BYTES,
    },
  },
};

export default nextConfig;
