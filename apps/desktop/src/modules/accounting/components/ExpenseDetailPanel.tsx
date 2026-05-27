import { Pencil, Trash2, BookOpen } from "lucide-react";
import type { AccountDto } from "@erp/shared-types";
import { Input } from "@shared/ui/input";
import { DetailPanel, ActionButton } from "@widgets/sidebar";
import { SidebarSection } from "@widgets/sidebar/SidebarSection";
import { FieldLabel } from "@widgets/sidebar/FieldLabel";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useTabs } from "@app/providers/TabContext";

interface ExpenseDetailPanelProps {
  expense: AccountDto;
  onClose: () => void;
  onEdit: (expense: AccountDto) => void;
  onDelete: (id: string) => void;
  parentCode?: string;
}

export function ExpenseDetailPanel({
  expense,
  onClose,
  onEdit,
  onDelete,
  parentCode,
}: ExpenseDetailPanelProps) {
  const { baseCurrency } = useCurrencyContext();
  const { openTab } = useTabs();

  if (!expense) return null;

  const actions = (
    <>
      <ActionButton icon={<Pencil className="w-3.5 h-3.5" />} label="تعديل" color="amber" onClick={() => onEdit(expense)} />
      <ActionButton icon={<Trash2 className="w-3.5 h-3.5" />} label="حذف" color="red" onClick={() => { if (confirm(`هل أنت متأكد من حذف "${expense.name_ar}"؟`)) onDelete(expense.id); }} />
      <ActionButton icon={<BookOpen className="w-3.5 h-3.5" />} label="اليومية" color="blue" onClick={() => openTab({
        id: `ledger-${expense.id}`,
        title: `حركة: ${expense.name_ar}`,
        path: `/accounting/account-ledger/${expense.id}`,
        closable: true,
      })} />
    </>
  );

  const displayCode = expense.code && parentCode && expense.code.startsWith(parentCode)
    ? expense.code.substring(parentCode.length)
    : expense.code || "";

  return (
    <DetailPanel
      title="بيانات بند المصروف"
      actions={actions}
      onClose={onClose}
    >
      <SidebarSection title="المعلومات الأساسية">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <FieldLabel>رقم الحساب</FieldLabel>
            <Input value={displayCode} disabled className="h-9 bg-slate-50 tabular-nums" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>اسم البند</FieldLabel>
            <Input value={expense.name_ar} disabled className="h-9 bg-slate-50" />
          </div>
        </div>
      </SidebarSection>

      <SidebarSection title="البيانات المالية">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <FieldLabel>الرصيد الافتتاحي</FieldLabel>
            <Input value={expense.opening_balance || "0"} disabled className="h-9 bg-slate-50 tabular-nums" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>العملة</FieldLabel>
            <Input value={baseCurrency?.code || ""} disabled className="h-9 bg-slate-50 font-bold" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>مدين (حالي)</FieldLabel>
            <Input value={expense.debit || "0"} disabled className="h-9 bg-slate-50 tabular-nums" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>دائن (حالي)</FieldLabel>
            <Input value={expense.credit || "0"} disabled className="h-9 bg-slate-50 tabular-nums" />
          </div>
          <div className="space-y-1.5 col-span-2">
            <FieldLabel>الرصيد الحالي</FieldLabel>
            <Input value={expense.balance || "0"} disabled className="h-9 bg-slate-50 font-bold tabular-nums" />
          </div>
        </div>
      </SidebarSection>

      {expense.notes && (
        <div className="space-y-1.5">
          <FieldLabel>ملاحظات</FieldLabel>
          <Input value={expense.notes} disabled className="h-9 bg-slate-50" />
        </div>
      )}
    </DetailPanel>
  );
}
