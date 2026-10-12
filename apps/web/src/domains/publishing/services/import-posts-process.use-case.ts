import type {
  ConnectedAccountId,
  ImportedPostData,
  SocialPlatform,
  UserId,
  WorkspaceId,
} from "@postific/shared";
import type {
  ImportedPostTargetInput,
  IPublishingRepository,
  UpsertImportedPostsResult,
} from "../repositories/publishing.repository";

/**
 * Import Posts dari Social Account (T-090.4, ADR-093 poin 3-4, 7) — Use
 * Case terpisah dari `ImportPostsTriggerUseCase` (pola sama
 * `OutstandWebhookProcessor` vs Route Handler webhook: pemisah "trigger"
 * dari "processing", JOB-05 vs JOB-06 di `background-jobs.md`). Dipanggil
 * SINKRON setelah `IOutstandAdapter.fetchImportJobStatus` resolve
 * `status: "completed"` — berbeda dari `OutstandWebhookProcessor` yang
 * dipicu webhook Route Handler, use-case ini dipicu LANGSUNG oleh
 * `ImportPostsTriggerUseCase` karena Fake adapter (ADR-059) instan (tidak
 * ada webhook `import.completed` sungguhan untuk dimenungkan — real adapter
 * T-025 nanti yang akan benar-benar memisahkan trigger dari processing
 * lewat webhook/polling, use-case ini tetap sama, hanya CALLER-nya yang
 * berubah — pola gap yang sama dengan catatan T-027 di
 * `OutstandWebhookProcessor`).
 *
 * TIDAK mengimpor `IOutstandAdapter` sama sekali (beda dari
 * `ImportPostsTriggerUseCase`) — murni menerima `ImportedPostData[]` yang
 * sudah di-resolve caller, konsisten AGENTS.md #6 (domain tidak perlu tahu
 * ACL kalau tidak melakukan network call sendiri).
 */
export interface ImportPostsProcessInput {
  workspaceId: WorkspaceId;
  connectedAccountId: ConnectedAccountId;
  platform: SocialPlatform;
  posts: ImportedPostData[];
  /** RLS (`publishing_posts_workspace_isolation` di-scope ke membership workspace, BUKAN authorId post — post Imported authorId-nya selalu null). */
  actingUserId: UserId;
}

export class ImportPostsProcessUseCase {
  constructor(private readonly repository: IPublishingRepository) {}

  async process(
    input: ImportPostsProcessInput,
  ): Promise<UpsertImportedPostsResult> {
    const posts: ImportedPostTargetInput[] = input.posts.map((post) => ({
      connectedAccountId: input.connectedAccountId,
      platform: input.platform,
      platformPostId: post.platformPostId,
      platformPostUrl: post.platformPostUrl,
      caption: post.caption,
      publishedAt: post.publishedAt,
      mediaUrls: post.mediaUrls,
    }));

    return this.repository.upsertImportedPosts(
      { workspaceId: input.workspaceId, posts },
      input.actingUserId,
    );
  }
}
