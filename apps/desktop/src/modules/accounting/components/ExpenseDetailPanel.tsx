import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { X, Pencil, Trash2, BookOpen } from "lucide-react";
import type { AccountDto } from "@erp/shared-types";
import { Button } from "@shared/ui/button";
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

  const isDisabled = true;

  return (
    <div className="flex flex-col h-full bg-white" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-slate-50/50 shrink-0">
        <div className="flex flex-col gap-1 text-right">
          <h2 className="text-lg font-bold text-slate-800">بيانات بند المصروف</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="bg-amber-500 text-white hover:bg-amber-600 border-none h-8 px-3 rounded-lg"
            onClick={() => onEdit(expense)}
          >
            <Pencil className="w-3.5 h-3.5 ml-1.5" />
            تعديل
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-red-500 text-white hover:bg-red-600 border-none h-8 px-3 rounded-lg"
            onClick={() => {
              if (confirm(`هل أنت متأكد من حذف "${expense.name_ar}"؟`)) {
                onDelete(expense.id);
              }
            }}
          >
            <Trash2 className="w-3.5 h-3.5 ml-1.5" />
            حذف
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-blue-600 text-white hover:bg-blue-700 border-none h-8 px-3 rounded-lg"
            onClick={() => openTab({
              id: `ledger-${expense.id}`,
              title: `حركة: ${expense.name_ar}`,
              path: `/accounting/account-ledger/${expense.id}`,
              closable: true,
            })}
          >
            <BookOpen className="w-3.5 h-3.5 ml-1.5" />
            اليومية
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6 text-right">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b pb-2">المعلومات الأساسية</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">رقم الحساب</Label>
                <Input 
                  value={
                    expense.code && parentCode && expense.code.startsWith(parentCode)
                      ? expense.code.substring(parentCode.length)
                      : expense.code || ""
                  } 
                  disabled={isDisabled} 
                  className="h-9 bg-slate-50 tabular-nums" 
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">اسم البند</Label>
                <Input value={expense.name_ar} disabled={isDisabled} className="h-9 bg-slate-50" />
              </div>
            </div>
          </div>

          {/* Financial Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b pb-2">البيانات المالية</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">الرصيد الافتتاحي</Label>
                <Input value={expense.opening_balance || "0"} disabled={isDisabled} className="h-9 bg-slate-50 tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">العملة</Label>
                <Input value={baseCurrency?.code || "SYP"} disabled={isDisabled} className="h-9 bg-slate-50 font-bold" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">مدين (حالي)</Label>
                <Input value={expense.debit || "0"} disabled={isDisabled} className="h-9 bg-slate-50 tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">دائن (حالي)</Label>
                <Input value={expense.credit || "0"} disabled={isDisabled} className="h-9 bg-slate-50 tabular-nums" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-bold text-slate-600">الرصيد الحالي</Label>
                <Input
                  value={expense.balance || "0"}
                  disabled={isDisabled}
                  className="h-9 bg-slate-50 font-bold tabular-nums"
                />
              </div>
            </div>
          </div>

          {expense.notes && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">ملاحظات</Label>
              <Input value={expense.notes} disabled={isDisabled} className="h-9 bg-slate-50" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
