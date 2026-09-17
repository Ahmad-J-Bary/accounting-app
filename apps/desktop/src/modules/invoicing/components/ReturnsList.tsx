import { useMemo, useState } from "react";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { Button } from "@shared/ui/button";
import { Plus, Eye, Settings2, Trash2, Printer } from "lucide-react";
import type { SalesReturnDto, PurchaseReturnDto } from "@erp/shared-types";
import type { CurrencyDisplayMode } from "@app/providers/CurrencyContext";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { ReturnsTable } from "./ReturnsTable";
import type { ResponsiveActionItem } from "@widgets/page-header/ResponsiveActions";

interface ReturnsListProps {
  returns: (SalesReturnDto | PurchaseReturnDto)[];
  loading: boolean;
  search: string;
  partyIdFilter?: string;
  onSearchChange: (val: string) => void;
  onRefresh: () => void;
  onCreate: () => void;
  onEdit: (ret: SalesReturnDto | PurchaseReturnDto) => void;
  onView: (ret: SalesReturnDto | PurchaseReturnDto) => void;
  onDelete: (id: string) => Promise<void>;
  onExportRow?: (ret: SalesReturnDto | PurchaseReturnDto) => void;
  formatMonetaryAmount: (amount: string | number | null | undefined, mode?: CurrencyDisplayMode | "both") => string;
  partyType: "customer" | "supplier";
  title: string;
  createLabel: string;
  searchPlaceholder: string;
  emptyMessage: string;
  statsLabel: string;
  statsColor: string;
  preferenceKey: string;
  showSubtotal?: boolean;
  showExtraCosts?: boolean;
}

export function ReturnsList({
  returns,
  loading,
  search,
  partyIdFilter,
  onSearchChange,
  onCreate,
  onEdit,
  onView,
  onDelete,
  onExportRow,
  partyType,
  title,
  createLabel,
  emptyMessage,
}: ReturnsListProps) {
  const { t } = useLocalization();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() =>
    returns.filter((ret) => {
      const matchesSearch = !search ||
        ret.return_number.includes(search) ||
        (partyType === "supplier"
          ? (ret as PurchaseReturnDto).supplier_name?.includes(search)
          : (ret as SalesReturnDto).customer_name?.includes(search)) ||
        (ret.notes?.includes(search) || "");
      const matchesParty = !partyIdFilter ||
        (partyType === "supplier"
          ? (ret as PurchaseReturnDto).supplier_id === partyIdFilter
          : (ret as SalesReturnDto).customer_id === partyIdFilter);
      return matchesSearch && matchesParty;
    }), [returns, search, partyIdFilter, partyType]);

  const partyLabel = partyType === "supplier"
    ? t("return.partySupplier", { namespace: "invoicing",  })
    : t("return.partyCustomer", { namespace: "invoicing",  });
  const selectedReturn = useMemo(
    () => returns.find((ret) => ret.id === selectedId),
    [returns, selectedId],
  );

  const handleDeleteSelected = async () => {
    if (!selectedId) return;
    if (!window.confirm(t("return.confirmDelete", { namespace: "invoicing",  }))) return;
    await onDelete(selectedId);
    setSelectedId(null);
  };

  const toolbarActions = useMemo<ResponsiveActionItem[]>(() => [
    {
      id: "create-return",
      label: createLabel,
      icon: Plus,
      priority: "primary",
      onClick: onCreate,
    },
    {
      id: "view-return",
      label: t("actions.view", { namespace: "invoicing" }),
      icon: Eye,
      priority: "secondary",
      variant: "outline",
      disabled: !selectedId,
      onClick: () => {
        if (selectedReturn) onView(selectedReturn);
      },
    },
    {
      id: "edit-return",
      label: t("actions.edit", { namespace: "invoicing" }),
      icon: Settings2,
      priority: "secondary",
      variant: "outline",
      disabled: !selectedId,
      onClick: () => {
        if (selectedReturn) onEdit(selectedReturn);
      },
    },
    {
      id: "delete-return",
      label: t("actions.delete", { namespace: "invoicing" }),
      icon: Trash2,
      priority: "overflow",
      variant: "outline",
      destructive: true,
      disabled: !selectedId,
      onClick: () => {
        void handleDeleteSelected();
      },
    },
    {
      id: "print-return",
      label: t("actions.print", { namespace: "invoicing" }),
      icon: Printer,
      priority: "tertiary",
      variant: "outline",
      disabled: !selectedId,
      onClick: () => {
        window.dispatchEvent(new Event("app:prepare-print"));
        requestAnimationFrame(() => window.print());
      },
    },
  ], [createLabel, handleDeleteSelected, onCreate, onEdit, onView, selectedId, selectedReturn, t]);

  return (
    <OperationalTableTemplate
      title={title}
      toolbarActions={toolbarActions}
      tableContent={
        <ReturnsTable
          items={filtered}
          loading={loading}
          search={search}
          onSearchChange={onSearchChange}
          partnerLabel={partyLabel}
          emptyMessage={emptyMessage}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          onExportRow={onExportRow}
        />
      }
    />
  );
}
