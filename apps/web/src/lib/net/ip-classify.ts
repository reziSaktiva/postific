/**
 * Klasifikasi alamat IP murni (tanpa I/O) untuk proteksi SSRF (T-155,
 * ADR-138 § 5). Kebijakan: allow-list alamat unicast global publik; semua
 * rentang khusus (privat, loopback, link-local, CGNAT, multicast, reserved,
 * dokumentasi, metadata cloud) ditolak. Alamat yang tidak bisa diparse
 * dianggap tidak aman (fail closed).
 */

/** Parse IPv4 desimal bertitik ketat (4 oktet 0-255, tanpa nol di depan). */
export function parseIPv4(input: string): number[] | null {
  const parts = input.split(".");
  if (parts.length !== 4) {
    return null;
  }
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^(0|[1-9][0-9]{0,2})$/.test(part)) {
      return null;
    }
    const value = Number(part);
    if (value > 255) {
      return null;
    }
    octets.push(value);
  }
  return octets;
}

/** Parse IPv6 ke 8 grup 16-bit. Menolak zone id (`%`) dan bentuk rusak. */
export function parseIPv6(input: string): number[] | null {
  if (input.includes("%") || !input.includes(":")) {
    return null;
  }
  let text = input;
  const lastColon = text.lastIndexOf(":");
  const tail = text.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = parseIPv4(tail);
    if (!v4) {
      return null;
    }
    const hi = ((v4[0] as number) << 8) | (v4[1] as number);
    const lo = ((v4[2] as number) << 8) | (v4[3] as number);
    text = `${text.slice(0, lastColon + 1)}${hi.toString(16)}:${lo.toString(16)}`;
  }

  const doubleColon = text.indexOf("::");
  if (doubleColon !== text.lastIndexOf("::")) {
    return null;
  }
  const toGroups = (segment: string): number[] | null => {
    if (segment === "") {
      return [];
    }
    const groups: number[] = [];
    for (const part of segment.split(":")) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(part)) {
        return null;
      }
      groups.push(parseInt(part, 16));
    }
    return groups;
  };

  if (doubleColon === -1) {
    const groups = toGroups(text);
    return groups && groups.length === 8 ? groups : null;
  }
  const head = toGroups(text.slice(0, doubleColon));
  const rest = toGroups(text.slice(doubleColon + 2));
  if (!head || !rest || head.length + rest.length > 7) {
    return null;
  }
  return [
    ...head,
    ...new Array<number>(8 - head.length - rest.length).fill(0),
    ...rest,
  ];
}

export function isBlockedIPv4(octets: readonly number[]): boolean {
  const [a, b, c, d] = octets as [number, number, number, number];
  if (a === 255 && b === 255 && c === 255 && d === 255) return true; // broadcast
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // privat
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local + metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // privat
  if (a === 192 && b === 0 && c === 0) return true; // IETF protocol assignments
  if (a === 192 && b === 0 && c === 2) return true; // TEST-NET-1
  if (a === 192 && b === 31 && c === 196) return true; // AS112-v4
  if (a === 192 && b === 52 && c === 193) return true; // AMT
  if (a === 192 && b === 175 && c === 48) return true; // direct delegation AS112
  if (a === 192 && b === 88 && c === 99) return true; // 6to4 relay anycast
  if (a === 192 && b === 168) return true; // privat
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmark
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

function v4FromGroups(hi: number, lo: number): number[] {
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff];
}

export function isBlockedIPv6(g: readonly number[]): boolean {
  const [g0, g1, g2, g3, g4, g5, g6, g7] = g as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];

  // ::/96 (unspecified, loopback, IPv4-compatible) dan ::ffff:0:0/96 (IPv4-mapped).
  const firstFiveZero =
    g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;
  if (firstFiveZero && (g5 === 0 || g5 === 0xffff)) {
    return g5 === 0 ? true : isBlockedIPv4(v4FromGroups(g6, g7));
  }
  // NAT64 64:ff9b::/96: periksa IPv4 yang dibungkus. 64:ff9b:1::/48 (lokal) ditolak.
  if (g0 === 0x64 && g1 === 0xff9b) {
    if (g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
      return isBlockedIPv4(v4FromGroups(g6, g7));
    }
    return true;
  }
  // 6to4 2002::/16: IPv4 ada di grup 1-2.
  if (g0 === 0x2002) {
    return isBlockedIPv4(v4FromGroups(g1, g2));
  }
  // Hanya unicast global 2000::/3 yang diizinkan.
  if ((g0 & 0xe000) !== 0x2000) {
    return true; // termasuk ULA fc00::/7, link-local fe80::/10, multicast ff00::/8
  }
  if (g0 === 0x2001 && g1 === 0x0000) return true; // Teredo 2001::/32
  if (g0 === 0x2001 && g1 === 0x0db8) return true; // dokumentasi
  if (g0 === 0x2001 && g1 >= 0x0001 && g1 <= 0x01ff) return true; // IETF protocol assignments 2001::/23
  if (g0 === 0x3fff && g1 <= 0x0fff) return true; // dokumentasi 3fff::/20
  return false;
}

/**
 * `true` bila alamat TIDAK boleh dituju. String yang bukan IPv4/IPv6 valid
 * juga `true`.
 */
export function isBlockedAddress(address: string): boolean {
  const v4 = parseIPv4(address);
  if (v4) {
    return isBlockedIPv4(v4);
  }
  const v6 = parseIPv6(address);
  if (v6) {
    return isBlockedIPv6(v6);
  }
  return true;
}
