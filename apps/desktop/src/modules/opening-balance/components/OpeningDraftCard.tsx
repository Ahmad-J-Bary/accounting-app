import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { toFixed } from "@shared/lib/format";
import { Plus } from "lucide-react";
import type { AccountDto } from "@erp/shared-types";
import type { AccountLine } from "../lib/migration-labels";
import { TYPE_LABEL, findAccount, isDebitNature } from "../lib/migration-labels";

interface OpeningDraftCardProps {
  cutoverDate: string;
  onCutoverDateChange: (v: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  lines: AccountLine[];
  detailAccounts: AccountDto[];
  accounts: readonly AccountDto[];
  onAddLine: () => void;
  onRemoveLine: (key: string) => void;
  onUpdateLine: (key: string, patch: Partial<AccountLine>) => void;
  debitTotal: number;
  creditTotal: number;
  isValid: boolean;
  saving: boolean;
  onSaveDraft: () => void;
}

export function OpeningDraftCard({
  cutoverDate,
  onCutoverDateChange,
  notes,
  onNotesChange,
  lines,
  detailAccounts,
  accounts,
  onAddLine,
  onRemoveLine,
  onUpdateLine,
  debitTotal,
  creditTotal,
  isValid,
  saving,
  onSaveDraft,
}: OpeningDraftCardProps) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="py-3">
        <CardTitle className="text-base font-bold text-slate-800">إنشاء مسودة رصيد افتتاحي</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <FieldLabel>تاريخ الترحيل (Cutover)</FieldLabel>
            <Input type="date" value={cutoverDate} onChange={(e) => onCutoverDateChange(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>ملاحظات</FieldLabel>
            <Input value={notes} onChange={(e) => onNotesChange(e.target.value)} placeholder="ملاحظات اختيارية..." className="h-9" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">بنود الرصيد الافتتاحي</span>
            <Button size="sm" variant="outline" onClick={onAddLine} className="border-blue-200 text-blue-700 hover:bg-blue-50 font-bold">
              <Plus className="w-3.5 h-3.5 ml-1.5" /> إضافة بند
            </Button>
          </div>

          {lines.length === 0 && (
            <p className="text-xs text-slate-400 py-2 text-center">لا توجد بنود بعد — أضف الحسابات وأرصدتها</p>
          )}

          {lines.map((l) => {
            const acc = findAccount(accounts, l.account_id);
            return (
              <div key={l.key} className="flex items-center gap-2 border border-slate-200 rounded-lg p-2">
                <Input
                  list="ob-accounts"
                  value={l.account_id}
                  onChange={(e) => onUpdateLine(l.key, { account_id: e.target.value })}
                  placeholder="ابحث واختر حساباً..."
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
                  onChange={(e) => onUpdateLine(l.key, { amount: e.target.value })}
                  placeholder="0.00"
                  className="h-9 w-[110px] shrink-0 text-left tabular-nums"
                />
                <Button size="sm" variant="ghost" onClick={() => onRemoveLine(l.key)} className="text-red-500 hover:bg-red-50">حذف</Button>
              </div>
            );
          })}

          <datalist id="ob-accounts">
            {detailAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name_ar} ({TYPE_LABEL[a.account_type]})
              </option>
            ))}
          </datalist>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <div className="text-xs font-semibold flex gap-4 text-slate-600">
            <span className={isValid ? "text-green-600" : "text-red-500"}>
              مدين: {toFixed(debitTotal, 2)}
            </span>
            <span className={isValid ? "text-green-600" : "text-red-500"}>
              دائن: {toFixed(creditTotal, 2)}
            </span>
            <span className={isValid ? "text-green-600" : "text-red-500"}>
              {isValid ? "متوازن ✓" : "غير متوازن"}
            </span>
          </div>
          <Button onClick={onSaveDraft} disabled={saving || !isValid} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-100 font-bold">
            {saving ? "جارٍ الحفظ..." : "حفظ المسودة"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}