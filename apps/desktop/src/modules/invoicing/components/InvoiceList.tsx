import { useMemo, useState } from "react";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { Button } from "@shared/ui/button";
import { Plus, Eye, Printer, Settings2, Trash2 } from "lucide-react";
import { InvoiceDto } from "@erp/shared-types";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { InvoiceTable } from "./InvoiceTable";
import { getInvoiceBaseAmount } from "../lib/invoiceHelpers";

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
  formatMonetaryAmount: (amount: string | number | { base_amount?: string } | null | undefined, mode: string) => string;
  partyType: "supplier" | "customer";
  title: string;
  createLabel: string;
  searchPlaceholder: string;
  emptyMessage: string;
  statsLabel: string;
  statsColor: string;
  preferenceKey: string;
  showSubtotal?: boolean;
  showDiscountGranted?: boolean;
  showDiscount?: boolean;
  showExtraCosts?: boolean;
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
  formatMonetaryAmount,
  partyType,
  title,
  createLabel,
  searchPlaceholder,
  emptyMessage,
  statsLabel,
  statsColor,
  preferenceKey,
  showSubtotal = false,
  showDiscountGranted = false,
  showDiscount = false,
  showExtraCosts = false,
  extraColumns = [],
}: InvoiceListProps) {
  const { currencies, baseCurrency, formatAmount } = useCurrencyContext();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const selectedInvoice = useMemo(() =>
    invoices.find(inv => inv.id === selectedId),
    [invoices, selectedId]);

  const handleDeleteSelected = async () => {
    if (!selectedId) return;
    if (!window.confirm("هل أنت متأكد من حذف هذه الفاتورة؟ سيتم حذف القيود المرتبطة بها أيضاً.")) return;
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

  const partyLabel = partyType === "supplier" ? "المورد" : "الزبون";
  const defaultName = partyType === "supplier" ? "مورد نقدي" : "زبون نقدي";

  const totalDiscount = useMemo(() => {
    return filtered.reduce((sum, inv) => {
      return sum + getInvoiceBaseAmount(
        inv.discount_amount,
        inv.discount_amount_v2,
        inv.currency_code,
        inv.exchange_rate,
        baseCurrency?.code
      );
    }, 0);
  }, [filtered, baseCurrency]);

  return (
    <OperationalTableTemplate
      title={title}
      toolbar={
        <div className="flex items-center gap-2">
          {showDiscount && totalDiscount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200">
              <span className="text-[11px] font-bold text-blue-600">خصوم مكتسبة:</span>
              <span className="text-[11px] font-black text-blue-700 tabular-nums">
                {formatAmount(totalDiscount, { currencyCode: baseCurrency?.code })}
              </span>
            </div>
          )}
          {showDiscountGranted && totalDiscount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200">
              <span className="text-[11px] font-bold text-rose-600">خصوم ممنوحة:</span>
              <span className="text-[11px] font-black text-rose-700 tabular-nums">
                {formatAmount(totalDiscount, { currencyCode: baseCurrency?.code })}
              </span>
            </div>
          )}
          <Button size="sm" onClick={onCreate} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 h-9 px-4 font-bold">
            <Plus className="w-4 h-4 ml-2" />{createLabel}
          </Button>
          <div className="w-[1px] h-6 bg-slate-200 mx-1" />
          <Button variant="outline" size="sm" disabled={!selectedId}
            onClick={() => {
              if (!selectedInvoice) return;
              if (selectedInvoice.invoice_type === "OpeningBalance") {
                onViewOpeningBalance?.(selectedInvoice);
              } else {
                onView(selectedInvoice);
              }
            }}
            className="h-9 border-slate-200 hover:bg-slate-50 font-bold">
            <Eye className="w-4 h-4 ml-2 text-blue-500" /> عرض
          </Button>
          <Button variant="outline" size="sm" disabled={!selectedId}
            onClick={() => {
              if (!selectedInvoice) return;
              if (selectedInvoice.invoice_type === "OpeningBalance") {
                onEditOpeningBalance?.(selectedInvoice);
              } else {
                onEdit(selectedInvoice);
              }
            }}
            className="h-9 border-slate-200 hover:bg-slate-50 font-bold">
            <Settings2 className="w-4 h-4 ml-2 text-amber-500" /> تعديل
          </Button>
          <Button variant="outline" size="sm" disabled={!selectedId}
            onClick={handleDeleteSelected}
            className="h-9 border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 font-bold transition-all">
            <Trash2 className="w-4 h-4 ml-2 text-rose-500" /> حذف
          </Button>
          <div className="w-[1px] h-6 bg-slate-200 mx-1" />
          <Button variant="outline" size="sm" disabled={!selectedId}
            onClick={() => window.print()}
            className="h-9 border-slate-200 hover:bg-slate-50 font-bold">
            <Printer className="w-4 h-4 ml-2 text-slate-500" /> طباعة
          </Button>
        </div>
      }
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
            partyLabel={partyLabel}
            partyType={partyType}
            defaultName={defaultName}
            showSubtotal={showSubtotal}
            showDiscountGranted={showDiscountGranted}
            showDiscount={showDiscount}
            showExtraCosts={showExtraCosts}
            extraColumns={extraColumns}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            tableId={preferenceKey}
          />
      }
    />
  );
}
