import { useState, useEffect } from "react";
import { Pencil, Trash2, BookOpen, FileText, Scale } from "lucide-react";
import type { CustomerDto, SupplierDto, PartnerDto } from "@erp/shared-types";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { toFixed } from "@shared/lib/format";
import { effectiveBalance, balanceDirectionLabel } from "@shared/lib/balance-utils";
import { useTabs } from "@app/providers/TabContext";
import { useCompanyCapabilities } from "@shared/hooks";
import { toast } from "sonner";
import { partnerService } from "@modules/partners/api/partnerService";
import {
  SidebarShell,
  SidebarHeader,
  SidebarActionBar,
  SidebarBody,
  SidebarDetailGrid,
  type SidebarAction,
} from "@widgets/sidebar-shell";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface PartnerDetailPanelProps {
  type: "customer" | "supplier";
  partner: CustomerDto | SupplierDto | PartnerDto;
  onClose: () => void;
  onEdit: (partner: CustomerDto | SupplierDto | PartnerDto) => void;
  onDelete: (id: string, name: string) => void;
  onRefresh?: () => void;
}

export function PartnerDetailPanel({
  type,
  partner,
  onClose,
  onEdit,
  onDelete,
  onRefresh,
}: PartnerDetailPanelProps) {
  const { currencies, baseCurrency } = useCurrencyContext();
  const { t } = useLocalization();
  const { openTab } = useTabs();
  const { canAccessOpeningWorkflow } = useCompanyCapabilities();
  const [settled, setSettled] = useState(false);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    setSettled(false);
  }, [partner?.id]);

  if (!partner) return null;

  const isCustomer = type === "customer";
  const isPartner = "amount_original" in partner;
  const p = partner as CustomerDto | SupplierDto;
  const pDebit = "debit" in partner ? parseFloat(p.debit) || 0 : 0;
  const pCredit = "credit" in partner ? parseFloat(p.credit) || 0 : 0;
  const bal = effectiveBalance(pDebit, pCredit, type);
  const isBalanceZero = bal === 0;
  const hasAccountId = (p: typeof partner): p is CustomerDto | SupplierDto => "account_id" in p;
  const partnerAccountId = hasAccountId(partner) ? partner.account_id : null;

  const PROFIT_TYPE_LABELS: Record<string, string> = {
    BasedOnCapitalLocal: t("detail.profitTypeLabels.basedOnLocal", { namespace: "partners",  }),
    BasedOnCapitalOriginal: t("detail.profitTypeLabels.basedOnOriginal", { namespace: "partners",  }),
    Manual: t("detail.profitTypeLabels.manual", { namespace: "partners",  }),
  };

  const title = isPartner
    ? t("detail.titlePartner", { namespace: "partners",  })
    : isCustomer
    ? t("detail.titleCustomer", { namespace: "partners",  })
    : t("detail.titleSupplier", { namespace: "partners",  });

  const statementPath = isCustomer
    ? `/partners/customer-statement/${partner.id}`
    : `/partners/supplier-statement/${partner.id}`;
  const statementTabId = isCustomer
    ? `statement-${partner.id}`
    : `statement-supplier-${partner.id}`;

  const actions: SidebarAction[] = [
    {
      label: t("actions.edit", { namespace: "partners",  }),
      icon: <Pencil className="w-4 h-4" />,
      variant: "warning",
      onClick: () => onEdit(partner),
    },
    {
      label: t("actions.delete", { namespace: "partners",  }),
      icon: <Trash2 className="w-4 h-4" />,
      variant: "danger",
      onClick: () => {
        if (confirm(t("detail.confirmDelete", { namespace: "partners", vars: { name: partner.name },  }))) {
          onDelete(partner.id, partner.name);
        }
      },
    },
    {
      label: t("actions.journal", { namespace: "partners",  }),
      icon: <BookOpen className="w-4 h-4" />,
      variant: "primary",
      hidden: isPartner || !partnerAccountId,
      onClick: () =>
        openTab({
          id: `ledger-${partnerAccountId}`,
          title: t("detail.ledgerTab", { namespace: "partners", vars: { name: partner.name },  }),
          path: `/accounting/account-ledger/${partnerAccountId}`,
          closable: true,
        }),
    },
    {
      label: t("actions.statement", { namespace: "partners",  }),
      icon: <FileText className="w-4 h-4" />,
      variant: "success",
      hidden: isPartner || !partnerAccountId,
      onClick: () =>
        openTab({
          id: statementTabId,
          title: t("detail.statementTab", { namespace: "partners", vars: { name: partner.name },  }),
          path: statementPath,
          closable: true,
        }),
    },
    {
      label: t("actions.settleFull", { namespace: "partners",  }),
      icon: <Scale className="w-4 h-4" />,
      variant: "danger",
      hidden: isPartner || !partnerAccountId || isBalanceZero || settled,
      disabled: settling,
      onClick: async () => {
        if (isBalanceZero) {
          toast.info(t("detail.balanceZeroInfo", { namespace: "partners",  }));
          return;
        }
        const isDebt = bal > 0;
        const voucherLabel = isCustomer
          ? (isDebt ? t("detail.voucherReceiptDebt", { namespace: "partners",  }) : t("detail.voucherCustomerPayment", { namespace: "partners",  }))
          : (isDebt ? t("detail.voucherPayment", { namespace: "partners",  }) : t("detail.voucherSupplierReceipt", { namespace: "partners",  }));
        const amount = Math.abs(bal);
        const ok = confirm(t("detail.settleConfirm", { namespace: "partners", vars: { name: partner.name, voucher: voucherLabel, amount },  }));
        if (!ok) return;
        setSettling(true);
        try {
          const entryNumber = await partnerService.settlePartnerBalance(type, partner.id);
          setSettled(true);
          onRefresh?.();
          if (entryNumber === "0") {
            toast.info(t("detail.alreadyZeroInfo", { namespace: "partners",  }));
          } else {
            toast.success(t("detail.settledSuccess", { namespace: "partners", vars: { number: entryNumber },  }));
          }
        } catch (e) {
          toast.error(t("detail.settleFailed", { namespace: "partners", vars: { error: String(e) },  }));
        } finally {
          setSettling(false);
        }
      },
    },
  ];

  const currencyName = currencies.find(
    (c) => c.code === (partner.currency || baseCurrency?.code)
  );

  return (
    <SidebarShell isOpen={true} onClose={onClose}>
      <SidebarHeader title={title} onClose={onClose} />
      <SidebarActionBar actions={actions} />
      <SidebarBody>
        {isPartner ? (
          <div className="space-y-4 text-right">
            <SidebarDetailGrid
              columns={2}
              fields={[
                { label: t("detail.fields.name", { namespace: "partners",  }), value: partner.name },
              ]}
            />
            <SidebarDetailGrid
              columns={2}
              fields={[
                { label: t("detail.fields.originalAmount", { namespace: "partners",  }), value: `${partner.amount_original || "0"} ${currencyName?.symbol || partner.currency || ""}` },
                { label: t("detail.fields.localEquivalent", { namespace: "partners", vars: { currency: baseCurrency?.symbol || baseCurrency?.code || "" },  }), value: partner.amount_local || "0" },
                { label: t("detail.fields.profitRatio", { namespace: "partners",  }), value: partner.profit_sharing_type === "Manual" && partner.profit_sharing_ratio
                  ? `${toFixed(parseFloat(partner.profit_sharing_ratio), 2)}%`
                  : t("detail.fields.autoRatio", { namespace: "partners",  }) },
                { label: t("detail.fields.distributionMethod", { namespace: "partners",  }), value: PROFIT_TYPE_LABELS[partner.profit_sharing_type || "BasedOnCapitalLocal"] },
              ]}
            />
          </div>
        ) : (
          <div className="space-y-4 text-right">
            <SidebarDetailGrid
              columns={2}
              fields={[
                { label: t("detail.fields.accountNumber", { namespace: "partners",  }), value: (partner as CustomerDto | SupplierDto).code || "" },
                { label: isCustomer ? t("columns.partyNameCustomer", { namespace: "partners",  }) : t("columns.partyNameSupplier", { namespace: "partners",  }), value: partner.name },
                { label: t("detail.fields.phone", { namespace: "partners",  }), value: (partner as CustomerDto | SupplierDto).phone || "—" },
                { label: t("detail.fields.address", { namespace: "partners",  }), value: (partner as CustomerDto | SupplierDto).address || "—" },
              ]}
            />
            <SidebarDetailGrid
              columns={2}
              fields={[
                ...(canAccessOpeningWorkflow
                  ? [
                      { label: t("detail.fields.openingBalance", { namespace: "partners",  }), value: (partner as CustomerDto | SupplierDto).opening_balance || "0" },
                      { label: t("detail.fields.balanceDirection", { namespace: "partners",  }), value: settled ? "—" : balanceDirectionLabel(parseFloat((partner as CustomerDto | SupplierDto).debit || "0"), parseFloat((partner as CustomerDto | SupplierDto).credit || "0"), type) },
                    ]
                  : []),
                { label: t("detail.fields.currentBalance", { namespace: "partners",  }), value: settled ? "0" : String(bal) },
              ]}
            />
            {(partner as CustomerDto | SupplierDto).notes && (
              <SidebarDetailGrid
                fields={[{ label: t("detail.fields.notes", { namespace: "partners",  }), value: (partner as CustomerDto | SupplierDto).notes || "" }]}
              />
            )}
          </div>
        )}
      </SidebarBody>
    </SidebarShell>
  );
}
