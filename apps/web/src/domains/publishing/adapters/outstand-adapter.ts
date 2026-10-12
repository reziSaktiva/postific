/**
 * Re-export kontrak `IOutstandAdapter` dari `packages/shared` (promosi
 * cross-domain — lihat ADR baru pasca ADR-078, T-041). Dulu didefinisikan
 * langsung di sini (ADR-059 poin 4, "domain publishing satu-satunya
 * pemakai"), sekarang domain `analytics` juga membutuhkannya (T-041) —
 * kontrak dipindah ke lokasi cross-domain supaya `analytics` tidak perlu
 * import lintas domain ke internal `publishing`.
 *
 * File ini dipertahankan sebagai barrel supaya seluruh import relatif yang
 * sudah ada di domain `publishing` (`../adapters/outstand-adapter`) tidak
 * perlu diubah satu per satu.
 */
export type {
  FetchPostMetricsResult,
  FetchWorkspaceMetricsResult,
  ImportedPostData,
  ImportJobHandle,
  ImportJobOutcome,
  ImportJobStatus,
  ImportPostsInput,
  IOutstandAdapter,
  OutstandMetricsPeriod,
  OutstandPostTargetInput,
  OutstandPostTargetStatus,
  PostTargetOutcome,
  PublishNowOutstandPostInput,
  PublishNowOutstandPostResult,
  ScheduleOutstandPostInput,
  ScheduleOutstandPostResult,
} from "@postific/shared";
