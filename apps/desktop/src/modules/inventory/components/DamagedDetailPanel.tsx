import { Pencil, Trash2 } from "lucide-react";
import type { DamagedItem, MaterialDto } from "@erp/shared-types";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { formatDateTime } from "@shared/lib/format";
import {
  SidebarShell,
  SidebarHeader,
  SidebarActionBar,
  SidebarBody,
  SidebarDetailGrid,
  type SidebarAction,
} from "@widgets/sidebar-shell";

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
  const { formatMonetaryAmount } = useCurrencyContext();

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
        if (confirm("هل أنت متأكد من حذف سجل التالف هذا؟ سيتم حذف حركة المخزون المرتبطة به.")) {
          onDelete(item.id);
        }
      },
    },
  ];

  return (
    <SidebarShell isOpen={true} onClose={onClose}>
      <SidebarHeader title="تفاصيل التالف" onClose={onClose} />
      <SidebarActionBar actions={actionItems} />
      <SidebarBody>
        <div className="space-y-4 text-right">
          <SidebarDetailGrid
            columns={2}
            fields={[
              { label: "المنتج / الصنف", value: item.material_name || item.material_id },
              { label: "تاريخ التسجيل", value: formatDateTime(item.damage_date) },
            ]}
          />
          <SidebarDetailGrid
            columns={2}
            fields={[
              { label: "الكمية التالفة", value: `${Math.round(parseFloat(item.quantity || "0"))}` },
              { label: "تأثير التكلفة", value: formatMonetaryAmount(parseFloat(item.cost_impact || "0"), "base") },
            ]}
          />
          <SidebarDetailGrid
            title="معلومات إضافية"
            fields={[
              { label: "سبب التلف", value: item.reason || "—" },
              ...(item.notes ? [{ label: "ملاحظات", value: item.notes }] : []),
              { label: "تاريخ الإنشاء", value: formatDateTime(item.created_at) },
            ]}
          />
        </div>
      </SidebarBody>
    </SidebarShell>
  );
}
