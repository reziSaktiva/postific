import { describe, expect, it } from "vitest";
import {
  CONSENT_SCOPES,
  defaultGrantedScopes,
  passthroughScopes,
  selectableConsentScopes,
} from "./scope-copy";

describe("consent scope copy", () => {
  it("lists only read, draft, schedule (publish and reply are deferred, ADR-138)", () => {
    expect(CONSENT_SCOPES.map((copy) => copy.code)).toEqual([
      "read",
      "draft",
      "schedule",
    ]);
    expect(CONSENT_SCOPES.map((copy) => copy.scope)).toEqual([
      "mcp:read",
      "mcp:draft",
      "mcp:schedule",
    ]);
  });

  it("marks only schedule as impactful", () => {
    expect(
      CONSENT_SCOPES.filter((copy) => copy.impactful).map((copy) => copy.code),
    ).toEqual(["schedule"]);
  });

  it("shows only requested known scopes in canonical order", () => {
    expect(
      selectableConsentScopes([
        "mcp:schedule",
        "offline_access",
        "mcp:read",
        "mcp:publish",
        "mcp:reply",
      ]).map((copy) => copy.scope),
    ).toEqual(["mcp:read", "mcp:schedule"]);
    expect(selectableConsentScopes(["openid", "offline_access"])).toEqual([]);
  });

  it("checks read and draft by default but never schedule", () => {
    expect(
      defaultGrantedScopes(
        selectableConsentScopes(["mcp:read", "mcp:draft", "mcp:schedule"]),
      ),
    ).toEqual(["mcp:read", "mcp:draft"]);
    expect(
      defaultGrantedScopes(selectableConsentScopes(["mcp:schedule"])),
    ).toEqual([]);
  });

  it("passes offline_access and openid through so refresh tokens keep working", () => {
    expect(
      passthroughScopes(["mcp:read", "offline_access", "openid", "other"]),
    ).toEqual(["offline_access", "openid"]);
  });
});
