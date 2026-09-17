import { DatePicker } from "@shared/ui/date-picker";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface DateRangePickerProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  showSeparator?: boolean;
}

export function DateRangePicker({ from, to, onFromChange, onToChange, showSeparator }: DateRangePickerProps) {
  const { t } = useLocalization();
  return (
    <div className="me-auto flex items-center gap-2">
      {showSeparator && (
        <span className="inline-block w-px h-5 bg-slate-300 mx-2" />
      )}
      <span className="text-xs font-bold text-slate-400">{t("labels.from", { namespace: "common" })}</span>
      <DatePicker
        value={from}
        onChange={onFromChange}
        className="h-9 w-36 text-xs rounded-lg bg-white"
        placeholder=""
      />
      <span className="text-xs font-bold text-slate-400">{t("labels.to", { namespace: "common" })}</span>
      <DatePicker
        value={to}
        onChange={onToChange}
        className="h-9 w-36 text-xs rounded-lg bg-white"
        placeholder=""
      />
    </div>
  );
}
