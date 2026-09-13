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
      label: t("labels.edit", { namespace: "inventory",  }),
      icon: <Pencil className="w-4 h-4" />,
      variant: "warning",
      onClick: () => onEdit(reference),
    },
    {
      label: t("labels.delete", { namespace: "inventory",  }),
      icon: <Trash2 className="w-4 h-4" />,
      variant: "danger",
      onClick: () => {
        if (confirm(t("transfers.deleteConfirm", { namespace: "inventory",  }))) {
          onDelete(reference);
        }
      },
    },
  ];

  return (
    <SidebarShell isOpen={true} onClose={onClose}>
      <SidebarHeader title={t("transfers.detailTitle", { namespace: "inventory",  })} onClose={onClose} />
      <SidebarActionBar actions={actionItems} />
      <SidebarBody>
        <div className="space-y-4 text-right">
          <SidebarDetailGrid
            columns={2}
            fields={[
              { label: t("labels.material", { namespace: "inventory",  }), value: materialName },
              { label: t("transfers.form.transferDate", { namespace: "inventory",  }), value: formatDateTime(transferDate) },
            ]}
          />
          <SidebarDetailGrid
            columns={2}
            fields={[
              { label: t("transfers.fromWarehouse", { namespace: "inventory",  }), value: sourceWarehouseName },
              { label: t("transfers.toWarehouse", { namespace: "inventory",  }), value: destWarehouseName },
            ]}
          />
          <SidebarDetailGrid
            title={t("transfers.extraInfo", { namespace: "inventory",  })}
            fields={[
              { label: t("labels.quantity", { namespace: "inventory",  }), value: toLocalString(parseFloat(quantity)) },
              { label: t("labels.reference", { namespace: "inventory",  }), value: formatNumber(parseInt(reference) || 0) },
              ...(notes ? [{ label: t("labels.notes", { namespace: "inventory",  }), value: notes }] : []),
            ]}
          />
        </div>
      </SidebarBody>
    </SidebarShell>
  );
}
