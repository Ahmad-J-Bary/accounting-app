import { Pencil, Trash2 } from "lucide-react";
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
  const { t } = useLocalization();
  const actionItems: SidebarAction[] = [
    {
      label: t("labels.edit", { namespace: "inventory", fallback: "تعديل" }),
      icon: <Pencil className="w-4 h-4" />,
      variant: "warning",
      onClick: () => onEdit(reference),
    },
    {
      label: t("labels.delete", { namespace: "inventory", fallback: "حذف" }),
      icon: <Trash2 className="w-4 h-4" />,
      variant: "danger",
      onClick: () => {
        if (confirm(t("transfers.deleteConfirm", { namespace: "inventory", fallback: "هل أنت متأكد من حذف هذا التحويل؟ سيتم حذف حركتي المخزون المرتبطتين به." }))) {
          onDelete(reference);
        }
      },
    },
  ];

  return (
    <SidebarShell isOpen={true} onClose={onClose}>
      <SidebarHeader title={t("transfers.detailTitle", { namespace: "inventory", fallback: "تفاصيل التحويل" })} onClose={onClose} />
      <SidebarActionBar actions={actionItems} />
      <SidebarBody>
        <div className="space-y-4 text-right">
          <SidebarDetailGrid
            columns={2}
            fields={[
              { label: t("labels.material", { namespace: "inventory", fallback: "المادة" }), value: materialName },
              { label: t("transfers.form.transferDate", { namespace: "inventory", fallback: "تاريخ التحويل" }), value: formatDateTime(transferDate) },
            ]}
          />
          <SidebarDetailGrid
            columns={2}
            fields={[
              { label: t("transfers.fromWarehouse", { namespace: "inventory", fallback: "من مستودع" }), value: sourceWarehouseName },
              { label: t("transfers.toWarehouse", { namespace: "inventory", fallback: "إلى مستودع" }), value: destWarehouseName },
            ]}
          />
          <SidebarDetailGrid
            title={t("transfers.extraInfo", { namespace: "inventory", fallback: "معلومات إضافية" })}
            fields={[
              { label: t("labels.quantity", { namespace: "inventory", fallback: "الكمية" }), value: toLocalString(parseFloat(quantity)) },
              { label: t("labels.reference", { namespace: "inventory", fallback: "المرجع" }), value: formatNumber(parseInt(reference) || 0) },
              ...(notes ? [{ label: t("labels.notes", { namespace: "inventory", fallback: "ملاحظات" }), value: notes }] : []),
            ]}
          />
        </div>
      </SidebarBody>
    </SidebarShell>
  );
}
