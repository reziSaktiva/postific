/** Domain-specific types for notification (BC-09, domain-model.md). */

import type { NotificationId, UserId, WorkspaceId } from "@postific/shared";
import { NotificationType } from "@postific/shared";

export interface NotificationRecord {
  id: NotificationId;
  workspaceId: WorkspaceId;
  userId: UserId;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: Date;
}
