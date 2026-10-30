/** Jeda sederhana untuk helper E2E yang tidak punya `page` (mis. retry, pemulihan). */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
