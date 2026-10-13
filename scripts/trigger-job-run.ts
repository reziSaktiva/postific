/**
 * T-027.4 — Railway Cron trigger script.
 *
 * Dijalankan oleh service Railway `cron` (config `railway.cron.json`, DI-D04
 * `deployment-infrastructure.md`) pada jadwal tertentu. Cron service ITU
 * SENDIRI bukan aplikasi Next.js — perannya murni memanggil
 * `POST /api/jobs/run` di service `web` (`background-jobs.md` §
 * "JobRunner Route Handler"), lalu keluar. Bun script (bukan `curl`)
 * dipilih supaya:
 * - Exit code merefleksikan status HTTP (non-2xx → exit 1) — Railway
 *   menandai run cron ini "failed" di dashboard-nya, memberi observability
 *   dasar tanpa infra tambahan (selaras BG-D06/"Monitoring (MVP)").
 * - Konsisten dengan stack repo ini (Bun) — tidak bergantung pada `curl`
 *   tersedia di image Nixpacks Railway.
 *
 * Env vars WAJIB di-set di Railway dashboard, service `cron`, environment
 * yang sama (staging/production):
 * - `JOB_RUNNER_URL` — URL lengkap endpoint job runner service `web` di
 *   environment yang sama, mis.
 *   `https://<web-service>.up.railway.app/api/jobs/run` (atau domain privat
 *   Railway `${{web.RAILWAY_PRIVATE_DOMAIN}}` kalau service `cron` dan
 *   `web` di project Railway yang sama — lebih hemat, tidak keluar publik
 *   internet untuk panggilan internal ini).
 * - `JOB_SECRET` — HARUS identik dengan `JOB_SECRET` yang dipakai service
 *   `web` (dicocokkan Route Handler, T-027.2) — bukan secret baru.
 *
 * **Belum diprovision** — KI-025 (`PROJECT_STATE.md` § Blockers): akun/
 * project Railway belum pernah dibuat sama sekali, jadi env vars di atas
 * dan wiring "Config File Path" = `railway.cron.json` di service `cron`
 * masih perlu dilakukan MANUAL oleh King Rezi di Railway dashboard setelah
 * project itu ada — file ini + `railway.cron.json` hanya menyiapkan
 * config-as-code-nya di repo.
 */

async function main(): Promise<void> {
  const url = process.env.JOB_RUNNER_URL;
  const secret = process.env.JOB_SECRET;

  if (!url || !secret) {
    console.error(
      "[trigger-job-run] JOB_RUNNER_URL dan/atau JOB_SECRET belum di-set — " +
        "lihat komentar di scripts/trigger-job-run.ts untuk env vars yang wajib ada di service Railway `cron`.",
    );
    process.exit(1);
  }

  const startedAt = Date.now();
  const response = await fetch(url, {
    method: "POST",
    headers: { "X-Job-Secret": secret },
  });
  const body = await response.text();
  const durationMs = Date.now() - startedAt;

  console.log(
    `[trigger-job-run] POST ${url} -> ${response.status} (${durationMs}ms): ${body}`,
  );

  if (!response.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[trigger-job-run] unexpected error:", error);
  process.exit(1);
});
