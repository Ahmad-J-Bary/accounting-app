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
        <span className="mx-2 inline-block h-5 w-px bg-border" />
      )}
      <span className="text-xs font-bold text-muted-foreground">{t("labels.from", { namespace: "common" })}</span>
      <DatePicker
        value={from}
        onChange={onFromChange}
        className="h-9 w-36 rounded-lg bg-background text-xs"
      />
      <span className="text-xs font-bold text-muted-foreground">{t("labels.to", { namespace: "common" })}</span>
      <DatePicker
        value={to}
        onChange={onToChange}
        className="h-9 w-36 rounded-lg bg-background text-xs"
      />
    </div>
  );
}
