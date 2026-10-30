/**
 * Identitas klien AI yang ditampilkan di layar persetujuan (T-151, KSP-09-F03).
 * Semua klien mendaftar sendiri (dynamic client registration, ADR-139), jadi
 * nama adalah klaim klien itu sendiri dan TIDAK menjadi dasar kepercayaan.
 * Satu-satunya petunjuk yang bisa dipercaya sedikit lebih jauh adalah host
 * asal redirect URI; itu sebabnya host selalu ditampilkan bersama nama.
 */

/** Data klien terdaftar yang dibutuhkan layar persetujuan. */
export interface McpClientRegistration {
  name: string | null;
  redirectUris: readonly string[];
}

export interface McpClientIdentity {
  /** Nama klaim klien (dirapikan); `null` bila kosong. */
  name: string | null;
  /** Host asal (unik, urut kemunculan); kosong bila tidak ada yang terbaca. */
  hosts: string[];
  /**
   * Klien tanpa nama, atau host yang tidak lazim untuk klien AI publik
   * (localhost, alamat IP, nama internal, http tanpa TLS, host tidak
   * terbaca). Layar memberi peringatan keras dan menjadikan Tolak tombol
   * utama (KSP-09, state "klien tanpa nama atau host tidak lazim").
   */
  isUnusual: boolean;
}

/**
 * Batas nama klaim klien. Nama disimpan di grant dan dibekukan di post, jadi
 * dibatasi ketat di sisi server (registrasi OAuth dinamis tidak tepercaya).
 */
const NAME_MAX_LENGTH = 64;

// Karakter kontrol C0/C1 (termasuk newline, tab), pemisah baris/paragraf Unicode,
// dan karakter format tak terlihat (zero-width, bidi override).
const UNSAFE_CHARS =
  /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2064\ufeff]/g;

const INTERNAL_SUFFIXES = [
  ".local",
  ".localhost",
  ".internal",
  ".lan",
  ".test",
  ".invalid",
  ".example",
];

/**
 * Rapikan nama klaim klien: karakter kontrol/newline dibuang, spasi
 * dirapatkan, dipotong ke `NAME_MAX_LENGTH`; kosong -> `null`. Hanya
 * sanitasi: tidak bisa mencegah klien meniru nama klien lain yang sah.
 */
export function normalizeClientName(
  name: string | null | undefined,
): string | null {
  const collapsed = (name ?? "")
    .replace(UNSAFE_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (collapsed === "") {
    return null;
  }
  return collapsed.length > NAME_MAX_LENGTH
    ? `${collapsed.slice(0, NAME_MAX_LENGTH - 1)}…`
    : collapsed;
}

function isIpLiteral(hostname: string): boolean {
  return hostname.startsWith("[") || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

function isUnusualHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || isIpLiteral(lower)) {
    return true;
  }
  if (!lower.includes(".")) {
    return true;
  }
  return INTERNAL_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

interface RedirectAssessment {
  host: string | null;
  unusual: boolean;
}

function assessRedirectUri(redirectUri: string): RedirectAssessment {
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    return { host: null, unusual: true };
  }
  if (url.hostname === "") {
    return { host: null, unusual: true };
  }
  // http tanpa TLS tidak lazim untuk klien publik; loopback tercakup aturan nama.
  const insecure = url.protocol === "http:";
  return {
    host: url.host,
    unusual: insecure || isUnusualHostname(url.hostname),
  };
}

/**
 * Turunkan identitas tampilan klien dari pendaftarannya. Klien yang tidak
 * ditemukan diperlakukan seperti klien tanpa nama dan tanpa host (tidak
 * lazim), jadi layar tetap aman dipakai.
 */
export function describeMcpClient(
  registration: McpClientRegistration | null,
): McpClientIdentity {
  const name = normalizeClientName(registration?.name);
  const assessments = (registration?.redirectUris ?? []).map(assessRedirectUri);

  const hosts: string[] = [];
  for (const { host } of assessments) {
    if (host !== null && !hosts.includes(host)) {
      hosts.push(host);
    }
  }

  const isUnusual =
    name === null ||
    assessments.length === 0 ||
    assessments.some((assessment) => assessment.unusual);

  return { name, hosts, isUnusual };
}
