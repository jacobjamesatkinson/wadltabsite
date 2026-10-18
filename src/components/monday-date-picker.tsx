"use client";

import { useMemo, useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  formatDisplayDate,
  formatLocalDate,
  isMonday,
  parseLocalDate,
} from "@/lib/roster/dates";
import { cn } from "@/lib/utils";

export function MondayDatePicker({
  value,
  onChange,
  id,
  disabled,
  className,
}: {
  value: string;
  onChange: (isoDate: string) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value
    ? (() => {
        try {
          return parseLocalDate(value);
        } catch {
          return undefined;
        }
      })()
    : undefined;

  const { startMonth, endMonth } = useMemo(() => {
    const now = new Date();
    return {
      startMonth: new Date(now.getFullYear() - 2, 0, 1),
      endMonth: new Date(now.getFullYear() + 10, 11, 31),
    };
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <CalendarIcon className="mr-2 size-4" />
        {selected ? formatDisplayDate(selected) : "Pick a Monday…"}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          startMonth={startMonth}
          endMonth={endMonth}
          selected={selected}
          defaultMonth={selected ?? new Date()}
          onSelect={(date) => {
            if (!date) return;
            if (!isMonday(date)) return;
            onChange(formatLocalDate(date));
            setOpen(false);
          }}
          disabled={(date) => date.getDay() !== 1}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
