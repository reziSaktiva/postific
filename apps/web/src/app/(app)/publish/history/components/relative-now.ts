/**
 * Jam relatif History (KI-052).
 *
 * Hydration memakai stempel server (`renderedAt`). Setelah itu jam browser
 * dipakai, dan listener diberi tahu saat jam itu maju — ganti filter,
 * event Realtime, atau interval — supaya teks "berapa lama yang lalu"
 * tidak terkunci di pembacaan pertama.
 */
const clientNowMsByRenderedAt = new Map<string, number>();
const listeners = new Set<() => void>();

export function subscribeRelativeNow(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function serverRelativeNowMs(renderedAt: string): number {
  return new Date(renderedAt).getTime();
}

export function readClientNowMs(renderedAt: string): number {
  const cached = clientNowMsByRenderedAt.get(renderedAt);
  if (cached !== undefined) {
    return cached;
  }
  const now = Date.now();
  clientNowMsByRenderedAt.set(renderedAt, now);
  return now;
}

export function bumpClientNowMs(renderedAt: string): void {
  clientNowMsByRenderedAt.set(renderedAt, Date.now());
  for (const listener of listeners) {
    listener();
  }
}
