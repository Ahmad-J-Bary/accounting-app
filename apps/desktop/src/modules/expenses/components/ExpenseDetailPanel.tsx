import { Pencil, Trash2, BookOpen } from "lucide-react";
import type { AccountDto } from "@erp/shared-types";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useLocalization } from "@app/providers/LocalizationProvider";
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
  const { t } = useLocalization();
  const { baseCurrency } = useCurrencyContext();
  const { openTab } = useTabs();
  const { canAccessOpeningWorkflow } = useCompanyCapabilities();

  if (!expense) return null;

  const displayCode =
    expense.code && parentCode && expense.code.startsWith(parentCode)
      ? expense.code.substring(parentCode.length)
      : expense.code || "";

  const actions: SidebarAction[] = [
    {
      label: t("actions.edit", { namespace: "common", fallback: "تعديل" }),
      icon: <Pencil className="w-4 h-4" />,
      variant: "warning",
      onClick: () => onEdit(expense),
    },
    {
      label: t("actions.delete", { namespace: "common", fallback: "حذف" }),
      icon: <Trash2 className="w-4 h-4" />,
      variant: "danger",
      onClick: () => {
        if (confirm(t("expense.deleteConfirm", { namespace: "invoicing", vars: { name: expense.name_ar }, fallback: `هل أنت متأكد من حذف "${expense.name_ar}"؟` }))) {
          onDelete(expense.id);
        }
      },
    },
    {
      label: t("action.journal", { namespace: "invoicing", fallback: "اليومية" }),
      icon: <BookOpen className="w-4 h-4" />,
      variant: "primary",
      onClick: () =>
        openTab({
          id: `ledger-${expense.id}`,
          title: t("expense.ledgerTabTitle", { namespace: "invoicing", vars: { name: expense.name_ar }, fallback: `حركة: ${expense.name_ar}` }),
          path: `/accounting/account-ledger/${expense.id}`,
          closable: true,
        }),
    },
  ];

  return (
    <SidebarShell isOpen={true} onClose={onClose}>
      <SidebarHeader title={t("expense.detailsTitle", { namespace: "invoicing", fallback: "بيانات بند المصروف" })} onClose={onClose} />
      <SidebarActionBar actions={actions} />
      <SidebarBody>
        <div className="space-y-4 text-right">
          <SidebarDetailGrid
            columns={2}
            fields={[
              { label: t("labels.accountNumber", { namespace: "invoicing", fallback: "رقم الحساب" }), value: displayCode },
              { label: t("expense.itemName", { namespace: "invoicing", fallback: "اسم البند" }), value: expense.name_ar },
            ]}
          />
          <SidebarDetailGrid
            columns={2}
            fields={[
              ...(canAccessOpeningWorkflow
                ? [
                    { label: t("expense.openingBalance", { namespace: "invoicing", fallback: "الرصيد الافتتاحي" }), value: expense.opening_balance || "0" },
                    { label: t("expense.balanceDirection", { namespace: "invoicing", fallback: "اتجاه الرصيد" }), value: parseFloat(expense.debit || "0") > 0 ? t("expense.debitSide", { namespace: "invoicing", fallback: "مدين" }) : t("expense.creditSide", { namespace: "invoicing", fallback: "دائن" }) },
                  ]
                : []),
              { label: t("labels.currency", { namespace: "common", fallback: "العملة" }), value: baseCurrency?.code || "" },
              { label: t("expense.currentBalance", { namespace: "invoicing", fallback: "الرصيد الحالي" }), value: expense.balance || "0" },
            ]}
          />
          {expense.notes && (
            <SidebarDetailGrid
              fields={[{ label: t("labels.notes", { namespace: "common", fallback: "ملاحظات" }), value: expense.notes }]}
            />
          )}
        </div>
      </SidebarBody>
    </SidebarShell>
  );
}
