import {
  ContentFormat,
  SocialPlatform,
  asConnectedAccountId,
} from "@postific/shared";
import { describe, expect, it } from "vitest";
import type { SchedulePostTargetInput } from "@/domains/publishing/repositories/publishing.repository";
import { ValidationError } from "@/lib/utils/errors";
import { replaceDraftTargets } from "./replace-draft-targets";

function target(connectedAccountId: string): SchedulePostTargetInput {
  return {
    connectedAccountId: asConnectedAccountId(connectedAccountId),
    platform: SocialPlatform.Instagram,
    contentFormat: ContentFormat.Post,
  };
}

function createStore(ownedCount: number) {
  const calls: string[] = [];
  const created: { status: string; connectedAccountId: string }[] = [];
  const store = {
    workspaceConnectedAccount: {
      count: async () => ownedCount,
    },
    publishingPostTarget: {
      deleteMany: async () => {
        calls.push("delete");
      },
      createMany: async (args: {
        data: { status: string; connectedAccountId: string }[];
      }) => {
        created.splice(0, created.length, ...args.data);
        calls.push("create");
      },
    },
  };
  return { store, calls, created };
}

describe("replaceDraftTargets", () => {
  it("menolak akun di luar workspace sebelum menghapus target lama", async () => {
    const { store, calls } = createStore(0);

    await expect(
      replaceDraftTargets(store as never, "workspace-1", "post-1", [
        target("acc-lain"),
      ]),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(calls).toEqual([]);
  });

  it("array kosong menghapus target tersimpan tanpa menulis baris baru", async () => {
    const { store, calls } = createStore(0);

    await replaceDraftTargets(store as never, "workspace-1", "post-1", []);

    expect(calls).toEqual(["delete"]);
  });

  it("mengganti target milik workspace dengan status pending", async () => {
    const { store, calls, created } = createStore(1);

    await replaceDraftTargets(store as never, "workspace-1", "post-1", [
      target("acc-1"),
    ]);

    expect(calls).toEqual(["delete", "create"]);
    expect(created).toEqual([
      expect.objectContaining({
        connectedAccountId: "acc-1",
        status: "pending",
      }),
    ]);
  });
});
