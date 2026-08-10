import { Plus, Trash2 } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import type { AccountDto } from "@erp/shared-types";
import { TYPE_LABEL } from "../lib/migration-labels";
import { newLine, newDetail, type WizLine, type DetailRow } from "../hooks/useOpeningBalanceWizard";

interface WizardLineEditorProps {
  rows: WizLine[];
  setter: Dispatch<SetStateAction<WizLine[]>>;
  updateLine: (setter: Dispatch<SetStateAction<WizLine[]>>, key: string, patch: Partial<WizLine>) => void;
  placeholder: string;
  accounts: AccountDto[];
  detailAccounts: AccountDto[];
}

export function WizardLineEditor({ rows, setter, updateLine, placeholder, accounts, detailAccounts }: WizardLineEditorProps) {
  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <p className="text-xs text-slate-400 py-2 text-center">لا توجد بنود بعد</p>
      )}
      {rows.map((l) => {
        const acc = accounts.find((a) => a.id === l.account_id);
        return (
          <div key={l.key} className="flex items-center gap-2 border border-slate-200 rounded-lg p-2">
            <Input
              list="wiz-accounts"
              value={l.account_id}
              onChange={(e) => updateLine(setter, l.key, { account_id: e.target.value })}
              placeholder={placeholder}
              className="h-9 flex-1"
            />
            <div className="w-[170px] shrink-0 text-xs text-slate-600">
              {acc ? `${acc.name_ar} (${TYPE_LABEL[acc.account_type]})` : "—"}
            </div>
            <Input
              value={l.amount}
              onChange={(e) => updateLine(setter, l.key, { amount: e.target.value })}
              placeholder="0.00"
              type="number"
              className="h-9 w-[110px] shrink-0 text-left tabular-nums"
            />
            <Button size="sm" variant="ghost" onClick={() => setter((prev) => prev.filter((x) => x.key !== l.key))} className="text-red-500 hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        );
      })}
      <Button size="sm" variant="outline" onClick={() => setter((prev) => [...prev, newLine()])} className="border-blue-200 text-blue-700 hover:bg-blue-50 font-bold">
        <Plus className="w-3.5 h-3.5 ml-1.5" /> إضافة بند
      </Button>
      <datalist id="wiz-accounts">
        {detailAccounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code} — {a.name_ar} ({TYPE_LABEL[a.account_type]})
          </option>
        ))}
      </datalist>
    </div>
  );
}

interface WizardDetailEditorProps {
  rows: DetailRow[];
  setter: Dispatch<SetStateAction<DetailRow[]>>;
  updateDetail: (setter: Dispatch<SetStateAction<DetailRow[]>>, key: string, patch: Partial<DetailRow>) => void;
  referenceLabel: string;
  withQty: boolean;
}

export function WizardDetailEditor({ rows, setter, updateDetail, referenceLabel, withQty }: WizardDetailEditorProps) {
  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <p className="text-xs text-slate-400 py-2 text-center">لا توجد بنود (اختياري)</p>
      )}
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2 border border-slate-200 rounded-lg p-2">
          <Input
            value={r.reference}
            onChange={(e) => updateDetail(setter, r.key, { reference: e.target.value })}
            placeholder={referenceLabel}
            className="h-9 flex-1"
          />
          {withQty && (
            <Input
              value={r.qty}
              onChange={(e) => updateDetail(setter, r.key, { qty: e.target.value })}
              placeholder="الكمية"
              type="number"
              className="h-9 w-[90px] shrink-0 text-left tabular-nums"
            />
          )}
          <Input
            value={r.amount}
            onChange={(e) => updateDetail(setter, r.key, { amount: e.target.value })}
            placeholder="المبلغ"
            type="number"
            className="h-9 w-[110px] shrink-0 text-left tabular-nums"
          />
          <Button size="sm" variant="ghost" onClick={() => setter((prev) => prev.filter((x) => x.key !== r.key))} className="text-red-500 hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => setter((prev) => [...prev, newDetail("", "", "")])} className="border-blue-200 text-blue-700 hover:bg-blue-50 font-bold">
        <Plus className="w-3.5 h-3.5 ml-1.5" /> إضافة بند
      </Button>
    </div>
  );
}