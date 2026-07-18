import { Pencil, Trash2, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import type { StockAdjustment, MaterialDto } from "@erp/shared-types";
import { cn } from "@shared/lib/utils";
import { formatDateTime, formatNumber } from "@shared/lib/format";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
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
  const { formatMonetaryAmount } = useCurrencyContext();
  const diff = parseFloat(item.difference);

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
              { label: "كمية النظام", value: parseFloat(item.system_quantity).toFixed(2) },
              { label: "الكمية المجرودة", value: parseFloat(item.actual_quantity).toFixed(2) },
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
                    {diff > 0 ? "+" : ""}{diff.toFixed(2)}
                  </span>
                ),
              },
              { label: "التكلفة", value: formatMonetaryAmount(parseFloat(item.total_cost_base || "0"), "base") },
            ]}
          />
          <SidebarDetailGrid
            title="معلومات إضافية"
            fields={[
              { label: "المرجع", value: item.reference ? formatNumber(parseInt(item.reference) || 0) : "—" },
              { label: "ملاحظة", value: item.notes || item.reason || "—" },
              { label: "تاريخ الإنشاء", value: formatDateTime(item.created_at) },
            ]}
          />
        </div>
      </SidebarBody>
    </SidebarShell>
  );
}
