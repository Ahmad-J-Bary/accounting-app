import { Plus, Trash2 } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { EmptyState } from "@widgets/table-shell/EmptyState";
import { toFixed } from "@shared/lib/format";
import type { AccountDto } from "@erp/shared-types";
import { TYPE_LABEL, findAccount, isDebitNature } from "../lib/migration-labels";
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
        <EmptyState message="لا توجد بنود بعد" suggestion="أضف بنداً واختر الحساب والمبلغ" compact />
      )}
      {rows.map((l) => {
        const acc = findAccount(accounts, l.account_id);
        const amountNum = parseFloat(l.amount);
        const amountInvalid = l.amount.trim() !== "" && (Number.isNaN(amountNum) || amountNum <= 0);
        return (
          <div key={l.key} className="space-y-1">
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg p-2">
              <Input
                list="wiz-accounts"
                value={l.account_id}
                onChange={(e) => updateLine(setter, l.key, { account_id: e.target.value })}
                placeholder={placeholder}
                className="h-9 flex-1"
              />
              <div className="w-[190px] shrink-0 text-xs text-slate-600">
                {acc ? `${acc.name_ar} (${TYPE_LABEL[acc.account_type]})` : "—"}
              </div>
              <div className="w-[90px] shrink-0 text-[11px] font-bold text-slate-500">
                {acc && isDebitNature(acc.account_type) ? "مدين" : acc ? "دائن" : ""}
              </div>
              <Input
                value={l.amount}
                onChange={(e) => updateLine(setter, l.key, { amount: e.target.value })}
                placeholder="0.00"
                type="number"
                min="0"
                step="0.01"
                aria-invalid={amountInvalid}
                className={"h-9 w-[110px] shrink-0 text-left tabular-nums " + (amountInvalid ? "border-red-300 focus-visible:ring-red-200" : "")}
              />
              <Button size="sm" variant="ghost" onClick={() => setter((prev) => prev.filter((x) => x.key !== l.key))} aria-label="حذف هذا البند" className="text-red-500 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
            {amountInvalid && (
              <p className="text-2xs text-red-600 px-1">أدخل مبلغاً صحيحاً أكبر من صفر لهذا البند.</p>
            )}
          </div>
        );
      })}
      <Button size="sm" variant="outline" onClick={() => setter((prev) => [...prev, newLine()])} className="border-blue-200 text-blue-700 hover:bg-blue-50 font-bold">
        <Plus className="w-3.5 h-3.5 ml-1.5" /> إضافة بند
      </Button>
      {rows.some((l) => parseFloat(l.amount) > 0) && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs font-semibold text-slate-600">
          <span>الإجمالي</span>
          <span className="tabular-nums font-bold">
            {toFixed(rows.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0), 2)}
          </span>
        </div>
      )}
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
        <EmptyState message="لا توجد بنود (اختياري)" suggestion="اختياري — أضف بنود السجل المساعد" compact />
      )}
      {rows.map((r) => {
        const amountNum = parseFloat(r.amount);
        const amountInvalid = r.amount.trim() !== "" && (Number.isNaN(amountNum) || amountNum <= 0);
        const qtyNum = parseFloat(r.qty);
        const qtyInvalid = withQty && r.qty.trim() !== "" && (Number.isNaN(qtyNum) || qtyNum <= 0);
        return (
          <div key={r.key} className="space-y-1">
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg p-2">
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
                  min="0"
                  step="0.01"
                  aria-invalid={qtyInvalid}
                  className={"h-9 w-[90px] shrink-0 text-left tabular-nums " + (qtyInvalid ? "border-red-300 focus-visible:ring-red-200" : "")}
                />
              )}
              <Input
                value={r.amount}
                onChange={(e) => updateDetail(setter, r.key, { amount: e.target.value })}
                placeholder="المبلغ"
                type="number"
                min="0"
                step="0.01"
                aria-invalid={amountInvalid}
                className={"h-9 w-[110px] shrink-0 text-left tabular-nums " + (amountInvalid ? "border-red-300 focus-visible:ring-red-200" : "")}
              />
              <Button size="sm" variant="ghost" onClick={() => setter((prev) => prev.filter((x) => x.key !== r.key))} aria-label="حذف هذا البند" className="text-red-500 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
            {(amountInvalid || qtyInvalid) && (
              <p className="text-2xs text-red-600 px-1">
                {amountInvalid ? "أدخل مبلغاً صحيحاً أكبر من صفر." : ""}
                {amountInvalid && qtyInvalid ? " " : ""}
                {qtyInvalid ? "أدخل كمية صحيحة أكبر من صفر." : ""}
              </p>
            )}
          </div>
        );
      })}
      <Button size="sm" variant="outline" onClick={() => setter((prev) => [...prev, newDetail("", "", "")])} className="border-blue-200 text-blue-700 hover:bg-blue-50 font-bold">
        <Plus className="w-3.5 h-3.5 ml-1.5" /> إضافة بند
      </Button>
      {rows.some((r) => parseFloat(r.amount) > 0) && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs font-semibold text-slate-600">
          <span>الإجمالي</span>
          <span className="tabular-nums font-bold">
            {toFixed(rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0), 2)}
          </span>
        </div>
      )}
    </div>
  );
}