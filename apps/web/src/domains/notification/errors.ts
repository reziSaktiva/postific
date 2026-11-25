/** Domain error classes for notification. */
export class NotificationDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotificationDomainError";
  }
}

/** The paging cursor is malformed or no longer valid (ADR-166). */
export class InvalidNotificationCursorError extends NotificationDomainError {
  constructor() {
    super("Invalid or expired cursor. Start again from the first page.");
    this.name = "InvalidNotificationCursorError";
  }
}
