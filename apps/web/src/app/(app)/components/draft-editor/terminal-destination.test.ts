import { ContentStatus } from "@postific/shared";
import { describe, expect, it } from "vitest";

import {
  isAlreadyAtDestination,
  resolveTerminalDestination,
} from "./terminal-destination";

describe("resolveTerminalDestination", () => {
  it("mengarahkan Save as Draft ke Publish > Drafts (ADR-054)", () => {
    expect(resolveTerminalDestination("save-draft")).toBe(
      "/publish?view=list&tab=drafts",
    );
  });

  it("sends a saved post to the tab where it lives: In Review to Approvals, Draft and Ready to Schedule to Drafts (T-297)", () => {
    expect(
      resolveTerminalDestination("save-draft", ContentStatus.InReview),
    ).toBe("/publish?view=list&tab=approvals");
    expect(
      resolveTerminalDestination("save-draft", ContentStatus.ReadyToSchedule),
    ).toBe("/publish?view=list&tab=drafts");
    expect(resolveTerminalDestination("save-draft", ContentStatus.Draft)).toBe(
      "/publish?view=list&tab=drafts",
    );
  });

  it("mengarahkan Ajukan Review ke Publish > List > Approvals (T-296)", () => {
    expect(resolveTerminalDestination("submit-review")).toBe(
      "/publish?view=list&tab=approvals",
    );
  });

  it("mengarahkan Schedule ke Publish > Queue (ADR-054)", () => {
    expect(resolveTerminalDestination("schedule")).toBe(
      "/publish?view=list&tab=queue",
    );
  });

  it("mengarahkan Publish Now ke Publish > Calendar (T-029, ADR-054 — sementara sampai History dibangun)", () => {
    expect(resolveTerminalDestination("publish-now")).toBe(
      "/publish?view=calendar",
    );
  });

  it("keeps the display zone of the current Publish URL (S-008 review)", () => {
    const search = "?view=list&tab=drafts&tz=America%2FNew_York";
    expect(resolveTerminalDestination("schedule", undefined, search)).toBe(
      "/publish?view=list&tab=queue&tz=America%2FNew_York",
    );
    expect(resolveTerminalDestination("submit-review", undefined, search)).toBe(
      "/publish?view=list&tab=approvals&tz=America%2FNew_York",
    );
  });

  it("keeps the Calendar range and date for Publish Now, but no other keys", () => {
    expect(
      resolveTerminalDestination(
        "publish-now",
        undefined,
        "?view=calendar&range=week&date=2026-11-24&tz=Asia%2FTokyo&post=x",
      ),
    ).toBe("/publish?view=calendar&range=week&date=2026-11-24&tz=Asia%2FTokyo");
  });

  it("does not carry Calendar keys into a List destination", () => {
    expect(
      resolveTerminalDestination(
        "save-draft",
        undefined,
        "?view=calendar&range=month&date=2026-11-01",
      ),
    ).toBe("/publish?view=list&tab=drafts");
  });

  it("tujuannya sama dari section manapun — tidak bergantung asal (ADR-053)", () => {
    // Inti T-011.3: CTA sidebar membuat asalnya bisa Home/Engage/Analyze,
    // dan destinasi tidak boleh ikut berubah mengikuti asal itu. Sejak
    // ADR-076 workspace context sudah tidak lagi lewat argumen slug —
    // resolve murni berdasar `action`, jadi cukup dites idempoten.
    expect(resolveTerminalDestination("schedule")).toBe(
      resolveTerminalDestination("schedule"),
    );
  });
});

describe("isAlreadyAtDestination", () => {
  it("true saat pengguna sudah berada di layar tujuan", () => {
    expect(isAlreadyAtDestination("/publish/drafts", "/publish/drafts")).toBe(
      true,
    );
  });

  it("false saat aksi dipicu dari section non-publish", () => {
    expect(isAlreadyAtDestination("/", "/publish/drafts")).toBe(false);
    expect(isAlreadyAtDestination("/analyze", "/publish/queue")).toBe(false);
  });

  it("false saat berada di sub-screen Publish yang berbeda", () => {
    expect(isAlreadyAtDestination("/publish/calendar", "/publish/drafts")).toBe(
      false,
    );
  });

  it("false saat pathname belum tersedia", () => {
    expect(isAlreadyAtDestination(null, "/publish/drafts")).toBe(false);
  });

  it("compares the query on the unified Publish page (S-008)", () => {
    const drafts = "/publish?view=list&tab=drafts";
    expect(
      isAlreadyAtDestination("/publish", drafts, "?view=list&tab=drafts"),
    ).toBe(true);
    // An extra key (display zone, open post) does not move the user away.
    expect(
      isAlreadyAtDestination(
        "/publish",
        drafts,
        "?view=list&tab=drafts&tz=Asia%2FTokyo",
      ),
    ).toBe(true);
    expect(
      isAlreadyAtDestination("/publish", drafts, "?view=list&tab=queue"),
    ).toBe(false);
    expect(isAlreadyAtDestination("/publish", drafts, "?view=calendar")).toBe(
      false,
    );
    expect(isAlreadyAtDestination("/publish", drafts)).toBe(false);
  });
});
