/**
 * Deteksi tipe media dari ISI file (magic bytes), murni tanpa I/O (T-155,
 * ADR-138 § 5). Dipakai jalur yang menerima bytes dari sumber tak tepercaya
 * (tool MCP `upload_media`); header `Content-Type` tidak boleh dipakai untuk
 * keputusan. Hasil selalu salah satu kunci `ALLOWED_MEDIA_MIME_TYPES`, atau
 * `null` bila tidak dikenali.
 */

const MP4_BRANDS = new Set([
  "isom",
  "iso2",
  "iso3",
  "iso4",
  "iso5",
  "iso6",
  "mp41",
  "mp42",
  "mp71",
  "avc1",
  "dash",
  "M4V ",
  "MSNV",
]);

function ascii(bytes: Uint8Array, start: number, end: number): string {
  let out = "";
  for (let i = start; i < end; i++) {
    out += String.fromCharCode(bytes[i] as number);
  }
  return out;
}

function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return (
    bytes.length >= prefix.length && prefix.every((b, i) => bytes[i] === b)
  );
}

export function detectMediaMimeType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (bytes.length >= 6) {
    const sig = ascii(bytes, 0, 6);
    if (sig === "GIF87a" || sig === "GIF89a") {
      return "image/gif";
    }
  }
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp") {
    const boxSize =
      (bytes[0] as number) * 2 ** 24 +
      ((bytes[1] as number) << 16) +
      ((bytes[2] as number) << 8) +
      (bytes[3] as number);
    if (boxSize < 12 && boxSize !== 1) {
      return null;
    }
    const major = ascii(bytes, 8, 12);
    if (major === "qt  ") {
      return "video/quicktime";
    }
    if (MP4_BRANDS.has(major)) {
      return "video/mp4";
    }
    // Brand utama tak dikenal: periksa compatible brands dalam box ftyp.
    const end = Math.min(bytes.length, boxSize === 1 ? 64 : boxSize, 64);
    for (let i = 16; i + 4 <= end; i += 4) {
      if (MP4_BRANDS.has(ascii(bytes, i, i + 4))) {
        return "video/mp4";
      }
    }
  }
  return null;
}
