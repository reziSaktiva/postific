import { ContentStatus } from "@postific/shared";
import { describe, expect, it } from "vitest";
import {
  isReadonlyTerminalStatus,
  READONLY_TERMINAL_CONFLICT_MESSAGE,
} from "./readonly-terminal-status";

describe("isReadonlyTerminalStatus", () => {
  it.each([
    ContentStatus.Published,
    ContentStatus.Failed,
    ContentStatus.Imported,
  ])("status %s adalah terminal read-only", (status) => {
    expect(isReadonlyTerminalStatus(status)).toBe(true);
  });

  it.each([
    ContentStatus.Draft,
    ContentStatus.InReview,
    ContentStatus.ReadyToSchedule,
    ContentStatus.Scheduled,
  ])("status %s tetap boleh dimutasi user", (status) => {
    expect(isReadonlyTerminalStatus(status)).toBe(false);
  });

  it("pesan ConflictError satu kalimat dan menyebut ketiga status", () => {
    expect(READONLY_TERMINAL_CONFLICT_MESSAGE).toContain("Published");
    expect(READONLY_TERMINAL_CONFLICT_MESSAGE).toContain("Failed");
    expect(READONLY_TERMINAL_CONFLICT_MESSAGE).toContain("Imported");
    expect(READONLY_TERMINAL_CONFLICT_MESSAGE).toContain("read-only");
  });
});
