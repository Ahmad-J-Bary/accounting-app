import { Pencil, Trash2 } from "lucide-react";
import type { DamagedItem, MaterialDto } from "@erp/shared-types";
import { formatWithLocale, useCurrencyContext } from "@app/providers/CurrencyContext";
import { formatDateTime, formatNumber, toLocalString } from "@shared/lib/format";
import {
  SidebarShell,
  SidebarHeader,
  SidebarActionBar,
  SidebarBody,
  SidebarDetailGrid,
  type SidebarAction,
} from "@widgets/sidebar-shell";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface DamagedDetailPanelProps {
  item: DamagedItem;
  materials: MaterialDto[];
  onClose: () => void;
  onEdit: (item: DamagedItem) => void;
  onDelete: (id: string) => void;
}

export function DamagedDetailPanel({
  item,
  materials: _materials,
  onClose,
  onEdit,
  onDelete,
}: DamagedDetailPanelProps) {
  const { t } = useLocalization();
  const { currencies, baseCurrency, formatAmount } = useCurrencyContext();

  const itemCurrency = currencies.find((c) => c.code === item.currency_code) || null;
  const lossOriginal = parseFloat(item.loss || item.cost_impact || "0");
  const lossBase = parseFloat(item.loss_base || item.cost_impact_base || "0");
  const displayLoss = `${formatWithLocale(lossOriginal, itemCurrency?.decimals ?? 2)} ${itemCurrency?.symbol || item.currency_code || ""}`.trim();

  const actionItems: SidebarAction[] = [
    {
      label: t("labels.edit", { namespace: "inventory",  }),
      icon: <Pencil className="w-4 h-4" />,
      variant: "warning",
      onClick: () => onEdit(item),
    },
    {
      label: t("labels.delete", { namespace: "inventory",  }),
      icon: <Trash2 className="w-4 h-4" />,
      variant: "danger",
      onClick: () => {
        if (confirm(t("damaged.deleteConfirm", { namespace: "inventory",  }))) {
          onDelete(item.id);
        }
      },
    },
  ];

  return (
    <SidebarShell isOpen={true} onClose={onClose}>
      <SidebarHeader title={t("damaged.detailTitle", { namespace: "inventory",  })} onClose={onClose} />
      <SidebarActionBar actions={actionItems} />
      <SidebarBody>
        <div className="space-y-4 text-right">
          <SidebarDetailGrid
            columns={2}
            fields={[
              { label: t("labels.material", { namespace: "inventory",  }), value: item.material_name || item.material_id },
              { label: t("damaged.registerDate", { namespace: "inventory",  }), value: formatDateTime(item.damage_date) },
            ]}
          />
          <div className="p-4 border border-destructive/10 rounded-2xl bg-destructive/10">
            <div className="p-3 bg-white rounded-xl border border-destructive/10">
              <div className="text-[10px] text-muted-foreground font-bold uppercase mb-1">
                {t("damaged.loss", { namespace: "inventory",  })}
              </div>
              <div className="text-base font-black text-destructive tabular-nums">
                {lossBase > 0
                  ? formatAmount(lossBase, { currencyCode: baseCurrency?.code || "" })
                  : displayLoss}
              </div>
            </div>
            <div className="mt-3 text-[11px] text-muted-foreground font-bold">
              {t("damaged.quantityLabel", { namespace: "inventory",  })}: {toLocalString(Math.round(parseFloat(item.quantity || "0")))}
            </div>
          </div>
          <SidebarDetailGrid
            fields={[
              { label: t("damaged.reason", { namespace: "inventory",  }), value: item.reason || "—" },
            ]}
          />
          <SidebarDetailGrid
            title={t("damaged.extraInfo", { namespace: "inventory",  })}
            fields={[
              { label: t("labels.reference", { namespace: "inventory",  }), value: item.reference ? formatNumber(parseInt(item.reference) || 0) : "—" },
              ...(item.notes ? [{ label: t("labels.notes", { namespace: "inventory",  }), value: item.notes }] : []),
            ]}
          />
        </div>
      </SidebarBody>
    </SidebarShell>
  );
}
