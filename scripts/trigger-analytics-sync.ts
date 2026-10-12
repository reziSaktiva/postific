/**
 * T-048.3 — Railway Cron harian untuk JOB-04 Analytics Sync.
 *
 * Fan-out harian yang benar-benar jalan di staging adalah cron menit yang
 * sudah hidup (`railway.cron.json` → `scripts/trigger-job-run.ts`). Route
 * handler men-enqueue analytics paling banyak sekali per hari UTC pada
 * setiap panggilan itu, lalu menjalankan job yang due. File
 * `railway.cron.analytics.json` tidak membuat service Railway sendiri.
 *
 * Script ini memaksa antrian baru lewat `?type=analytics` (verifikasi
 * manual / T-048.4). Job yang masih pending atau running tidak digandakan.
 *
 * Env vars sama dengan `scripts/trigger-job-run.ts`: `JOB_RUNNER_URL`
 * (tanpa query string) dan `JOB_SECRET`.
 */

function analyticsSyncUrl(jobRunnerUrl: string): string {
  const url = new URL(jobRunnerUrl);
  url.searchParams.set("type", "analytics");
  return url.toString();
}

async function main(): Promise<void> {
  const jobRunnerUrl = process.env.JOB_RUNNER_URL;
  const secret = process.env.JOB_SECRET;

  if (!jobRunnerUrl || !secret) {
    console.error(
      "[trigger-analytics-sync] JOB_RUNNER_URL dan/atau JOB_SECRET belum di-set.",
    );
    process.exit(1);
  }

  const url = analyticsSyncUrl(jobRunnerUrl);
  const startedAt = Date.now();
  const response = await fetch(url, {
    method: "POST",
    headers: { "X-Job-Secret": secret },
  });
  const body = await response.text();
  const durationMs = Date.now() - startedAt;

  console.log(
    `[trigger-analytics-sync] POST ${url} -> ${response.status} (${durationMs}ms): ${body}`,
  );

  if (!response.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[trigger-analytics-sync] unexpected error:", error);
  process.exit(1);
});
