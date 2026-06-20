import { Pencil, Trash2 } from "lucide-react";
import { formatDateTime } from "@shared/lib/format";
import {
  SidebarShell,
  SidebarHeader,
  SidebarActionBar,
  SidebarBody,
  SidebarDetailGrid,
  type SidebarAction,
} from "@widgets/sidebar-shell";

interface TransferDetailPanelProps {
  reference: string;
  materialName: string;
  quantity: string;
  sourceWarehouseName: string;
  destWarehouseName: string;
  transferDate: string;
  notes?: string | null;
  onClose: () => void;
  onEdit: (reference: string) => void;
  onDelete: (reference: string) => void;
}

export function TransferDetailPanel({
  reference,
  materialName,
  quantity,
  sourceWarehouseName,
  destWarehouseName,
  transferDate,
  notes,
  onClose,
  onEdit,
  onDelete,
}: TransferDetailPanelProps) {
  const actionItems: SidebarAction[] = [
    {
      label: "تعديل",
      icon: <Pencil className="w-4 h-4" />,
      variant: "warning",
      onClick: () => onEdit(reference),
    },
    {
      label: "حذف",
      icon: <Trash2 className="w-4 h-4" />,
      variant: "danger",
      onClick: () => {
        if (confirm("هل أنت متأكد من حذف هذا التحويل؟ سيتم حذف حركتي المخزون المرتبطتين به.")) {
          onDelete(reference);
        }
      },
    },
  ];

  return (
    <SidebarShell isOpen={true} onClose={onClose}>
      <SidebarHeader title="تفاصيل التحويل" onClose={onClose} />
      <SidebarActionBar actions={actionItems} />
      <SidebarBody>
        <div className="space-y-4 text-right">
          <SidebarDetailGrid
            columns={2}
            fields={[
              { label: "المادة", value: materialName },
              { label: "تاريخ التحويل", value: formatDateTime(transferDate) },
            ]}
          />
          <SidebarDetailGrid
            columns={2}
            fields={[
              { label: "من مستودع", value: sourceWarehouseName },
              { label: "إلى مستودع", value: destWarehouseName },
            ]}
          />
          <SidebarDetailGrid
            title="معلومات إضافية"
            fields={[
              { label: "الكمية", value: quantity },
              { label: "المرجع", value: reference },
              ...(notes ? [{ label: "ملاحظات", value: notes }] : []),
            ]}
          />
        </div>
      </SidebarBody>
    </SidebarShell>
  );
}
