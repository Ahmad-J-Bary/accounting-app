import { DatePicker } from "@shared/ui/date-picker";

interface DateRangePickerProps {
  from: string;
  to: string;
  onChange: (range: { from_date: string; to_date: string }) => void;
}

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-2 mr-auto">
      <DatePicker
        value={from}
        onChange={(v) => onChange({ from_date: v, to_date: to })}
        className="h-9 w-36 text-xs rounded-lg bg-white"
      />
      <span className="text-xs text-slate-400 font-bold">إلى</span>
      <DatePicker
        value={to}
        onChange={(v) => onChange({ from_date: from, to_date: v })}
        className="h-9 w-36 text-xs rounded-lg bg-white"
      />
    </div>
  );
}
