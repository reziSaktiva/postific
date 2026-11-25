/**
 * Browser side of the Publish paging Route Handlers (S-009, ADR-166
 * addendum 5). Follows the `loadPage` contract of `useInfiniteList`: it
 * throws on any non-OK answer, a redirect (the session ended: never
 * navigate mid-scroll) or an `{ error }` body, so the list shows its Retry
 * Alert. JSON has no dates, so the date fields of the page items are turned
 * back into `Date` by name.
 */

const DATE_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "scheduledAt",
  "publishedAt",
  "failedAt",
  "fetchedAt",
]);

export function reviveDates(key: string, value: unknown): unknown {
  return DATE_FIELDS.has(key) && typeof value === "string"
    ? new Date(value)
    : value;
}

export async function fetchPublishJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    redirect: "manual",
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Publish page request failed (${response.status})`);
  }
  const body = JSON.parse(await response.text(), reviveDates) as unknown;
  if (typeof body === "object" && body !== null && "error" in body) {
    throw new Error(String((body as { error: unknown }).error));
  }
  return body as T;
}
