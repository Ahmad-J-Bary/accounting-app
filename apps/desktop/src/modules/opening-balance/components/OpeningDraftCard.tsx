import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { toFixed } from "@shared/lib/format";
import type { AccountDto } from "@erp/shared-types";
import type { AccountLine } from "../lib/migration-labels";
import { AccountLineRow } from "./AccountLineRow";
import { AddLineButton } from "./AddLineButton";

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
            <FieldLabel htmlFor="ob-cutover-date" required>تاريخ الترحيل (Cutover)</FieldLabel>
            <Input id="ob-cutover-date" type="date" value={cutoverDate} onChange={(e) => onCutoverDateChange(e.target.value)} className="h-9" aria-required />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="ob-notes">ملاحظات</FieldLabel>
            <Input id="ob-notes" value={notes} onChange={(e) => onNotesChange(e.target.value)} placeholder="ملاحظات اختيارية..." className="h-9" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">بنود الرصيد الافتتاحي</span>
            <span className="text-2xs text-slate-400">{lines.length} بند</span>
          </div>

          {lines.length === 0 && (
            <p className="text-xs text-slate-400 py-2 text-center">لا توجد بنود بعد — أضف الحسابات وأرصدتها</p>
          )}

          {lines.map((l) => {
            const amountNum = parseFloat(l.amount);
            const amountInvalid = l.amount.trim() !== "" && (Number.isNaN(amountNum) || amountNum <= 0);
            const missingAccount = !l.account_id && l.amount.trim() !== "";
            return (
              <AccountLineRow
                key={l.key}
                accountId={l.account_id}
                onAccountChange={(id) => onUpdateLine(l.key, { account_id: id })}
                amount={l.amount}
                onAmountChange={(amount) => onUpdateLine(l.key, { amount })}
                onRemove={() => onRemoveLine(l.key)}
                accounts={accounts}
                options={detailAccounts}
                placeholder="ابحث واختر حساباً..."
                showErrorMessage={missingAccount || amountInvalid}
                errorMessage={
                  missingAccount
                    ? "اختر حساباً لهذا البند قبل الحفظ."
                    : "أدخل مبلغاً صحيحاً أكبر من صفر لهذا البند."
                }
              />
            );
          })}

          <AddLineButton onClick={onAddLine} />
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
          <div className="flex flex-col items-end gap-1">
            {!isValid && lines.length > 0 && (
              <p className="text-2xs text-red-600">أضف بنداً واحداً على الأقل مع الحساب والمبلغ وتوازن مدين = دائن قبل الحفظ.</p>
            )}
            {!isValid && lines.length === 0 && (
              <p className="text-2xs text-slate-500">أضف بنود الحسابات قبل حفظ المسودة.</p>
            )}
            <Button onClick={onSaveDraft} disabled={saving || !isValid} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-100 font-bold">
              {saving ? "جارٍ الحفظ..." : "حفظ المسودة"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}