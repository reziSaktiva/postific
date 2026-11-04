import { SocialPlatform } from "@postific/shared";
import { describe, expect, it } from "vitest";

import {
  areAllConnectedSelected,
  diffSelection,
  filterAccountsByQuery,
  getConnectionStatus,
  resolveLastUsedIds,
  resolveSelectedAccounts,
  selectAllConnectedIds,
} from "./account-selection";
import type { ConnectedAccount } from "./form-shared";
import { restoreDraftTargetSelection } from "./restore-draft-targets";

function account(
  id: string,
  platform: SocialPlatform,
  handle: string,
  status = "active",
): ConnectedAccount {
  return { id, platform, handle, status };
}

const IG = account("ig", SocialPlatform.Instagram, "@kopi.kita");
const FB = account("fb", SocialPlatform.Facebook, "Kopi Kita Page");
const X = account("x", SocialPlatform.Twitter, "@kopikita", "disconnected");
const ACCOUNTS = [IG, FB, X];

describe("getConnectionStatus", () => {
  it("menandai akun aktif sebagai connected dan selain itu disconnected", () => {
    expect(getConnectionStatus(IG)).toBe("connected");
    expect(getConnectionStatus(X)).toBe("disconnected");
  });
});

describe("selectAllConnectedIds / areAllConnectedSelected", () => {
  it("hanya mengambil akun terhubung", () => {
    expect(selectAllConnectedIds(ACCOUNTS)).toEqual(["ig", "fb"]);
  });

  it("true bila semua akun terhubung terpilih, walau akun Disconnected tidak", () => {
    expect(areAllConnectedSelected(ACCOUNTS, ["ig", "fb"])).toBe(true);
    expect(areAllConnectedSelected(ACCOUNTS, ["fb", "ig", "x"])).toBe(true);
  });

  it("false bila ada akun terhubung yang belum terpilih", () => {
    expect(areAllConnectedSelected(ACCOUNTS, ["ig", "x"])).toBe(false);
    expect(areAllConnectedSelected(ACCOUNTS, [])).toBe(false);
  });

  it("false bila tidak ada akun terhubung sama sekali", () => {
    expect(areAllConnectedSelected([X], ["x"])).toBe(false);
    expect(areAllConnectedSelected([], [])).toBe(false);
  });
});

describe("filterAccountsByQuery", () => {
  it("mengembalikan semua akun untuk query kosong atau spasi", () => {
    expect(filterAccountsByQuery(ACCOUNTS, "")).toEqual(ACCOUNTS);
    expect(filterAccountsByQuery(ACCOUNTS, "   ")).toEqual(ACCOUNTS);
  });

  it("mencocokkan handle tanpa peduli huruf besar/kecil", () => {
    expect(filterAccountsByQuery(ACCOUNTS, "PAGE")).toEqual([FB]);
  });

  it("mencocokkan nama platform", () => {
    expect(filterAccountsByQuery(ACCOUNTS, "instagram")).toEqual([IG]);
  });

  it("mengembalikan daftar kosong bila tidak ada yang cocok", () => {
    expect(filterAccountsByQuery(ACCOUNTS, "tiktok")).toEqual([]);
  });

  it("tetap menampilkan akun Disconnected yang cocok", () => {
    expect(filterAccountsByQuery(ACCOUNTS, "@kopikita")).toEqual([X]);
  });
});

describe("resolveLastUsedIds", () => {
  it("mempertahankan urutan dan membuang duplikat", () => {
    expect(resolveLastUsedIds(ACCOUNTS, ["fb", "ig", "fb"])).toEqual([
      "fb",
      "ig",
    ]);
  });

  it("membuang akun yang sudah tidak ada dan akun Disconnected", () => {
    expect(resolveLastUsedIds(ACCOUNTS, ["gone", "x", "ig"])).toEqual(["ig"]);
  });

  it("kosong bila tidak ada riwayat", () => {
    expect(resolveLastUsedIds(ACCOUNTS, [])).toEqual([]);
  });
});

describe("diffSelection", () => {
  it("memisahkan akun yang ditambah dan dilepas", () => {
    expect(diffSelection(["ig", "fb"], ["fb", "x"])).toEqual({
      added: ["x"],
      removed: ["ig"],
    });
  });

  it("kosong bila pilihan sama", () => {
    expect(diffSelection(["ig"], ["ig"])).toEqual({ added: [], removed: [] });
  });
});

describe("resolveSelectedAccounts (chip) dengan data draft tersimpan", () => {
  it("mengisi chip dari target draft sesuai urutan simpan, termasuk akun Disconnected", () => {
    const restored = restoreDraftTargetSelection([
      { connectedAccountId: "x", contentFormat: "post" },
      { connectedAccountId: "ig", contentFormat: "reel" },
    ]);
    expect(
      resolveSelectedAccounts(ACCOUNTS, restored.selectedAccountIds),
    ).toEqual([X, IG]);
  });

  it("tidak membuat chip untuk akun yang sudah dilepas dari workspace", () => {
    expect(resolveSelectedAccounts(ACCOUNTS, ["gone", "fb"])).toEqual([FB]);
  });
});
