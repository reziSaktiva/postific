import { describe, expect, it } from "vitest";
import {
  ContentFormat,
  ContentStatus,
  MemberRole,
  MemberStatus,
} from "./enums";

describe("@postific/shared enums", () => {
  it("exposes canonical content statuses", () => {
    expect(ContentStatus.Draft).toBe("draft");
    expect(ContentStatus.Published).toBe("published");
  });

  it("exposes workspace member roles", () => {
    expect(MemberRole.Owner).toBe("owner");
    expect(MemberRole.Creator).toBe("creator");
  });

  it("exposes workspace member statuses", () => {
    expect(MemberStatus.Pending).toBe("pending");
    expect(MemberStatus.Active).toBe("active");
    expect(MemberStatus.Removed).toBe("removed");
  });

  it("exposes content formats for publish targets", () => {
    expect(ContentFormat.Post).toBe("post");
    expect(ContentFormat.Reel).toBe("reel");
    expect(ContentFormat.Story).toBe("story");
    expect(ContentFormat.Pin).toBe("pin");
  });
});
