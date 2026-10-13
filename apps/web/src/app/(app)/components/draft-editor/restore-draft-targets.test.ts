import { ContentFormat } from "@postific/shared";
import { describe, expect, it } from "vitest";
import { restoreDraftTargetSelection } from "./restore-draft-targets";

describe("restoreDraftTargetSelection", () => {
  it("mengisi akun, format, dan opsi Pinterest dari target yang tersimpan", () => {
    expect(
      restoreDraftTargetSelection([
        {
          connectedAccountId: "ig-1",
          contentFormat: ContentFormat.Reel,
        },
        {
          connectedAccountId: "pin-1",
          contentFormat: ContentFormat.Pin,
          platformOptions: {
            pinTitle: "Resep",
            pinLink: "https://example.com",
            boardId: "board-9",
          },
        },
      ]),
    ).toEqual({
      selectedAccountIds: ["ig-1", "pin-1"],
      formatByAccount: {
        "ig-1": ContentFormat.Reel,
        "pin-1": ContentFormat.Pin,
      },
      boardIdByAccount: { "pin-1": "board-9" },
      pinTitle: "Resep",
      pinLink: "https://example.com",
    });
  });

  it("mengembalikan form kosong kalau draft tidak punya target", () => {
    expect(restoreDraftTargetSelection([])).toEqual({
      selectedAccountIds: [],
      formatByAccount: {},
      boardIdByAccount: {},
      pinTitle: "",
      pinLink: "",
    });
  });
});
