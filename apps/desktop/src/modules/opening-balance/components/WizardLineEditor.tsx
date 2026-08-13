import type { Dispatch, SetStateAction } from "react";
import { Trash2 } from "lucide-react";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { Combobox } from "@shared/ui/combobox";
import { EmptyState } from "@widgets/table-shell/EmptyState";
import { toFixed } from "@shared/lib/format";
import type { AccountDto } from "@erp/shared-types";
import type { WizLine, DetailRow, EntityOption } from "@modules/opening-balance/lib/wizard-types";
import { newLine, newDetail } from "@modules/opening-balance/lib/wizard-types";
import { AccountLineRow } from "./AccountLineRow";
import { AddLineButton } from "./AddLineButton";

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
        const amountNum = parseFloat(l.amount);
        const amountInvalid = l.amount.trim() !== "" && (Number.isNaN(amountNum) || amountNum <= 0);
        return (
          <AccountLineRow
            key={l.key}
            accountId={l.account_id}
            onAccountChange={(id) => updateLine(setter, l.key, { account_id: id })}
            amount={l.amount}
            onAmountChange={(amount) => updateLine(setter, l.key, { amount })}
            onRemove={() => setter((prev) => prev.filter((x) => x.key !== l.key))}
            accounts={accounts}
            options={detailAccounts}
            placeholder={placeholder}
            showErrorMessage={amountInvalid}
          />
        );
      })}
      <AddLineButton onClick={() => setter((prev) => [...prev, newLine()])} />
      {rows.some((l) => parseFloat(l.amount) > 0) && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs font-semibold text-slate-600">
          <span>الإجمالي</span>
          <span className="tabular-nums font-bold">
            {toFixed(rows.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0), 2)}
          </span>
        </div>
      )}
    </div>
  );
}

interface WizardEntityEditorProps {
  rows: DetailRow[];
  setter: Dispatch<SetStateAction<DetailRow[]>>;
  updateDetail: (setter: Dispatch<SetStateAction<DetailRow[]>>, key: string, patch: Partial<DetailRow>) => void;
  entities: EntityOption[];
  entityPlaceholder: string;
  referenceLabel: string;
  withQty: boolean;
}

export function WizardEntityEditor({
  rows,
  setter,
  updateDetail,
  entities,
  entityPlaceholder,
  referenceLabel,
  withQty,
}: WizardEntityEditorProps) {
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
              <Combobox
                options={entities}
                value={r.entity_id}
                onValueChange={(id) => updateDetail(setter, r.key, { entity_id: id })}
                placeholder={entityPlaceholder}
                searchPlaceholder="ابحث..."
                emptyText="لا توجد نتائج"
                className="h-9 flex-1 min-w-[140px]"
              />
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
      <AddLineButton onClick={() => setter((prev) => [...prev, newDetail()])} />
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