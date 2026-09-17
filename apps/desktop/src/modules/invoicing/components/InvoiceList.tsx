import { useMemo, useState } from "react";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { Button } from "@shared/ui/button";
import { Plus, Eye, Printer, Settings2, Trash2 } from "lucide-react";
import { InvoiceDto } from "@erp/shared-types";
import type { CurrencyDisplayMode } from "@app/providers/CurrencyContext";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { InvoiceTable } from "./InvoiceTable";
import type { ResponsiveActionItem } from "@widgets/page-header/ResponsiveActions";


export interface ExtraColumn {
  key: string;
  label: string;
  accessor: (inv: InvoiceDto) => string | React.ReactNode;
  className?: string;
}


interface InvoiceListProps {
  invoices: InvoiceDto[];
  loading: boolean;
  search: string;
  partyIdFilter?: string;
  onSearchChange: (val: string) => void;
  onRefresh: () => void;
  onCreate: () => void;
  onEdit: (inv: InvoiceDto) => void;
  onView: (inv: InvoiceDto) => void;
  onEditOpeningBalance?: (inv: InvoiceDto) => void;
  onViewOpeningBalance?: (inv: InvoiceDto) => void;
  onPost: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReopen: (id: string) => Promise<void>;
  onExportRow?: (inv: InvoiceDto) => void;
  formatMonetaryAmount: (amount: string | number | { base_amount?: string } | null | undefined, mode?: CurrencyDisplayMode | "both") => string;
  partyType: "supplier" | "customer";
  title: string;
  createLabel: string;
  searchPlaceholder: string;
  emptyMessage: string;
  statsLabel: string;
  statsColor: string;
  preferenceKey: string;
  showSubtotal?: boolean;
  showExtraCosts?: boolean;
  showDiscountGranted?: boolean;
  showDiscount?: boolean;
  extraColumns?: ExtraColumn[];
}

export function InvoiceList({
  invoices,
  loading,
  search,
  partyIdFilter,
  onSearchChange,
  onCreate,
  onEdit,
  onView,
  onEditOpeningBalance,
  onViewOpeningBalance,
  onPost,
  onDelete,
  onReopen,
  onExportRow,
  partyType,
  title,
  createLabel,
  searchPlaceholder,
  emptyMessage,
  preferenceKey,
  showSubtotal = false,
  showExtraCosts = false,
  showDiscountGranted = false,
  showDiscount = false,
  extraColumns = [],
}: InvoiceListProps) {
  const { t } = useLocalization();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const selectedInvoice = useMemo(() =>
    invoices.find(inv => inv.id === selectedId),
    [invoices, selectedId]);

  const handleDeleteSelected = async () => {
    if (!selectedId) return;
    if (!window.confirm(t("invoice.confirmDeleteList", { namespace: "invoicing",  }))) return;
    await onDelete(selectedId);
    setSelectedId(null);
  };

  const filtered = useMemo(() =>
    invoices.filter(inv => {
      const matchesSearch = !search ||
        inv.invoice_number.includes(search) ||
        (partyType === "supplier" ? (inv.supplier_name ?? "") : (inv.customer_name ?? "")).includes(search) ||
        (inv.notes ?? "").includes(search);
      const matchesParty = !partyIdFilter ||
        (partyType === "supplier" ? inv.supplier_id === partyIdFilter : inv.customer_id === partyIdFilter);
      const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
      return matchesSearch && matchesParty && matchesStatus;
    }), [invoices, search, partyIdFilter, statusFilter, partyType]);

  const partyLabel = partyType === "supplier"
    ? t("invoice.partySupplier", { namespace: "invoicing",  })
    : t("invoice.partyCustomer", { namespace: "invoicing",  });
  const defaultName = partyType === "supplier" ? t("invoice.cashSupplierName", { namespace: "invoicing" }) : t("invoice.cashCustomerName", { namespace: "invoicing" });
  const toolbarActions = useMemo<ResponsiveActionItem[]>(() => [
    {
      id: "create-invoice",
      label: createLabel,
      icon: Plus,
      priority: "primary",
      onClick: onCreate,
    },
    {
      id: "view-invoice",
      label: t("actions.view", { namespace: "invoicing" }),
      icon: Eye,
      priority: "secondary",
      variant: "outline",
      disabled: !selectedId,
      onClick: () => {
        if (!selectedInvoice) return;
        if (selectedInvoice.invoice_type === "OpeningBalance") {
          onViewOpeningBalance?.(selectedInvoice);
          return;
        }
        onView(selectedInvoice);
      },
    },
    {
      id: "edit-invoice",
      label: t("actions.edit", { namespace: "invoicing" }),
      icon: Settings2,
      priority: "secondary",
      variant: "outline",
      disabled: !selectedId,
      onClick: () => {
        if (!selectedInvoice) return;
        if (selectedInvoice.invoice_type === "OpeningBalance") {
          onEditOpeningBalance?.(selectedInvoice);
          return;
        }
        onEdit(selectedInvoice);
      },
    },
    {
      id: "delete-invoice",
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
      id: "print-invoice",
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
  ], [createLabel, handleDeleteSelected, onCreate, onEdit, onEditOpeningBalance, onView, onViewOpeningBalance, selectedId, selectedInvoice, t]);

  return (
    <OperationalTableTemplate
      title={title}
      toolbarActions={toolbarActions}
      tableContent={
          <InvoiceTable
            data={filtered}
            loading={loading}
            search={search}
            onSearchChange={onSearchChange}
            searchPlaceholder={searchPlaceholder}
            emptyMessage={emptyMessage}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onView={onView}
            onEdit={onEdit}
            onViewOpeningBalance={onViewOpeningBalance}
            onEditOpeningBalance={onEditOpeningBalance}
            onPost={onPost}
            onDelete={onDelete}
            onReopen={onReopen}
            onExportRow={onExportRow}
            partyLabel={partyLabel}
            partyType={partyType}
            defaultName={defaultName}
            showSubtotal={showSubtotal}
            showExtraCosts={showExtraCosts}
            showDiscountGranted={showDiscountGranted}
            showDiscount={showDiscount}
            extraColumns={extraColumns}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            tableId={preferenceKey}
          />
      }
    />
  );
}
