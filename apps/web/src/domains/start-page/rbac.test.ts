import { MemberRole } from "@postific/shared";
import { describe, expect, it } from "vitest";
import { AuthorizationError } from "@/lib/utils/errors";
import { assertActorCanManageStartPage } from "./rbac";

describe("assertActorCanManageStartPage", () => {
  it.each([MemberRole.Owner, MemberRole.Admin, MemberRole.Creator])(
    "allows %s",
    (role) => {
      expect(() => assertActorCanManageStartPage(role)).not.toThrow();
    },
  );

  it("rejects an unknown role string (header is cast without runtime validation)", () => {
    expect(() => assertActorCanManageStartPage("viewer" as MemberRole)).toThrow(
      AuthorizationError,
    );
  });
});
