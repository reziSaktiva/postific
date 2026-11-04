import { ContentStatus } from "@postific/shared";
import { describe, expect, it } from "vitest";

import {
  FOOTER_HELP_NO_ACCOUNT,
  countFooterWarnings,
  getFooterActions,
  getFooterHelpText,
  isEditableInDraftEditor,
  type FooterActionsInput,
} from "./footer-actions";

const IDLE: FooterActionsInput = {
  readiness: { isReadyToSchedule: true, isReadyToPublishNow: true },
  isSavingDraft: false,
  isScheduling: false,
  isPublishingNow: false,
  isLoadingAccounts: false,
};

describe("getFooterActions", () => {
  it("semua aksi aktif bila validasi lulus dan tidak ada yang berjalan", () => {
    expect(getFooterActions(IDLE)).toEqual({
      saveDraftDisabled: false,
      publishNowDisabled: false,
      scheduleDisabled: false,
      scheduleTriggerDisabled: false,
    });
  });

  it("validasi gagal menahan Schedule dan Publish Now, tetapi Save as Draft tetap boleh (ADR-125)", () => {
    const actions = getFooterActions({
      ...IDLE,
      readiness: { isReadyToSchedule: false, isReadyToPublishNow: false },
    });
    expect(actions.scheduleDisabled).toBe(true);
    expect(actions.publishNowDisabled).toBe(true);
    expect(actions.saveDraftDisabled).toBe(false);
  });

  it("tanpa jadwal sah hanya Schedule yang tertahan; Publish Now tidak butuh jadwal", () => {
    const actions = getFooterActions({
      ...IDLE,
      readiness: { isReadyToSchedule: false, isReadyToPublishNow: true },
    });
    expect(actions.scheduleDisabled).toBe(true);
    expect(actions.publishNowDisabled).toBe(false);
  });

  it("Save as Draft menunggu daftar akun selesai dimuat", () => {
    expect(
      getFooterActions({ ...IDLE, isLoadingAccounts: true }).saveDraftDisabled,
    ).toBe(true);
  });

  it.each([["isSavingDraft"], ["isScheduling"], ["isPublishingNow"]] as const)(
    "semua aksi terkunci selama %s berjalan",
    (flag) => {
      expect(getFooterActions({ ...IDLE, [flag]: true })).toEqual({
        saveDraftDisabled: true,
        publishNowDisabled: true,
        scheduleDisabled: true,
        scheduleTriggerDisabled: true,
      });
    },
  );
});

describe("isEditableInDraftEditor", () => {
  it("Published, Failed, dan Imported tidak dibuka; status lain dibuka", () => {
    expect(isEditableInDraftEditor(ContentStatus.Published)).toBe(false);
    expect(isEditableInDraftEditor(ContentStatus.Failed)).toBe(false);
    expect(isEditableInDraftEditor(ContentStatus.Imported)).toBe(false);
    expect(isEditableInDraftEditor(ContentStatus.Draft)).toBe(true);
    expect(isEditableInDraftEditor(ContentStatus.Scheduled)).toBe(true);
  });
});

describe("countFooterWarnings dan getFooterHelpText", () => {
  const validation = {
    byAccount: {
      a: [{ code: "media-required", message: "x" }],
      b: [],
      c: [
        { code: "media-required", message: "y" },
        { code: "media-required", message: "z" },
      ],
    },
    cross: [{ code: "mixed-story-caption", message: "w" }],
  } as unknown as Parameters<typeof countFooterWarnings>[0];

  it("menjumlah pelanggaran per jaringan, lintas jaringan, dan pesan jadwal", () => {
    expect(countFooterWarnings(validation, null)).toBe(4);
    expect(countFooterWarnings(validation, "Waktu sudah lewat")).toBe(5);
    expect(countFooterWarnings({ byAccount: {}, cross: [] }, null)).toBe(0);
  });

  it("teks bantuan: ajakan memilih akun, jumlah akun, atau jumlah peringatan", () => {
    expect(getFooterHelpText(0, 3)).toBe(FOOTER_HELP_NO_ACCOUNT);
    expect(getFooterHelpText(2, 0)).toBe("2 akun");
    expect(getFooterHelpText(3, 2)).toBe("3 akun · 2 peringatan");
  });
});
