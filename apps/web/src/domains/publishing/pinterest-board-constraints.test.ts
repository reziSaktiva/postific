import { SocialPlatform } from "@postific/shared";
import { describe, expect, it } from "vitest";
import { PublishingDomainError } from "./errors";
import {
  PINTEREST_BOARD_REQUIRED_MESSAGE,
  PINTEREST_ONE_ACCOUNT_MESSAGE,
  assertPinterestBoardConstraints,
  pinterestBoardConstraintMessage,
} from "./pinterest-board-constraints";

describe("pinterestBoardConstraintMessage", () => {
  it("allows a single Pinterest target that has a board", () => {
    expect(
      pinterestBoardConstraintMessage([
        {
          platform: SocialPlatform.Instagram,
          platformOptions: undefined,
        },
        {
          platform: SocialPlatform.Pinterest,
          platformOptions: { boardId: "board-1" },
        },
      ]),
    ).toBeNull();
  });

  it("requires a board when a Pinterest account is selected", () => {
    expect(
      pinterestBoardConstraintMessage([
        {
          platform: SocialPlatform.Pinterest,
          platformOptions: { boardId: "   " },
        },
      ]),
    ).toBe(PINTEREST_BOARD_REQUIRED_MESSAGE);
  });

  it("rejects two Pinterest accounts even when both have boards", () => {
    expect(
      pinterestBoardConstraintMessage([
        {
          platform: SocialPlatform.Pinterest,
          platformOptions: { boardId: "board-a" },
        },
        {
          platform: SocialPlatform.Pinterest,
          platformOptions: { boardId: "board-b" },
        },
      ]),
    ).toBe(PINTEREST_ONE_ACCOUNT_MESSAGE);
  });

  it("assertPinterestBoardConstraints throws PublishingDomainError", () => {
    expect(() =>
      assertPinterestBoardConstraints([{ platform: SocialPlatform.Pinterest }]),
    ).toThrow(PublishingDomainError);
  });
});
