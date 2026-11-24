"use client";

import { useRouter } from "next/navigation";

import { useDraftEditor } from "../../../components/draft-editor/Context";

/**
 * PHASE-2 SEAM (T-289, S-008): the one handler where the post preview
 * (T-288) plugs in for a click on a Queue or History card. Today it keeps
 * the behavior of each list: History opens the History Detail of the post
 * (old route, redirected to the single Publish page), Queue opens the Draft
 * Editor like its Edit action. Drafts and Approvals never use it; they open
 * the Draft Editor directly (ADR-165 decision 6).
 */
export function usePostPreviewOpener() {
  const router = useRouter();
  const { openEditDraft } = useDraftEditor();
  return function openPostPreview(post: {
    id: string;
    tab: "queue" | "history";
  }) {
    if (post.tab === "history") {
      router.push(`/publish/history/${post.id}`);
      return;
    }
    openEditDraft(post.id);
  };
}
