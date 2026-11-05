import { describe, expect, it } from "vitest";

import {
  DEFAULT_SCHEDULE_TIME,
  SCHEDULE_SUMMARY_EMPTY_LABEL,
  SCHEDULE_TRIGGER_EMPTY_LABEL,
  calendarDateToDateKey,
  dateKeyToCalendarDate,
  formatScheduleSummary,
  formatScheduleTriggerLabel,
  getScheduleCalendarBounds,
  formatScheduleLimitText,
  formatZoneWithOffset,
  getTimeZoneLabel,
  getUtcOffsetLabel,
  pickScheduleDate,
} from "./schedule-label";

const WIB = "Asia/Jakarta";

describe("formatScheduleTriggerLabel", () => {
  it("menampilkan hari, tanggal, jam, dan zona seperti rancangan", () => {
    // 4 Nov 2026 jatuh pada hari Rabu.
    expect(formatScheduleTriggerLabel("2026-11-04", "10:00", WIB)).toBe(
      "Rab, 4 Nov · 10:00 WIB",
    );
  });

  it("memakai singkatan bulan dan hari bahasa Indonesia", () => {
    expect(formatScheduleTriggerLabel("2026-08-17", "07:05", WIB)).toBe(
      "Sen, 17 Agu · 07:05 WIB",
    );
    expect(formatScheduleTriggerLabel("2026-12-06", "23:59", WIB)).toBe(
      "Min, 6 Des · 23:59 WIB",
    );
  });

  it("tanpa jadwal tombol berbunyi Atur jadwal", () => {
    expect(formatScheduleTriggerLabel(undefined, undefined, WIB)).toBe(
      SCHEDULE_TRIGGER_EMPTY_LABEL,
    );
    expect(formatScheduleTriggerLabel(undefined, "10:00", WIB)).toBe(
      "Atur jadwal",
    );
  });

  it("hanya tanggal: meminta jam", () => {
    expect(formatScheduleTriggerLabel("2026-11-04", undefined, WIB)).toBe(
      "Rab, 4 Nov · pilih jam",
    );
    expect(formatScheduleTriggerLabel("2026-11-04", "", WIB)).toBe(
      "Rab, 4 Nov · pilih jam",
    );
  });

  it("tanggal yang tidak ada diperlakukan seperti kosong", () => {
    expect(formatScheduleTriggerLabel("2026-02-30", "10:00", WIB)).toBe(
      "Atur jadwal",
    );
    expect(formatScheduleTriggerLabel("bukan-tanggal", "10:00", WIB)).toBe(
      "Atur jadwal",
    );
  });

  it("label zona mengikuti zona pengguna, bukan selalu WIB (ADR-146)", () => {
    expect(
      formatScheduleTriggerLabel("2026-11-04", "10:00", "Asia/Makassar"),
    ).toBe("Rab, 4 Nov · 10:00 WITA");
    expect(
      formatScheduleTriggerLabel("2026-11-04", "10:00", "Asia/Jayapura"),
    ).toBe("Rab, 4 Nov · 10:00 WIT");
    expect(
      formatScheduleTriggerLabel("2026-11-04", "10:00", "America/New_York"),
    ).toMatch(/^Rab, 4 Nov · 10:00 (EST|GMT-5)$/);
  });
});

describe("formatScheduleSummary", () => {
  it("memuat tahun untuk Confirmation Summary", () => {
    expect(formatScheduleSummary("2026-11-04", "10:00", WIB)).toBe(
      "Rab, 4 Nov 2026 · 10:00 WIB",
    );
  });

  it("jadwal belum lengkap menjadi tanda hubung", () => {
    expect(formatScheduleSummary(undefined, undefined, WIB)).toBe(
      SCHEDULE_SUMMARY_EMPTY_LABEL,
    );
    expect(formatScheduleSummary("2026-11-04", undefined, WIB)).toBe("-");
    expect(formatScheduleSummary(undefined, "10:00", WIB)).toBe("-");
  });
});

