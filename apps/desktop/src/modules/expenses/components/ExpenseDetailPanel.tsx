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
      label: t("actions.edit", { namespace: "common",  }),
      icon: <Pencil className="w-4 h-4" />,
      variant: "warning",
      onClick: () => onEdit(expense),
    },
    {
      label: t("actions.delete", { namespace: "common",  }),
      icon: <Trash2 className="w-4 h-4" />,
      variant: "danger",
      onClick: () => {
        if (confirm(t("expense.deleteConfirm", { namespace: "invoicing", vars: { name: expense.name_ar },  }))) {
          onDelete(expense.id);
        }
      },
    },
    {
      label: t("expense.journal", { namespace: "invoicing",  }),
      icon: <BookOpen className="w-4 h-4" />,
      variant: "primary",
      onClick: () =>
        openTab({
          id: `ledger-${expense.id}`,
          title: t("expense.ledgerTabTitle", { namespace: "invoicing", vars: { name: expense.name_ar },  }),
          path: `/accounting/account-ledger/${expense.id}`,
          closable: true,
        }),
    },
  ];

  return (
    <SidebarShell isOpen={true} onClose={onClose}>
      <SidebarHeader title={t("expense.detailsTitle", { namespace: "invoicing",  })} onClose={onClose} />
      <SidebarActionBar actions={actions} />
      <SidebarBody>
        <div className="space-y-4 text-right">
          <SidebarDetailGrid
            columns={2}
            fields={[
              { label: t("labels.accountNumber", { namespace: "invoicing",  }), value: displayCode },
              { label: t("expense.itemName", { namespace: "invoicing",  }), value: expense.name_ar },
            ]}
          />
          <SidebarDetailGrid
            columns={2}
            fields={[
              ...(canAccessOpeningWorkflow
                ? [
                    { label: t("expense.openingBalance", { namespace: "invoicing",  }), value: expense.opening_balance || "0" },
                    { label: t("expense.balanceDirection", { namespace: "invoicing",  }), value: parseFloat(expense.debit || "0") > 0 ? t("expense.debitSide", { namespace: "invoicing",  }) : t("expense.creditSide", { namespace: "invoicing",  }) },
                  ]
                : []),
              { label: t("labels.currency", { namespace: "common",  }), value: baseCurrency?.code || "" },
              { label: t("expense.currentBalance", { namespace: "invoicing",  }), value: expense.balance || "0" },
            ]}
          />
          {expense.notes && (
            <SidebarDetailGrid
              fields={[{ label: t("labels.notes", { namespace: "common",  }), value: expense.notes }]}
            />
          )}
        </div>
      </SidebarBody>
    </SidebarShell>
  );
}
