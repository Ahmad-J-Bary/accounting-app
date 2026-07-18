import { Popover, PopoverContent, PopoverTrigger } from "@shared/ui/popover";
import { Button } from "@shared/ui/button";
import { Calendar } from "@shared/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { formatDate, formatNumber, getNumberingSystem } from "@shared/lib/format";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

function toDate(value: string): Date | undefined {
  if (!value) return undefined;
  const parts = value.split("-");
  if (parts.length !== 3) return undefined;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function toIsoString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DatePicker({ value, onChange, className, placeholder = "اختر تاريخ" }: DatePickerProps) {
  const date = toDate(value);
  const isWestern = getNumberingSystem() === "latn";

  const monthNames = isWestern
    ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    : ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"];

  const dayNames = isWestern
    ? ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
    : ["ح", "ن", "ث", "ر", "خ", "ج", "س"];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-11 w-full justify-start gap-2 rounded-xl bg-slate-50/50 border-slate-200 font-bold pr-3",
            !date && "text-slate-400",
            className
          )}
        >
          <CalendarIcon className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="truncate">{date ? formatDate(date) : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(selectedDate) => {
            if (selectedDate) {
              onChange(toIsoString(selectedDate));
            }
          }}
          initialFocus
          formatters={{
            formatDay: (d) => formatNumber(d.getDate()),
            formatWeekdayName: (d) => dayNames[d.getDay()],
            formatCaption: (d) => `${monthNames[d.getMonth()]} ${isWestern ? d.getFullYear().toString() : formatNumber(d.getFullYear())}`,
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
