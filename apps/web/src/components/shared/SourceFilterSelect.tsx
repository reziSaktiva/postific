"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { SOURCE_FILTER_OPTIONS, type SourceFilterValue } from "./source-filter";

/** Select satu-pilihan filter sumber (T-157), bawaan "Semua Sumber". */
export function SourceFilterSelect({
  value,
  onValueChange,
}: {
  value: SourceFilterValue;
  onValueChange: (value: SourceFilterValue) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onValueChange(next as SourceFilterValue)}
    >
      <SelectTrigger size="sm" aria-label="Filter sumber" className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SOURCE_FILTER_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
