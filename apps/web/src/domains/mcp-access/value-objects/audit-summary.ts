/**
 * Penyamaran ringkasan input untuk `mcp_audit_logs.input_summary` (BC-04,
 * S-001 § Setiap panggilan tool). Fungsi murni: tidak ada I/O, tanpa jam.
 *
 * Tujuan: audit cukup menjawab "tool apa dipanggil dengan bentuk argumen
 * apa" tanpa menyimpan isi yang sensitif. Aturan (semua dites di
 * `audit-summary.test.ts`):
 *
 * 1. Kunci bernama sensitif (token, secret, password, authorization,
 *    auth, bearer, jwt, session, cookie, signature, credential, dan
 *    apa pun yang berakhiran `key` seperti `apiKey`, `accessKey`,
 *    `privateKey`) -> `[disamarkan]`, apa pun nilainya (lihat
 *    `SENSITIVE_KEY_PATTERN`).
 * 2. Kunci berisi teks bebas (caption, text, body, content, message, reply,
 *    comment, description, note, prompt) -> `[teks N karakter]`; isi tidak
 *    pernah dicatat, berapa pun panjangnya.
 * 3. String yang seluruhnya URL berskema (`skema://...`, http(s) maupun
 *    ftp, redis, dst.) -> hanya `skema://host/path`; user info, query, dan
 *    fragment dibuang. Bila ada query atau fragment, ditulis
 *    `?[disamarkan]` supaya jelas ada yang dibuang.
 * 4. String lain lebih panjang dari `PLAIN_STRING_MAX_LENGTH` -> `[teks N
 *    karakter]` (jaring pengaman: caption di kunci yang namanya tidak
 *    terduga tetap tidak tercatat). String pendek dicatat apa adanya,
 *    dengan URL di dalamnya diperlakukan sesuai aturan 3.
 * 5. Array -> `[N item]`; objek bersarang -> `{N kunci}` (isi tidak dicatat).
 * 6. Hasil dipotong `MCP_AUDIT_SUMMARY_MAX_LENGTH` karakter.
 */

export const MCP_AUDIT_SUMMARY_MAX_LENGTH = 300;

const PLAIN_STRING_MAX_LENGTH = 40;
const URL_PATH_MAX_LENGTH = 60;
const KEY_MAX_LENGTH = 40;
const REDACTED = "[disamarkan]";

/**
 * Diuji terhadap kunci yang sudah dinormalkan (huruf kecil, tanpa `_`/`-`).
 *
 * - `key$`: hanya yang BERAKHIRAN `key` (`key`, `apiKey`, `accessKey`,
 *   `privateKey`, `secret_key`); `keyword` atau `keyId` tidak ikut.
 * - `auth(?!or)`: `auth`, `oauth`, `authToken`, tetapi bukan `author`/
 *   `authorId` (kunci biasa di tool konten).
 * - `session`, `jwt`, `bearer`, `passcode`, `passphrase`: substring; kunci
 *   MVP seperti `workspaceId`, `postId`, `cursor`, `limit`, `platform` tidak
 *   pernah cocok (dites).
 */
const SENSITIVE_KEY_PATTERN =
  /token|secret|password|passwd|passcode|passphrase|authorization|auth(?!or)|bearer|jwt|session|apikey|key$|credential|cookie|signature/;

/** Dibandingkan setelah dinormalkan (huruf kecil, tanpa `_`/`-`). */
const FREE_TEXT_KEYS: ReadonlySet<string> = new Set([
  "caption",
  "text",
  "body",
  "content",
  "message",
  "reply",
  "comment",
  "description",
  "note",
  "notes",
  "prompt",
]);

/** `skema://...` apa pun (bukan hanya http(s)): `ftp://user:pass@h/f` membawa kredensial juga. */
const URL_SCHEME_PREFIX = /^[a-z][a-z0-9+.-]*:\/\//i;
const EMBEDDED_URL_PATTERN = /[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, "");
}

function textPlaceholder(length: number): string {
  return `[teks ${length} karakter]`;
}

/**
 * URL berotoritas (`skema://...`) skema apa pun; `null` untuk string yang
 * bukan URL semacam itu (termasuk `javascript:...` dan `mailto:...`).
 */
function parseSchemeUrl(value: string): URL | null {
  if (!URL_SCHEME_PREFIX.test(value)) {
    return null;
  }
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function sanitizeUrl(url: URL): string {
  const path =
    url.pathname.length > URL_PATH_MAX_LENGTH
      ? `${url.pathname.slice(0, URL_PATH_MAX_LENGTH)}…`
      : url.pathname;
  const hadParams = url.search !== "" || url.hash !== "";
  return `${url.protocol}//${url.host}${path}${hadParams ? `?${REDACTED}` : ""}`;
}

/**
 * Samarkan satu URL (string mentah). Dipakai juga di luar ringkasan input,
 * mis. untuk pesan galat yang menyebut URL. String yang bukan URL berskema
 * dikembalikan `[url]`. User info (`user:pass@`) tidak pernah ikut.
 */
export function redactUrl(value: string): string {
  const url = parseSchemeUrl(value);
  return url ? sanitizeUrl(url) : "[url]";
}

function summarizeString(key: string, value: string): string {
  const normalizedKey = normalizeKey(key);
  if (SENSITIVE_KEY_PATTERN.test(normalizedKey)) {
    return REDACTED;
  }
  if (FREE_TEXT_KEYS.has(normalizedKey)) {
    return textPlaceholder(value.length);
  }
  const url = parseSchemeUrl(value);
  if (url) {
    return sanitizeUrl(url);
  }
  if (value.length > PLAIN_STRING_MAX_LENGTH) {
    return textPlaceholder(value.length);
  }
  const withoutUrls = value.replace(EMBEDDED_URL_PATTERN, (match) =>
    redactUrl(match),
  );
  return JSON.stringify(withoutUrls);
}

function summarizeValue(key: string, value: unknown): string | null {
  if (value === undefined) {
    return null;
  }
  if (SENSITIVE_KEY_PATTERN.test(normalizeKey(key))) {
    return REDACTED;
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return summarizeString(key, value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "[angka]";
  }
  if (typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.length} item]`;
  }
  if (typeof value === "object") {
    return `{${Object.keys(value).length} kunci}`;
  }
  return `[${typeof value}]`;
}

/**
 * Ringkasan tersamar argumen tool, `key=nilai` dipisah `, ` dengan kunci
 * terurut (deterministik). `null` bila tidak ada argumen yang bisa dicatat.
 */
export function summarizeToolInput(input: unknown): string | null {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const parts: string[] = [];
  for (const key of Object.keys(input).sort()) {
    const summary = summarizeValue(
      key,
      (input as Record<string, unknown>)[key],
    );
    if (summary !== null) {
      parts.push(`${key.slice(0, KEY_MAX_LENGTH)}=${summary}`);
    }
  }
  if (parts.length === 0) {
    return null;
  }

  const joined = parts.join(", ");
  return joined.length > MCP_AUDIT_SUMMARY_MAX_LENGTH
    ? `${joined.slice(0, MCP_AUDIT_SUMMARY_MAX_LENGTH - 1)}…`
    : joined;
}
