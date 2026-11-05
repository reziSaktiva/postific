"use client";

import { useState } from "react";

import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { id as idLocale } from "react-day-picker/locale";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SCHEDULE_MAX_DAYS_AHEAD } from "@/domains/publishing/schedule-time-constraints";
import { useUserTimeZone } from "@/lib/time/user-time-zone-context";

import {
  dateKeyToCalendarDate,
  formatScheduleLimitText,
  formatScheduleTriggerLabel,
  formatZoneWithOffset,
  getScheduleCalendarBounds,
  getTimeZoneLabel,
  pickScheduleDate,
} from "./schedule-label";

/**
 * Tombol "Atur jadwal" di footer dan popover-nya (T-205.1, ADR-155 addendum):
 * Calendar (hari lampau dan hari di atas 30 hari nonaktif), input jam, label
 * zona waktu, dan penjelasan batas. Nilai jadwal tetap string "YYYY-MM-DD" dan
 * "HH:mm" di zona pengguna (ADR-146); pesan validasinya tampil di footer.
 */
export function ScheduleSection({
  scheduleDate,
  scheduleTime,
  disabled,
  triggerClassName,
  onScheduleDateChange,
  onScheduleTimeChange,
}: {
  scheduleDate: string | undefined;
  scheduleTime: string | undefined;
  disabled: boolean;
  triggerClassName?: string;
  onScheduleDateChange: (date: string | undefined) => void;
  onScheduleTimeChange: (time: string | undefined) => void;
}) {
  const timeZone = useUserTimeZone();
  const [isOpen, setIsOpen] = useState(false);

  // Dihitung saat dirender: batas bergeser bila dialog dibiarkan terbuka
  // melewati tengah malam.
  const now = new Date();
  const { minKey, maxKey } = getScheduleCalendarBounds(now, timeZone);
  const minDate = dateKeyToCalendarDate(minKey);
  const maxDate = dateKeyToCalendarDate(maxKey);
  const selectedDate = dateKeyToCalendarDate(scheduleDate);
  // Jadwal tersimpan di luar rentang (lampau atau lewat batas) tetap harus
  // terlihat di Calendar; harinya nonaktif sehingga tidak bisa dipilih ulang.
  const startMonth =
    selectedDate && minDate && selectedDate < minDate ? selectedDate : minDate;
  const endMonth =
    selectedDate && maxDate && selectedDate > maxDate ? selectedDate : maxDate;
  const label = formatScheduleTriggerLabel(
    scheduleDate,
    scheduleTime,
    timeZone,
  );
  const zoneLabel = getTimeZoneLabel(timeZone, now);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={triggerClassName}
          disabled={disabled}
          aria-label={`Jadwal: ${label}`}
        >
          <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        collisionPadding={8}
        className="w-84 max-w-(--radix-popover-content-available-width)"
      >
        <PopoverHeader>
          <PopoverTitle>Jadwal publish</PopoverTitle>
          <PopoverDescription>
            Waktu dibaca di zona waktu Anda:{" "}
            {formatZoneWithOffset(timeZone, now)}.
          </PopoverDescription>
        </PopoverHeader>
        <Calendar
          mode="single"
          locale={idLocale}
          selected={selectedDate}
          defaultMonth={selectedDate ?? minDate}
          today={minDate}
          startMonth={startMonth}
          endMonth={endMonth}
          disabled={
            minDate && maxDate
              ? [{ before: minDate }, { after: maxDate }]
              : undefined
          }
          onSelect={(date) => {
            // Klik hari yang sudah terpilih mengirim `undefined`; jadwal
            // dihapus lewat "Hapus jadwal", bukan lewat klik ulang.
            if (!date) {
              return;
            }
            const next = pickScheduleDate(date, scheduleTime);
            onScheduleDateChange(next.date);
            onScheduleTimeChange(next.time);
          }}
          className="p-0"
          // Menimpa `w-fit` bawaan Calendar agar 7 kolom mengisi popover (T-211.1).
          classNames={{ root: "w-full" }}
        />
        {/* eslint-disable-next-line no-restricted-syntax -- T-205: baris jam popover, murni Tailwind flex. */}
        <div className="flex items-center gap-2">
          <Label htmlFor="draft-schedule-time">Jam</Label>
          <Input
            id="draft-schedule-time"
            type="time"
            className="w-auto"
            value={scheduleTime ?? ""}
            onChange={(event) =>
              onScheduleTimeChange(event.target.value || undefined)
            }
          />
          <span className="text-muted-foreground">{zoneLabel}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatScheduleLimitText(now, timeZone, SCHEDULE_MAX_DAYS_AHEAD)}
        </p>
        {/* eslint-disable-next-line no-restricted-syntax -- T-205: baris aksi popover, murni Tailwind flex. */}
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!scheduleDate}
            onClick={() => {
              onScheduleDateChange(undefined);
              onScheduleTimeChange(undefined);
            }}
          >
            Hapus jadwal
          </Button>
          <Button type="button" size="sm" onClick={() => setIsOpen(false)}>
            Selesai
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
