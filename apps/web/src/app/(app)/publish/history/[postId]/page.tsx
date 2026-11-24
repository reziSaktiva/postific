import { redirect } from "next/navigation";

import {
  legacyPublishHref,
  type PublishViewSearchParams,
} from "@/domains/publishing";

/**
 * Old address `/publish/history/[postId]` (T-286, S-008), still used by
 * notifications, Home and the MCP surface: lands on List · History with that
 * post open on the single Publish page (see `legacyPublishHref`).
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ postId: string }>;
  searchParams: Promise<PublishViewSearchParams>;
}) {
  const { postId } = await params;
  redirect(legacyPublishHref("history", await searchParams, postId));
}
