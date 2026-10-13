import type { UserId } from "@postific/shared";

/** Domain-specific types for identity. */

export interface UserProfileRecord {
  id: UserId;
  name: string;
  email: string;
  image: string | null;
}
