import { describe, expect, it } from "vitest";
import { decideDraftSaveTargets } from "./draft-save-targets";

const instagram = {
  connectedAccountId: "ig-1",
  contentFormat: "reel",
};

describe("decideDraftSaveTargets", () => {
  it("menahan simpan selama daftar akun belum dimuat", () => {
    expect(
      decideDraftSaveTargets({
        accountsLoaded: false,
        selectedAccountIds: ["ig-1"],
        builtTargets: [],
      }),
    ).toEqual({ action: "wait" });
  });

  it("tidak mengirim array kosong kalau akun terpilih belum ketemu di daftar", () => {
    expect(
      decideDraftSaveTargets({
        accountsLoaded: true,
        selectedAccountIds: ["ig-1"],
        builtTargets: [],
      }),
    ).toEqual({ action: "omit" });
  });

  it("mengirim array kosong hanya kalau pengguna memang tidak memilih akun", () => {
    expect(
      decideDraftSaveTargets({
        accountsLoaded: true,
        selectedAccountIds: [],
        builtTargets: [],
      }),
    ).toEqual({ action: "replace", targets: [] });
  });

  it("mengirim akun yang sudah bisa dipetakan", () => {
    expect(
      decideDraftSaveTargets({
        accountsLoaded: true,
        selectedAccountIds: ["ig-1"],
        builtTargets: [instagram],
      }),
    ).toEqual({ action: "replace", targets: [instagram] });
  });
});
