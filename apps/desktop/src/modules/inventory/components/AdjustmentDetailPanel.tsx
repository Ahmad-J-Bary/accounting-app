import { Pencil, Trash2, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import type { StockAdjustment, MaterialDto } from "@erp/shared-types";
import { cn } from "@shared/lib/utils";
import { formatDateTime, formatNumber, toFixed } from "@shared/lib/format";
import { formatWithLocale, useCurrencyContext } from "@app/providers/CurrencyContext";
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
  const diff = parseFloat(item.difference);

  const itemCurrency = currencies.find((c) => c.code === item.currency_code) || null;
  const costOriginal = parseFloat(item.total_cost || "0");
  const costBase = parseFloat(item.total_cost_base || "0");
  const displayCost = `${formatWithLocale(costOriginal, itemCurrency?.decimals ?? 2)} ${itemCurrency?.symbol || item.currency_code || ""}`.trim();

  const actionItems: SidebarAction[] = [
    {
      label: "تعديل",
      icon: <Pencil className="w-4 h-4" />,
      variant: "warning",
      onClick: () => onEdit(item),
    },
    {
      label: "حذف",
      icon: <Trash2 className="w-4 h-4" />,
      variant: "danger",
      onClick: () => {
        if (confirm("هل أنت متأكد من حذف سجل التسوية هذا؟ سيتم حذف حركة المخزون المرتبطة به.")) {
          onDelete(item.id);
        }
      },
    },
  ];

  return (
    <SidebarShell isOpen={true} onClose={onClose}>
      <SidebarHeader title="تفاصيل تسوية الجرد" onClose={onClose} />
      <SidebarActionBar actions={actionItems} />
      <SidebarBody>
        <div className="space-y-4 text-right">
          <SidebarDetailGrid
            columns={2}
            fields={[
              { label: "المادة", value: item.material_name || item.material_id },
              { label: "تاريخ التسوية", value: formatDateTime(item.adjustment_date) },
            ]}
          />
          <SidebarDetailGrid
            columns={2}
            fields={[
              { label: "كمية النظام", value: toFixed(parseFloat(item.system_quantity), 2) },
              { label: "الكمية المجرودة", value: toFixed(parseFloat(item.actual_quantity), 2) },
            ]}
          />
          <SidebarDetailGrid
            columns={2}
            fields={[
              {
                label: "الفارق",
                value: (
                  <span className={cn(
                    "inline-flex items-center gap-1 font-black",
                    diff > 0 ? "text-emerald-600" : diff < 0 ? "text-rose-600" : "text-slate-400"
                  )}>
                    {diff > 0 ? <ArrowUpCircle className="w-4 h-4" /> : diff < 0 ? <ArrowDownCircle className="w-4 h-4" /> : null}
                    {diff > 0 ? "+" : ""}{toFixed(diff, 2)}
                  </span>
                ),
              },
              { label: "التكلفة", value: displayCost },
            ]}
          />
          <SidebarDetailGrid
            columns={2}
            fields={[
              {
                label: `المكافئ (${baseCurrency?.symbol || baseCurrency?.code || ""})`,
                value: costBase !== 0
                  ? formatWithLocale(costBase, baseCurrency?.decimals ?? 2)
                  : "—",
              },
              { label: "المرجع", value: item.reference ? formatNumber(parseInt(item.reference) || 0) : "—" },
            ]}
          />
          <SidebarDetailGrid
            title="معلومات إضافية"
            fields={[
              { label: "ملاحظة", value: item.notes || item.reason || "—" },
              { label: "تاريخ الإنشاء", value: formatDateTime(item.created_at) },
            ]}
          />
        </div>
      </SidebarBody>
    </SidebarShell>
  );
}
