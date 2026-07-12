import { Label } from "@shared/ui/label";
import { Input } from "@shared/ui/input";
import { Calendar } from "lucide-react";

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function DateField({ label, value, onChange, className }: DateFieldProps) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</Label>
      <div className="relative">
        <Calendar className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 rounded-xl border-slate-200 bg-slate-50/50 pr-10 font-bold tabular-nums"
        />
      </div>
    </div>
  );
}
