import { Pencil, Trash2, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import type { StockAdjustment, MaterialDto } from "@erp/shared-types";
import { cn } from "@shared/lib/utils";
import { formatDateTime, formatNumber, toFixed } from "@shared/lib/format";
import { formatWithLocale, useCurrencyContext } from "@app/providers/CurrencyContext";
import { useLocalization } from "@app/providers/LocalizationProvider";
import {
  SidebarShell,
  SidebarHeader,
  SidebarActionBar,
  SidebarBody,
  SidebarDetailGrid,
  type SidebarAction,
} from "@widgets/sidebar-shell";

interface AdjustmentDetailPanelProps {
  item: StockAdjustment;
  materials: MaterialDto[];
  onClose: () => void;
  onEdit: (item: StockAdjustment) => void;
  onDelete: (id: string) => void;
}

export function AdjustmentDetailPanel({ item, materials: _materials, onClose, onEdit, onDelete }: AdjustmentDetailPanelProps) {
  const { currencies, baseCurrency } = useCurrencyContext();
  const { t } = useLocalization();
  const diff = parseFloat(item.difference);

  const itemCurrency = currencies.find((c) => c.code === item.currency_code) || null;
  const costOriginal = parseFloat(item.total_cost || "0");
  const costBase = parseFloat(item.total_cost_base || "0");
  const displayCost = `${formatWithLocale(costOriginal, itemCurrency?.decimals ?? 2)} ${itemCurrency?.symbol || item.currency_code || ""}`.trim();

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
        if (confirm(t("adjustments.deleteConfirm", { namespace: "inventory",  }))) {
          onDelete(item.id);
        }
      },
    },
  ];

  return (
    <SidebarShell isOpen={true} onClose={onClose}>
      <SidebarHeader title={t("adjustments.detailTitle", { namespace: "inventory",  })} onClose={onClose} />
      <SidebarActionBar actions={actionItems} />
      <SidebarBody>
        <div className="space-y-4 text-right">
          <SidebarDetailGrid
            columns={2}
            fields={[
              { label: t("adjustments.form.material", { namespace: "inventory",  }), value: item.material_name || item.material_id },
              { label: t("adjustments.form.date", { namespace: "inventory",  }), value: formatDateTime(item.adjustment_date) },
            ]}
          />
          <SidebarDetailGrid
            columns={2}
            fields={[
              { label: t("adjustments.systemQuantity", { namespace: "inventory",  }), value: toFixed(parseFloat(item.system_quantity), 2) },
              { label: t("adjustments.form.countedQty", { namespace: "inventory",  }), value: toFixed(parseFloat(item.actual_quantity), 2) },
            ]}
          />
          <SidebarDetailGrid
            columns={2}
            fields={[
              {
                label: t("adjustments.difference", { namespace: "inventory",  }),
                value: (
                  <span className={cn(
                    "inline-flex items-center gap-1 font-black",
                    diff > 0 ? "text-success" : diff < 0 ? "text-destructive" : "text-muted-foreground"
                  )}>
                    {diff > 0 ? <ArrowUpCircle className="w-4 h-4" /> : diff < 0 ? <ArrowDownCircle className="w-4 h-4" /> : null}
                    {diff > 0 ? "+" : ""}{toFixed(diff, 2)}
                  </span>
                ),
              },
              { label: t("adjustments.cost", { namespace: "inventory",  }), value: displayCost },
            ]}
          />
          <SidebarDetailGrid
            columns={2}
            fields={[
              {
                label: `${t("adjustments.equivalent", { namespace: "inventory",  })} (${baseCurrency?.symbol || baseCurrency?.code || ""})`,
                value: costBase !== 0
                  ? formatWithLocale(costBase, baseCurrency?.decimals ?? 2)
                  : "—",
              },
              { label: t("adjustments.reference", { namespace: "inventory",  }), value: item.reference ? formatNumber(parseInt(item.reference) || 0) : "—" },
            ]}
          />
          <SidebarDetailGrid
            title={t("adjustments.extraInfo", { namespace: "inventory",  })}
            fields={[
              { label: t("adjustments.form.note", { namespace: "inventory",  }), value: item.notes || item.reason || "—" },
              { label: t("adjustments.createdAt", { namespace: "inventory",  }), value: formatDateTime(item.created_at) },
            ]}
          />
        </div>
      </SidebarBody>
    </SidebarShell>
  );
}
