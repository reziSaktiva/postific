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
  getScheduleZoneInstant,
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

describe("label zona: zona negatif, DST, dan zona tak valid (T-213.1, T-213.2, T-213.4)", () => {
  const NY = "America/New_York";
  // Hari ini Nov (EST, UTC-5); jadwal Juli (EDT, UTC-4).
  const NOW = new Date("2026-11-03T12:00:00Z");

  it("zona negatif memakai tanda minus", () => {
    expect(getUtcOffsetLabel(NY, NOW)).toBe("UTC-5");
    expect(getUtcOffsetLabel("America/Sao_Paulo", NOW)).toBe("UTC-3");
  });

  it("selisih mengikuti tanggal jadwal, bukan hari ini (DST)", () => {
    const summer = getScheduleZoneInstant("2026-07-15", "10:00", NY, NOW);
    const winter = getScheduleZoneInstant("2026-12-15", "10:00", NY, NOW);
    expect(formatZoneWithOffset(NY, summer)).toBe("EDT (UTC-4)");
    expect(formatZoneWithOffset(NY, winter)).toBe("EST (UTC-5)");
    // Hari ini dalam musim dingin: memakai NOW akan salah untuk jadwal Juli.
    expect(formatZoneWithOffset(NY, NOW)).toBe("EST (UTC-5)");
  });

  it("tanpa tanggal sah memakai now", () => {
    expect(getScheduleZoneInstant(undefined, undefined, NY, NOW)).toBe(NOW);
    expect(getScheduleZoneInstant("2026-13-40", "10:00", NY, NOW)).toBe(NOW);
  });

  it("jam di celah spring-forward memakai tebakan valid, bukan now", () => {
    const gap = getScheduleZoneInstant("2026-03-08", "02:30", NY, NOW);
    expect(gap.toISOString()).toBe("2026-03-08T07:30:00.000Z");
    expect(formatZoneWithOffset(NY, gap)).toBe("EDT (UTC-4)");
  });

  it("offset nol ditulis UTC+0 di label dan deskripsi, apa pun nama Intl", () => {
    const winter = new Date("2026-12-15T12:00:00Z");
    for (const zone of ["Europe/London", "UTC"]) {
      expect(getTimeZoneLabel(zone, winter)).toBe("UTC+0");
      expect(getUtcOffsetLabel(zone, winter)).toBe("UTC+0");
      expect(formatZoneWithOffset(zone, winter)).toBe("UTC+0");
    }
  });

  it("jam kosong atau tak sah memakai tengah hari pada tanggal jadwal", () => {
    expect(
      getScheduleZoneInstant("2026-07-15", undefined, NY, NOW).toISOString(),
    ).toBe("2026-07-15T16:00:00.000Z");
    expect(
      getScheduleZoneInstant("2026-07-15", "99:99", NY, NOW).toISOString(),
    ).toBe("2026-07-15T16:00:00.000Z");
  });

  it("zona tanpa singkatan resmi ditulis UTC+N di semua tempat, bukan GMT+N", () => {
    expect(getTimeZoneLabel("Asia/Singapore", NOW)).toBe("UTC+8");
    expect(formatZoneWithOffset("Asia/Singapore", NOW)).toBe("UTC+8");
    expect(getTimeZoneLabel("Asia/Kolkata", NOW)).toBe("UTC+5:30");
  });

  it("zona tak valid jatuh ke namanya sekali, tanpa melempar", () => {
    expect(
      getScheduleZoneInstant("2026-07-15", "10:00", "Bukan/Zona", NOW),
    ).toBe(NOW);
    expect(getUtcOffsetLabel("Bukan/Zona", NOW)).toBe("Bukan/Zona");
    expect(formatZoneWithOffset("Bukan/Zona", NOW)).toBe("Bukan/Zona");
  });

  it("teks batas di zona negatif memakai hari lokal zona itu", () => {
    // 03:00Z = 20:00 PDT 27 Sep; batas 30 hari = 27 Okt.
    const at = new Date("2026-09-28T03:00:00Z");
    expect(formatScheduleLimitText(at, "America/Los_Angeles", 30)).toBe(
      "Jadwal maksimal 30 hari ke depan: tanggal setelah 27 Okt 2026 dinonaktifkan. Hari ini Min, 27 Sep, 20:00 PDT.",
    );
  });
});
