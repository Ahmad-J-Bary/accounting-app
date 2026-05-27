import { RadioGroupItem } from "@shared/ui/radio-group";
import { Label } from "@shared/ui/label";

interface StrategyOptionProps {
  id: string;
  value: string;
  label: string;
}

export function StrategyOption({ id, value, label }: StrategyOptionProps) {
  return (
    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer group shadow-sm">
      <RadioGroupItem value={value} id={id} className="text-blue-600" />
      <Label
        htmlFor={id}
        className="cursor-pointer text-xs font-bold text-slate-700 group-hover:text-blue-700 transition-colors"
      >
        {label}
      </Label>
    </div>
  );
}