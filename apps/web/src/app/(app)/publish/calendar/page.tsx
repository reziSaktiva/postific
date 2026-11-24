import { redirect } from "next/navigation";

import {
  legacyPublishHref,
  type PublishViewSearchParams,
} from "@/domains/publishing";

/**
 * Old address `/publish/calendar` (T-286, S-008): lands on the matching view of
 * the single Publish page, keeping its query (see `legacyPublishHref`).
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<PublishViewSearchParams>;
}) {
  redirect(legacyPublishHref("calendar", await searchParams));
}
