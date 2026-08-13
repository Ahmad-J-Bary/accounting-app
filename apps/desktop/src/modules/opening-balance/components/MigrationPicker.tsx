import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { STATUS_LABEL } from "@shared/ui/status";
import { toLocalDateStr } from "@shared/lib/format";
import type { OpeningBalanceMigrationDto } from "../../accounting/api/openingBalanceService";

interface MigrationPickerProps {
  id: string;
  label: string;
  candidates: OpeningBalanceMigrationDto[];
  value: string;
  onChange: (v: string) => void;
}

/** Shared migration selector: cutover date — status — line count. */
export function MigrationPicker({ id, label, candidates, value, onChange }: MigrationPickerProps) {
  return (
    <div className="space-y-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-9 bg-white border-slate-200 text-xs">
          <SelectValue placeholder={candidates.length ? "اختر ترحيلاً..." : "لا توجد ترحيلات"} />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((m) => (
            <SelectItem key={m.id} value={m.id} className="text-xs">
              {toLocalDateStr(m.cutover_date)} — {STATUS_LABEL[m.status]} — {m.lines.length} بنود
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