describe("getTimeZoneLabel", () => {
  it("zona tak dikenal jatuh ke namanya sendiri", () => {
    expect(getTimeZoneLabel("Bukan/Zona", new Date())).toBe("Bukan/Zona");
  });
});

describe("getScheduleCalendarBounds", () => {
  it("hari ini sampai 30 hari ke depan di zona pengguna", () => {
    // 14:20 WIB pada 3 Nov 2026.
    const now = new Date("2026-11-03T07:20:00Z");
    expect(getScheduleCalendarBounds(now, WIB)).toEqual({
      minKey: "2026-11-03",
      maxKey: "2026-12-03",
    });
  });

  it("hari ini mengikuti zona pengguna, bukan UTC", () => {
    // 18:00 UTC masih 3 Nov, tetapi sudah 4 Nov 01:00 di WIB.
    const now = new Date("2026-11-03T18:00:00Z");
    expect(getScheduleCalendarBounds(now, WIB).minKey).toBe("2026-11-04");
    expect(getScheduleCalendarBounds(now, "UTC").minKey).toBe("2026-11-03");
  });
});

describe("kunci tanggal dan hari kalender", () => {
  it("bolak-balik tanpa bergeser hari", () => {
    const date = dateKeyToCalendarDate("2026-11-04");
    expect(date).toBeDefined();
    expect(calendarDateToDateKey(date as Date)).toBe("2026-11-04");
  });

  it("kunci tak sah menghasilkan undefined", () => {
    expect(dateKeyToCalendarDate(undefined)).toBeUndefined();
    expect(dateKeyToCalendarDate("2026-13-01")).toBeUndefined();
    expect(dateKeyToCalendarDate("4 Nov")).toBeUndefined();
  });
});

describe("pickScheduleDate", () => {
  it("mempertahankan jam yang sudah diisi", () => {
    expect(pickScheduleDate(new Date(2026, 10, 5), "15:30")).toEqual({
      date: "2026-11-05",
      time: "15:30",
    });
  });

  it("memakai jam bawaan 10:00 bila jam kosong atau tak sah", () => {
    expect(pickScheduleDate(new Date(2026, 10, 5), undefined)).toEqual({
      date: "2026-11-05",
      time: DEFAULT_SCHEDULE_TIME,
    });
    expect(pickScheduleDate(new Date(2026, 10, 5), "25:99").time).toBe("10:00");
  });
});

describe("label zona popover jadwal (T-212.2)", () => {
  const AT = new Date("2026-11-03T07:20:00Z");

  it("selisih UTC dibaca dari Intl, bukan dikodekan per zona", () => {
    expect(getUtcOffsetLabel(WIB, AT)).toBe("UTC+7");
    expect(getUtcOffsetLabel("Asia/Makassar", AT)).toBe("UTC+8");
    expect(getUtcOffsetLabel("Asia/Kolkata", AT)).toBe("UTC+5:30");
    expect(getUtcOffsetLabel("UTC", AT)).toMatch(/^UTC(\+0)?$/);
  });

  it("menulis singkatan dengan selisih; zona tanpa singkatan resmi hanya selisih", () => {
    expect(formatZoneWithOffset(WIB, AT)).toBe("WIB (UTC+7)");
    expect(formatZoneWithOffset("Asia/Jayapura", AT)).toBe("WIT (UTC+9)");
    expect(formatZoneWithOffset("Asia/Singapore", AT)).toBe("UTC+8");
  });

  it("teks batas memuat tanggal batas dan hari ini lengkap dengan jam", () => {
    expect(formatScheduleLimitText(AT, WIB, 30)).toBe(
      "Jadwal maksimal 30 hari ke depan: tanggal setelah 3 Des 2026 dinonaktifkan. Hari ini Sel, 3 Nov, 14:20 WIB.",
    );
  });
});
