import { describe, expect, it } from "vitest";
import {
  getActionReadiness,
  type ActionReadinessInput,
} from "./action-readiness";

const READY: ActionReadinessInput = {
  isCaptionRequired: true,
  caption: "halo",
  selectedAccountCount: 1,
  scheduleDate: "2030-01-01",
  scheduleTime: "10:00",
  hasBlockingNetworkIssues: false,
  scheduleTimeMessage: null,
};

describe("getActionReadiness", () => {
  it("keduanya aktif bila form lengkap dan sah", () => {
    expect(getActionReadiness(READY)).toEqual({
      isReadyToSchedule: true,
      isReadyToPublishNow: true,
    });
  });

  it("pelanggaran jaringan (mis. Reel tanpa video) menahan Schedule dan Publish Now", () => {
    expect(
      getActionReadiness({ ...READY, hasBlockingNetworkIssues: true }),
    ).toEqual({ isReadyToSchedule: false, isReadyToPublishNow: false });
  });

  it("tanpa akun menahan keduanya", () => {
    expect(getActionReadiness({ ...READY, selectedAccountCount: 0 })).toEqual({
      isReadyToSchedule: false,
      isReadyToPublishNow: false,
    });
  });

  it("caption kosong menahan keduanya hanya bila caption wajib", () => {
    expect(getActionReadiness({ ...READY, caption: "   " })).toEqual({
      isReadyToSchedule: false,
      isReadyToPublishNow: false,
    });
    expect(
      getActionReadiness({ ...READY, caption: "", isCaptionRequired: false }),
    ).toEqual({ isReadyToSchedule: true, isReadyToPublishNow: true });
  });

  it("jadwal kosong atau tidak sah hanya menahan Schedule", () => {
    expect(getActionReadiness({ ...READY, scheduleDate: undefined })).toEqual({
      isReadyToSchedule: false,
      isReadyToPublishNow: true,
    });
    expect(getActionReadiness({ ...READY, scheduleTime: undefined })).toEqual({
      isReadyToSchedule: false,
      isReadyToPublishNow: true,
    });
    expect(
      getActionReadiness({
        ...READY,
        scheduleTimeMessage: "Jadwal sudah lewat",
      }),
    ).toEqual({ isReadyToSchedule: false, isReadyToPublishNow: true });
  });
});
