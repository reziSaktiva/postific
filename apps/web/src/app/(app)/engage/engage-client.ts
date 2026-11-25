import type { EngagementInboxItemRecord } from "@/domains/engagement";

import type {
  CommentsPage,
  EngageListParams,
  InboxPostGroupDto,
  PostGroupsPage,
} from "./engage-dto";

/**
 * Pembaca halaman daftar Engage di sisi klien (T-303, ADR-166 addendum 5):
 * `fetch` ke Route Handler GET `/api/engage/*`. Kontrak `loadPage`
 * `useInfiniteList`: melempar pada respons non-OK, badan `{ error }`, atau
 * jawaban yang bukan JSON (mis. sesi habis dan proxy mengarahkan ke
 * /login), sehingga Alert Coba Lagi yang tampil; tidak pernah navigasi.
 */

export interface PostGroupsRequest extends EngageListParams {
  includeEmpty?: boolean;
  /** Satu kelompok: id posting atau "none" ("Tanpa posting"). */
  postId?: string;
  withCounts?: boolean;
}

export interface CommentsRequest extends EngageListParams {
  /** Id posting, "none" ("Tanpa posting"); kosong = semua komentar (List). */
  postId?: string;
  withCounts?: boolean;
  includePostCaptions?: boolean;
}

function listQuery(
  params: EngageListParams,
  cursor: string | null,
): URLSearchParams {
  const query = new URLSearchParams();
  if (params.connectedAccountId)
    query.set("account", params.connectedAccountId);
  if (params.platform) query.set("platform", params.platform);
  if (params.status) query.set("status", params.status);
  if (params.sort) query.set("sort", params.sort);
  if (params.dateRange) query.set("range", params.dateRange);
  if (cursor) query.set("cursor", cursor);
  return query;
}

async function getJson<T>(path: string, query: URLSearchParams): Promise<T> {
  const response = await fetch(`${path}?${query.toString()}`, {
    headers: { Accept: "application/json" },
    // Sesi habis: proxy menjawab redirect ke /login; jangan diikuti diam-diam.
    redirect: "manual",
  });
  const isJson = response.headers.get("content-type")?.includes("json");
  if (!isJson) throw new Error("Daftar tidak dapat dimuat. Coba lagi.");
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok || typeof body.error === "string") {
    throw new Error(body.error ?? "Daftar tidak dapat dimuat. Coba lagi.");
  }
  return body;
}

function date(value: unknown): Date {
  return new Date(value as string);
}

function nullableDate(value: unknown): Date | null {
  return value === null || value === undefined ? null : date(value);
}

/** JSON membawa tanggal sebagai string: pulihkan menjadi `Date`. */
function reviveGroup(group: InboxPostGroupDto): InboxPostGroupDto {
  return {
    ...group,
    latestReceivedAt: nullableDate(group.latestReceivedAt),
    oldestReceivedAt: nullableDate(group.oldestReceivedAt),
  };
}

function reviveComment(
  item: EngagementInboxItemRecord,
): EngagementInboxItemRecord {
  return {
    ...item,
    receivedAt: date(item.receivedAt),
    readAt: nullableDate(item.readAt),
    createdAt: date(item.createdAt),
    updatedAt: date(item.updatedAt),
  };
}

export async function fetchPostGroupsPage(
  request: PostGroupsRequest,
  cursor: string | null,
): Promise<PostGroupsPage> {
  const query = listQuery(request, cursor);
  if (request.includeEmpty) query.set("includeEmpty", "1");
  if (request.postId) query.set("postId", request.postId);
  if (request.withCounts) query.set("counts", "1");
  const page = await getJson<PostGroupsPage>("/api/engage/post-groups", query);
  return { ...page, groups: page.groups.map(reviveGroup) };
}

export async function fetchCommentsPage(
  request: CommentsRequest,
  cursor: string | null,
): Promise<CommentsPage> {
  const query = listQuery(request, cursor);
  if (request.postId) query.set("postId", request.postId);
  if (request.withCounts) query.set("counts", "1");
  if (request.includePostCaptions) query.set("captions", "1");
  const page = await getJson<CommentsPage>("/api/engage/comments", query);
  return { ...page, items: page.items.map(reviveComment) };
}
