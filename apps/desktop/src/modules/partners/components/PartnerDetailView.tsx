import { Pencil, Trash2 } from "lucide-react";
import type { Currency } from "@modules/core/api/currencyService";
import type { PartnerWithRatios } from "@modules/partners/hooks/usePartnerRatios";
import {
  SidebarShell,
  SidebarHeader,
  SidebarActionBar,
  SidebarBody,
  type SidebarAction,
} from "@widgets/sidebar-shell";
import { useCurrencyContext, formatWithLocale } from "@app/providers/CurrencyContext";
import { toFixed } from "@shared/lib/format";
import { resolveProfitShareRatio } from "@modules/reports/lib/partnerProfitShare";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface PartnerDetailViewProps {
  partner: PartnerWithRatios;
  baseCurrency: Currency | null;
  onEdit?: () => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export function PartnerDetailView({
  partner,
  baseCurrency,
  onEdit,
  onDelete,
  onClose,
}: PartnerDetailViewProps) {
  const { formatAmount, currencies } = useCurrencyContext();
  const { t } = useLocalization();
  const partnerCurrency = currencies.find(c => c.code === partner.currency);

  const actualProfitRatio = resolveProfitShareRatio(
    partner.calculatedCapitalRatio,
    partner.calculatedOriginalRatio,
    partner
  );

  const actions: SidebarAction[] = [
    ...(onEdit
      ? [
          {
            label: t("actions.edit", { namespace: "partners",  }),
            icon: <Pencil className="w-4 h-4" />,
            variant: "warning" as const,
            onClick: () => onEdit(),
          },
        ]
      : []),
    ...(onDelete
      ? [
          {
            label: t("actions.delete", { namespace: "partners",  }),
            icon: <Trash2 className="w-4 h-4" />,
            variant: "danger" as const,
            onClick: () => {
              if (confirm(t("confirm.delete", { namespace: "partners",  }))) {
                onDelete(partner.id);
              }
            },
          },
        ]
      : []),
  ];

  return (
    <SidebarShell isOpen={true} onClose={onClose}>
      <SidebarHeader
        title={partner.name}
        subtitle={t("view.subtitle", { namespace: "partners",  })}
        onClose={onClose}
      />
      <SidebarActionBar actions={actions} />
      <SidebarBody>
        <div className="text-right space-y-6">
          <div className="p-5 border border-muted rounded-2xl bg-muted/30">
            <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest border-b border-muted pb-2 mb-4">
              {t("view.investmentSection", { namespace: "partners",  })}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white rounded-xl border border-muted">
                <div className="text-[10px] text-muted-foreground font-bold uppercase mb-1">
                  {t("view.fields.originalAmount", { namespace: "partners",  })}
                </div>
                <div className="text-lg font-black text-slate-900 tabular-nums">
                  {formatWithLocale(parseFloat(partner.amount_original || "0"), partnerCurrency?.decimals ?? 2)} {partnerCurrency?.symbol || partner.currency || ""}
                </div>
              </div>
              <div className="p-3 bg-white rounded-xl border border-muted">
                <div className="text-[10px] text-muted-foreground font-bold uppercase mb-1">
                  {t("view.fields.baseEquivalent", { namespace: "partners", vars: { currency: baseCurrency?.symbol || baseCurrency?.code || "" },  })}
                </div>
                <div className="text-lg font-black text-slate-900 tabular-nums">
                  {formatAmount(partner.displayAmountBase, { currencyCode: baseCurrency?.code || "" })}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="p-3 bg-white rounded-xl border border-muted">
                <div className="text-[10px] text-muted-foreground font-bold uppercase mb-1">
                  {t("view.fields.capitalRatio", { namespace: "partners",  })}
                </div>
                <div className="text-sm font-black text-blue-700 tabular-nums">
                  {toFixed(partner.calculatedCapitalRatio, 2) || "0.00"}%
                </div>
              </div>
              <div className="p-3 bg-white rounded-xl border border-muted">
                <div className="text-[10px] text-muted-foreground font-bold uppercase mb-1">
                  {t("view.fields.profitRatio", { namespace: "partners",  })}
                </div>
                <div className="text-sm font-black text-success tabular-nums">
                  {toFixed(actualProfitRatio, 2)}%
                </div>
              </div>
            </div>
          </div>
          {partner.notes && (
            <div className="p-5 border border-muted rounded-2xl bg-muted/30">
              <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest border-b border-muted pb-2 mb-4">
                {t("view.fields.notes", { namespace: "partners",  })}
              </h4>
              <p className="text-sm text-foreground whitespace-pre-wrap">{partner.notes}</p>
            </div>
          )}
        </div>
      </SidebarBody>
    </SidebarShell>
  );
}