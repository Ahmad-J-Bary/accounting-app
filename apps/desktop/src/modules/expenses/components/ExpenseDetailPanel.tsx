import { Pencil, Trash2, BookOpen } from "lucide-react";
import type { AccountDto } from "@erp/shared-types";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useTabs } from "@app/providers/TabContext";
import { useCompanyCapabilities } from "@shared/hooks";
import {
  SidebarShell,
  SidebarHeader,
  SidebarActionBar,
  SidebarBody,
  SidebarDetailGrid,
  type SidebarAction,
} from "@widgets/sidebar-shell";

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
  const { canUseOpeningWorkflow } = useCompanyCapabilities();

  if (!expense) return null;

  const displayCode =
    expense.code && parentCode && expense.code.startsWith(parentCode)
      ? expense.code.substring(parentCode.length)
      : expense.code || "";

  const actions: SidebarAction[] = [
    {
      label: "تعديل",
      icon: <Pencil className="w-4 h-4" />,
      variant: "warning",
      onClick: () => onEdit(expense),
    },
    {
      label: "حذف",
      icon: <Trash2 className="w-4 h-4" />,
      variant: "danger",
      onClick: () => {
        if (confirm(`هل أنت متأكد من حذف "${expense.name_ar}"؟`)) {
          onDelete(expense.id);
        }
      },
    },
    {
      label: "اليومية",
      icon: <BookOpen className="w-4 h-4" />,
      variant: "primary",
      onClick: () =>
        openTab({
          id: `ledger-${expense.id}`,
          title: `حركة: ${expense.name_ar}`,
          path: `/accounting/account-ledger/${expense.id}`,
          closable: true,
        }),
    },
  ];

  return (
    <SidebarShell isOpen={true} onClose={onClose}>
      <SidebarHeader title="بيانات بند المصروف" onClose={onClose} />
      <SidebarActionBar actions={actions} />
      <SidebarBody>
        <div className="space-y-4 text-right">
          <SidebarDetailGrid
            columns={2}
            fields={[
              { label: "رقم الحساب", value: displayCode },
              { label: "اسم البند", value: expense.name_ar },
            ]}
          />
          <SidebarDetailGrid
            columns={2}
            fields={[
              ...(canUseOpeningWorkflow
                ? [
                    { label: "الرصيد الافتتاحي", value: expense.opening_balance || "0" },
                    { label: "اتجاه الرصيد", value: parseFloat(expense.debit || "0") > 0 ? "مدين" : "دائن" },
                  ]
                : []),
              { label: "العملة", value: baseCurrency?.code || "" },
              { label: "الرصيد الحالي", value: expense.balance || "0" },
            ]}
          />
          {expense.notes && (
            <SidebarDetailGrid
              fields={[{ label: "ملاحظات", value: expense.notes }]}
            />
          )}
        </div>
      </SidebarBody>
    </SidebarShell>
  );
}
