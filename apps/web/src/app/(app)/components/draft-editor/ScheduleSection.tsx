"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { scheduleMaxDateKey } from "@/domains/publishing/schedule-time-constraints";
import { useUserTimeZone } from "@/lib/time/user-time-zone-context";

export function ScheduleSection({
  scheduleDate,
  scheduleTime,
  onScheduleDateChange,
  onScheduleTimeChange,
}: {
  scheduleDate: string | undefined;
  scheduleTime: string | undefined;
  onScheduleDateChange: (date: string | undefined) => void;
  onScheduleTimeChange: (time: string | undefined) => void;
}) {
  const timeZone = useUserTimeZone();

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex.
    <div className="flex flex-col gap-3">
      <Text variant="h4" as="h3">
        Jadwal
      </Text>
      {/* eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx HStack, murni Tailwind flex. */}
      <div className="flex items-center gap-2">
        <Label htmlFor="draft-schedule-date" className="sr-only">
          Tanggal
        </Label>
        <Input
          id="draft-schedule-date"
          type="date"
          className="w-auto"
          max={scheduleMaxDateKey(new Date(), timeZone)}
          value={scheduleDate ?? ""}
          onChange={(event) =>
            onScheduleDateChange(event.target.value || undefined)
          }
        />
        <Label htmlFor="draft-schedule-time" className="sr-only">
          Waktu
        </Label>
        <Input
          id="draft-schedule-time"
          type="time"
          className="w-auto"
          value={scheduleTime ?? ""}
          onChange={(event) =>
            onScheduleTimeChange(event.target.value || undefined)
          }
        />
      </div>
    </div>
  );
}
