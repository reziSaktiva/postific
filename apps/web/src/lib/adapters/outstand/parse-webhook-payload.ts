import { createHash } from "node:crypto";
import type { ParsedOutstandWebhookEvent } from "@/domains/publishing";

export interface ParsedOutstandWebhookReceipt {
  /**
   * `outstand_webhook_events.outstand_event_id` (T-026.6, idempotency) —
   * event id vendor kalau payload menyertakannya, else fingerprint
   * deterministik SHA-256 raw body (`integration-layer.md`:336, "jika
   * kontrak delivery tidak menyediakannya, ingestion menggunakan
   * fingerprint deterministik").
   */
  outstandEventId: string;
  event: ParsedOutstandWebhookEvent;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Idempotency (`integration-layer.md`:336) — fingerprint deterministik dari
 * RAW body, dipakai baik untuk payload valid tanpa event id vendor MAUPUN
 * payload yang gagal di-parse sama sekali (JSON.parse melempar) — fungsi
 * ini murni hash string, tidak butuh JSON valid.
 */
export function fingerprintRawBody(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}

/**
 * Parse payload webhook Outstand mentah menjadi bentuk internal
 * `ParsedOutstandWebhookEvent` (T-026, ACL — hanya modul ini yang
 * mengetahui bentuk JSON asli Outstand, domain `publishing` hanya
 * mengenal `ParsedOutstandWebhookEvent`).
 *
 * **Bentuk payload.** `post.published` terverifikasi dari delivery nyata
 * di staging (T-313, 2026-11-27); `account.token_expired` mengikuti contoh
 * di dokumentasi Outstand dan belum pernah terlihat sebagai delivery nyata:
 * ```json
 * { "event": "post.published", "timestamp": "...", "data": { "postId": "outstand-post-id", "orgId": "...", "socialAccounts": [{ "accountId": "...", "network": "instagram" }] } }
 * { "event": "account.token_expired", "data": { "accountId": "outstand-account-id" } }
 * ```
 * `id` root (event id vendor) opsional — delivery nyata tidak
 * menyertakannya, jadi id idempotency jatuh ke fingerprint raw body.
 * `event` (event type) wajib. `data.postId` (fallback `data.id`) dan
 * `data.accountId` diekstrak sesuai event type yang relevan.
 *
 * Throws kalau payload bukan JSON valid, bukan objek, atau tidak punya
 * field `event` — caller (route handler) menangkap ini dan tetap
 * mem-persist receipt (pakai fingerprint raw body sebagai id) supaya
 * durable-before-ACK tetap terpenuhi, lalu menandai receipt `failed` tanpa
 * memproses lebih lanjut.
 */
export function parseOutstandWebhookPayload(
  rawBody: string,
): ParsedOutstandWebhookReceipt {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    throw new Error("Payload webhook Outstand bukan JSON valid.");
  }

  if (!isRecord(json)) {
    throw new Error("Payload webhook Outstand harus berupa objek JSON.");
  }

  const eventType = typeof json.event === "string" ? json.event : undefined;
  if (!eventType) {
    throw new Error('Payload webhook Outstand tidak punya field "event".');
  }

  const data = isRecord(json.data) ? json.data : {};
  // Real `post.*` deliveries carry the post id in `data.postId` (T-313,
  // observed on staging 2026-11-27). `data.id` is kept as a fallback for the
  // shape this parser was first written against.
  const outstandPostId =
    typeof data.postId === "string" && data.postId.length > 0
      ? data.postId
      : typeof data.id === "string"
        ? data.id
        : undefined;
  const outstandAccountId =
    typeof data.accountId === "string" ? data.accountId : undefined;

  const vendorEventId =
    typeof json.id === "string" && json.id.length > 0 ? json.id : undefined;
  const outstandEventId = vendorEventId ?? fingerprintRawBody(rawBody);

  return {
    outstandEventId,
    event: { eventType, outstandPostId, outstandAccountId },
  };
}
