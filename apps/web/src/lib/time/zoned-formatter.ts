const cache = new Map<string, Intl.DateTimeFormat>();

/**
 * `Intl.DateTimeFormat` ter-cache per (locale, zona, opsi) untuk tampilan
 * berzona pengguna (T-147). Zona selalu eksplisit — tidak ada default
 * tersembunyi. Opsi `timeZone` diisi dari parameter, bukan dari `options`.
 */
export function getZonedFormatter(
  locale: string,
  options: Omit<Intl.DateTimeFormatOptions, "timeZone">,
  timeZone: string,
): Intl.DateTimeFormat {
  const key = `${locale}|${timeZone}|${JSON.stringify(options)}`;
  let formatter = cache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone });
    cache.set(key, formatter);
  }
  return formatter;
}
