/**
 * Worker-pool `map` dengan concurrency terbatas — diekstrak dari
 * `analytics-ingestion.use-case.ts` (dipakai di situ untuk batch
 * `fetchPostMetrics`/`fetchWorkspaceMetrics` paralel terbatas, dan dipakai
 * `classify-imported-post-targets.use-case.ts`, T-132.4 follow-up, untuk
 * alasan yang sama: job runner menganggap job `running` macet setelah 30
 * detik — fetch berurutan untuk puluhan/ratusan post melewati batas itu).
 *
 * Urutan hasil mengikuti urutan `items` (bukan urutan selesai) — `results[index]`
 * ditulis per index asli, bukan di-push saat resolve.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  map: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item === undefined) {
        return;
      }
      results[index] = await map(item);
    }
  }

  const workerCount = Math.min(Math.max(concurrency, 1), items.length);
  if (workerCount === 0) {
    return results;
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
