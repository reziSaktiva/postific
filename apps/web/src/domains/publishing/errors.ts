/** Domain error classes for publishing. */
export class PublishingDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishingDomainError";
  }
}

/**
 * A page cursor from the browser that cannot be read, or that belongs to
 * another list: the cursor carries a fingerprint of its tab (statuses and
 * order), workspace and filters, so a Drafts cursor sent with the Approvals
 * tab or another filter is rejected (ADR-166 addendum 5, S-009). The GET Route Handler answers it
 * with an error, so the list shows its Retry Alert instead of wrong items.
 */
export class InvalidPageCursorError extends Error {
  constructor() {
    super("Invalid or expired page cursor. Start again from the first page.");
    this.name = "InvalidPageCursorError";
  }
}
