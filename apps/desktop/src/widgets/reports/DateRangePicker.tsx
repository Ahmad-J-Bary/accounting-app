import { DatePicker } from "@shared/ui/date-picker";

interface DateRangePickerProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  showSeparator?: boolean;
}

export function DateRangePicker({ from, to, onFromChange, onToChange, showSeparator }: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-2 mr-auto">
      {showSeparator && (
        <span className="inline-block w-px h-5 bg-slate-300 mx-2" />
      )}
      <span className="text-xs text-slate-400 font-bold">من</span>
      <DatePicker
        value={from}
        onChange={onFromChange}
        className="h-9 w-36 text-xs rounded-lg bg-white"
        placeholder=""
      />
      <span className="text-xs text-slate-400 font-bold">إلى</span>
      <DatePicker
        value={to}
        onChange={onToChange}
        className="h-9 w-36 text-xs rounded-lg bg-white"
        placeholder=""
      />
    </div>
  );
}
